"""Confluence Cloud source fetcher — Atlassian REST API v2.

Unlike SharePoint/OneDrive (which download document *files*), Confluence pages
have no file bytes. To keep a single parsing path across all sources, this
fetcher pulls each page body in **storage format** (XHTML) and wraps it as an
``text/html`` document, which Docling ingests natively — producing the same
``DoclingDocument`` structure (headings, tables, lists, images) as the file
sources. That makes Confluence sections/elements/embeddings byte-compatible in
shape with the other sources, so cross-source retrieval is uniform.

Storage format is used deliberately over ``atlas_doc_format``: Docling cannot
ingest ADF JSON, and the v2 ADF body has a known bug returning stale content,
whereas ``body-format=storage`` returns the current version as clean XHTML.

Required config keys on the SOP source (``IngestionSource.config``):
``CF_DOMAIN``, ``CF_EMAIL``, ``CF_API_TOKEN``, ``CF_SPACE_KEY``.
"""

from __future__ import annotations

import base64
import html
import logging
from typing import Any

import requests

from src.ingestion.fetchers.base import BaseSourceFetcher
from src.ingestion.types import DocumentRef, FetchedDocument, ResolvedSource
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30
PAGE_LIMIT = 250  # max page size for v2 list endpoints


class ConfluenceFetcher(BaseSourceFetcher):
    """Lists and reads Confluence pages via the Atlassian Cloud REST API v2."""

    REQUIRED_KEYS = (
        "CF_DOMAIN",
        "CF_EMAIL",
        "CF_API_TOKEN",
        "CF_SPACE_KEY",
    )

    def __init__(self) -> None:
        # source_id -> {signature, space_id}. Caches the resolved space id per
        # source while its config is unchanged.
        self._state: dict[str, dict[str, Any]] = {}

    # ------------------------------------------------------------------ #
    # Config / cache
    # ------------------------------------------------------------------ #
    def _settings(self, source: ResolvedSource) -> dict[str, str]:
        missing = [
            key for key in self.REQUIRED_KEYS if not self.config_value(source, key)
        ]
        if missing:
            raise RuntimeError(
                f"Missing Confluence config for source '{source.source_name}': "
                f"{', '.join(missing)}"
            )
        return {
            "domain": self.config_value(source, "CF_DOMAIN").strip().rstrip("/"),
            "email": self.config_value(source, "CF_EMAIL").strip(),
            # Stored Fernet-encrypted by the env bootstrap; decrypt_secret is a
            # no-op pass-through for any legacy plaintext value already in the DB.
            "api_token": decrypt_secret(
                self.config_value(source, "CF_API_TOKEN")
            ).strip(),
            "space_key": self.config_value(source, "CF_SPACE_KEY").strip(),
        }

    def _state_for(self, source: ResolvedSource) -> dict[str, Any]:
        signature = self.config_signature(source)
        state = self._state.get(source.source_id)
        if state is None or state.get("signature") != signature:
            state = {"signature": signature, "space_id": None}
            self._state[source.source_id] = state
        return state

    # ------------------------------------------------------------------ #
    # REST API
    # ------------------------------------------------------------------ #
    @staticmethod
    def _auth_headers(settings: dict[str, str]) -> dict[str, str]:
        token = base64.b64encode(
            f"{settings['email']}:{settings['api_token']}".encode()
        ).decode()
        return {"Authorization": f"Basic {token}", "Accept": "application/json"}

    def _get(
        self, settings: dict[str, str], url: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """GET a Confluence URL. ``url`` may be a ``/wiki/...`` path or full URL."""
        if url.startswith("http"):
            full = url
        elif url.startswith("/wiki"):
            full = f"https://{settings['domain']}{url}"
        else:
            full = f"https://{settings['domain']}/wiki/api/v2{url}"
        try:
            response = requests.get(
                full,
                headers=self._auth_headers(settings),
                params=params,
                timeout=DEFAULT_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"Confluence request failed: {exc}") from exc
        if response.status_code >= 400:
            raise RuntimeError(
                f"Confluence request to '{full}' failed "
                f"(HTTP {response.status_code}): {response.text[:500]}"
            )
        return response.json() or {}

    def _paginate(
        self, settings: dict[str, str], endpoint: str, params: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Collect all ``results`` across pages, following ``_links.next``."""
        results: list[dict[str, Any]] = []
        payload = self._get(settings, endpoint, params)
        while True:
            results.extend(payload.get("results") or [])
            next_link = (payload.get("_links") or {}).get("next")
            if not next_link:
                return results
            # next_link already carries the cursor + limit; don't resend params.
            payload = self._get(settings, next_link)

    def _space_id(self, source: ResolvedSource, settings: dict[str, str]) -> str:
        state = self._state_for(source)
        if state["space_id"]:
            return state["space_id"]

        wanted = settings["space_key"].upper()
        spaces = self._paginate(
            settings, "/spaces", {"limit": PAGE_LIMIT, "status": "current"}
        )
        for space in spaces:
            if (space.get("key") or "").upper() == wanted:
                state["space_id"] = space["id"]
                return space["id"]
        raise RuntimeError(
            f"Confluence space key '{settings['space_key']}' not found or not "
            f"accessible for source '{source.source_name}'."
        )

    # ------------------------------------------------------------------ #
    # SourceFetcher interface
    # ------------------------------------------------------------------ #
    def list_documents(self, source: ResolvedSource) -> list[DocumentRef]:
        settings = self._settings(source)
        space_id = self._space_id(source, settings)

        pages = self._paginate(
            settings,
            "/pages",
            {"space-id": space_id, "limit": PAGE_LIMIT, "status": "current"},
        )

        refs: list[DocumentRef] = []
        for page in pages:
            page_id = str(page.get("id") or "").strip()
            if not page_id:
                continue
            title = page.get("title") or f"page-{page_id}"
            version = page.get("version") or {}
            # _links.webui is relative to the /wiki base path, not the bare
            # domain (e.g. "/spaces/KEY/pages/123/Title"). Prepend both the
            # domain and /wiki for a working browser URL; guard against a
            # future API response that already includes /wiki.
            webui = (page.get("_links") or {}).get("webui") or ""
            if webui and not webui.startswith("/wiki"):
                webui = f"/wiki{webui}"
            web_url = f"https://{settings['domain']}{webui}" if webui else None
            refs.append(
                DocumentRef(
                    source_id=source.source_id,
                    # Page id is the stable, source-unique change-detection key.
                    path=page_id,
                    # Name drives the slug + tells Docling this is HTML; the page
                    # id keeps the slug globally unique across same-titled pages.
                    name=f"{title} {page_id}.html",
                    mime_type="text/html",
                    modified=version.get("createdAt"),
                    size=None,
                    # version.number bumps on every edit — a clean change token.
                    version=str(version["number"])
                    if version.get("number") is not None
                    else None,
                    web_url=web_url,
                )
            )
        return refs

    def fetch_document(
        self, source: ResolvedSource, ref: DocumentRef
    ) -> FetchedDocument:
        settings = self._settings(source)
        page = self._get(settings, f"/pages/{ref.path}", {"body-format": "storage"})
        title = page.get("title") or ""
        storage = ((page.get("body") or {}).get("storage") or {}).get("value") or ""

        # Wrap the storage XHTML as a standalone HTML document and prepend the
        # page title as an <h1> so Docling emits it as the document heading
        # (storage bodies usually omit the title). Docling parses this exactly
        # like a SharePoint/OneDrive .docx/.pdf.
        document = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<title>{html.escape(title)}</title></head><body>"
            f"<h1>{html.escape(title)}</h1>{storage}</body></html>"
        )
        return FetchedDocument(
            ref=ref,
            content=document.encode("utf-8"),
            encoding="bytes",
            mime_type="text/html",
        )
