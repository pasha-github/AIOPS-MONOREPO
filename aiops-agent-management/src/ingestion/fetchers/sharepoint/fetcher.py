"""SharePoint source fetcher — direct Microsoft Graph access.

This fetcher calls the MS Graph API itself (token + sites + drive endpoints)
rather than going through the agent-facing ``sharepoint_connector``. That keeps
ingestion self-contained: the connector can be removed once ingestion and
retrieval are in place, and the agent never has the option of fetching SOPs
through a connector tool.

Required config keys on the SOP source (``IngestionSource.config``):
``SHP_ID_APP``, ``SHP_ID_APP_SECRET``, ``SHP_TENANT_ID``, ``SHP_SITE_URL``,
``SHP_DOC_LIBRARY``. Optional: ``SOP_FOLDER_PATH`` (sub-folder scope).
"""

from __future__ import annotations

import logging
import posixpath
import time
from typing import Any
from urllib.parse import quote, urlparse

import requests

from src.ingestion.fetchers.base import BaseSourceFetcher
from src.ingestion.types import DocumentRef, FetchedDocument, ResolvedSource
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
DEFAULT_TIMEOUT = 30
TOKEN_REFRESH_BUFFER_SECONDS = 300
TEXT_EXTENSIONS = (".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".py")
TEXT_MIME_TYPES = {"application/json", "application/xml"}


class SharePointGraphFetcher(BaseSourceFetcher):
    """Lists and reads SOP documents from SharePoint via Microsoft Graph."""

    REQUIRED_KEYS = (
        "SHP_ID_APP",
        "SHP_ID_APP_SECRET",
        "SHP_TENANT_ID",
        "SHP_SITE_URL",
        "SHP_DOC_LIBRARY",
    )
    FOLDER_CONFIG_KEY = "SOP_FOLDER_PATH"

    def __init__(self) -> None:
        # source_id -> {signature, token, expires_at, site_id}. Caches the access
        # token and resolved site id per source while its config is unchanged.
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
                f"Missing SharePoint config for source '{source.source_name}': "
                f"{', '.join(missing)}"
            )
        return {
            "client_id": self.config_value(source, "SHP_ID_APP").strip(),
            # Stored Fernet-encrypted by the env bootstrap; decrypt_secret is a
            # no-op pass-through for any legacy plaintext value already in the DB.
            "client_secret": decrypt_secret(
                self.config_value(source, "SHP_ID_APP_SECRET")
            ).strip(),
            "tenant_id": self.config_value(source, "SHP_TENANT_ID").strip(),
            "site_url": self.config_value(source, "SHP_SITE_URL").strip().rstrip("/"),
            "doc_library": self.config_value(source, "SHP_DOC_LIBRARY")
            .strip()
            .strip("/"),
            "folder": self.config_value(source, self.FOLDER_CONFIG_KEY)
            .strip()
            .strip("/"),
        }

    def _state_for(self, source: ResolvedSource) -> dict[str, Any]:
        signature = self.config_signature(source)
        state = self._state.get(source.source_id)
        if state is None or state.get("signature") != signature:
            state = {
                "signature": signature,
                "token": None,
                "expires_at": 0.0,
                "site_id": None,
            }
            self._state[source.source_id] = state
        return state

    # ------------------------------------------------------------------ #
    # Graph API
    # ------------------------------------------------------------------ #
    def _access_token(self, source: ResolvedSource, settings: dict[str, str]) -> str:
        state = self._state_for(source)
        now = time.time()
        if state["token"] and now < (
            state["expires_at"] - TOKEN_REFRESH_BUFFER_SECONDS
        ):
            return state["token"]

        token_url = (
            f"https://login.microsoftonline.com/{settings['tenant_id']}"
            "/oauth2/v2.0/token"
        )
        try:
            response = requests.post(
                token_url,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_id": settings["client_id"],
                    "client_secret": settings["client_secret"],
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
                timeout=DEFAULT_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"SharePoint token request failed: {exc}") from exc

        if response.status_code >= 400:
            raise RuntimeError(
                f"SharePoint token request failed (HTTP {response.status_code}): "
                f"{response.text}"
            )
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise RuntimeError("SharePoint token endpoint returned no access_token.")

        state["token"] = token
        state["expires_at"] = now + int(payload.get("expires_in", 3600))
        return token

    def _graph_get(self, endpoint: str, token: str) -> requests.Response:
        try:
            response = requests.get(
                f"{GRAPH_BASE_URL}{endpoint}",
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}",
                },
                timeout=DEFAULT_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"Microsoft Graph request failed: {exc}") from exc

        if response.status_code >= 400:
            raise RuntimeError(
                f"Microsoft Graph request to '{endpoint}' failed "
                f"(HTTP {response.status_code}): {response.text}"
            )
        return response

    def _site_id(
        self, source: ResolvedSource, settings: dict[str, str], token: str
    ) -> str:
        state = self._state_for(source)
        if state["site_id"]:
            return state["site_id"]

        parsed = urlparse(settings["site_url"])
        host = parsed.netloc
        path = (parsed.path or "").strip("/")
        if not host or not path:
            raise RuntimeError("Invalid SHP_SITE_URL format.")

        response = self._graph_get(f"/sites/{host}:/{path}", token)
        site_id = (response.json() or {}).get("id")
        if not site_id:
            raise RuntimeError("Unable to resolve SharePoint site id.")
        state["site_id"] = site_id
        return site_id

    @staticmethod
    def _normalize_path(doc_library: str, raw_path: str) -> str:
        """Return a drive-root-relative path scoped under the document library."""
        raw = (raw_path or "").strip().strip("/")
        clean = posixpath.normpath(f"/{raw}").lstrip("/") if raw else ""
        if clean.startswith(".."):
            raise RuntimeError("Invalid path traversal attempt.")
        if not clean:
            return doc_library
        if clean == doc_library or clean.startswith(f"{doc_library}/"):
            return clean
        return f"{doc_library}/{clean}".strip("/")

    # ------------------------------------------------------------------ #
    # SourceFetcher interface
    # ------------------------------------------------------------------ #
    def list_documents(self, source: ResolvedSource) -> list[DocumentRef]:
        settings = self._settings(source)
        token = self._access_token(source, settings)
        site_id = self._site_id(source, settings, token)
        folder = self._normalize_path(settings["doc_library"], settings["folder"])

        endpoint = (
            f"/sites/{site_id}/drive/root:/{quote(folder)}:/children"
            if folder
            else f"/sites/{site_id}/drive/root/children"
        )
        items = (self._graph_get(endpoint, token).json() or {}).get("value", [])

        refs: list[DocumentRef] = []
        for item in items:
            if "file" not in item:
                continue
            name = item.get("name") or ""
            full_path = f"{folder}/{name}" if folder else name
            refs.append(
                DocumentRef(
                    source_id=source.source_id,
                    path=full_path,
                    name=name,
                    mime_type=(item.get("file") or {}).get("mimeType"),
                    modified=item.get("lastModifiedDateTime"),
                    size=item.get("size"),
                    version=self._version_token(item),
                    # Graph API returns the direct browser URL for each driveItem.
                    web_url=item.get("webUrl") or None,
                )
            )
        return refs

    @staticmethod
    def _version_token(item: dict[str, Any]) -> str | None:
        """Change-detection token from a Graph driveItem (no download needed).

        Prefers a content hash, then the content tag (``cTag`` changes on content
        edits, not metadata-only edits), then ``eTag``, then modified+size.
        """
        hashes = (item.get("file") or {}).get("hashes") or {}
        token = (
            hashes.get("quickXorHash")
            or hashes.get("sha256Hash")
            or hashes.get("sha1Hash")
            or item.get("cTag")
            or item.get("eTag")
        )
        if token:
            return token
        modified = item.get("lastModifiedDateTime")
        if modified:
            return f"{modified}|{item.get('size', '')}"
        return None

    def fetch_document(
        self, source: ResolvedSource, ref: DocumentRef
    ) -> FetchedDocument:
        settings = self._settings(source)
        token = self._access_token(source, settings)
        site_id = self._site_id(source, settings, token)
        full_path = self._normalize_path(settings["doc_library"], ref.path)
        item_endpoint = f"/sites/{site_id}/drive/root:/{quote(full_path)}"

        # mime type already known from the listing call — fetch only the content.
        mime_type = (ref.mime_type or "").lower()
        raw = self._graph_get(f"{item_endpoint}:/content", token).content

        is_text = (
            mime_type.startswith("text/")
            or mime_type in TEXT_MIME_TYPES
            or ref.path.lower().endswith(TEXT_EXTENSIONS)
        )
        if is_text:
            try:
                content: bytes | str = raw.decode("utf-8")
            except UnicodeDecodeError:
                content = raw.decode("utf-8", errors="replace")
            return FetchedDocument(
                ref=ref, content=content, encoding="utf-8", mime_type=mime_type
            )

        return FetchedDocument(
            ref=ref, content=raw, encoding="bytes", mime_type=mime_type
        )
