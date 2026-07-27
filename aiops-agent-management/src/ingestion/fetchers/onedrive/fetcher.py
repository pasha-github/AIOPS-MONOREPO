"""OneDrive for Business source fetcher — direct Microsoft Graph access.

OneDrive for Business is backed by a per-user *personal* SharePoint site, so
this fetcher reuses the entire SharePoint Graph plumbing
(:class:`SharePointGraphFetcher`) and overrides only the two things that differ:

* ``_settings`` — reads the ``OD_*`` config keys (and reports ``doc_library=""``
  since OneDrive files hang off the drive root, not a named document library).
* ``_site_id`` — resolves the user's *personal* site
  (``https://{tenant}-my.sharepoint.com/personal/{user}``) instead of a regular
  team site URL.

``list_documents``, ``fetch_document``, ``_access_token``, ``_graph_get``,
``_normalize_path`` and ``_version_token`` are all inherited unchanged: once a
site id is resolved, OneDrive's drive endpoints are identical to SharePoint's,
so listing, change-detection and byte download (fed straight to Docling) behave
exactly the same as for SharePoint.

Required config keys on the SOP source (``IngestionSource.config``):
``OD_ID_APP``, ``OD_ID_APP_SECRET``, ``OD_TENANT_ID``, ``OD_TENANT``,
``OD_USER_EMAIL``. Optional: ``OD_FOLDER`` (sub-folder scope; root if unset).
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from src.ingestion.fetchers.sharepoint import SharePointGraphFetcher
from src.ingestion.types import ResolvedSource
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)


class OneDriveGraphFetcher(SharePointGraphFetcher):
    """Lists and reads SOP documents from OneDrive for Business via MS Graph."""

    REQUIRED_KEYS = (
        "OD_ID_APP",
        "OD_ID_APP_SECRET",
        "OD_TENANT_ID",
        "OD_TENANT",
        "OD_USER_EMAIL",
    )
    FOLDER_CONFIG_KEY = "OD_FOLDER"

    # ------------------------------------------------------------------ #
    # Config
    # ------------------------------------------------------------------ #
    def _settings(self, source: ResolvedSource) -> dict[str, str]:
        missing = [
            key for key in self.REQUIRED_KEYS if not self.config_value(source, key)
        ]
        if missing:
            raise RuntimeError(
                f"Missing OneDrive config for source '{source.source_name}': "
                f"{', '.join(missing)}"
            )
        # ``tenant`` is the bare tenant name (e.g. "rcyber" from
        # rcyber.sharepoint.com); tolerate a trailing "-my" if someone pasted
        # the my-site host name instead.
        tenant = self.config_value(source, "OD_TENANT").strip().rstrip("/")
        if tenant.endswith("-my"):
            tenant = tenant[: -len("-my")]
        return {
            "client_id": self.config_value(source, "OD_ID_APP").strip(),
            # Stored Fernet-encrypted by the env bootstrap; decrypt_secret is a
            # no-op pass-through for any legacy plaintext value already in the DB.
            "client_secret": decrypt_secret(
                self.config_value(source, "OD_ID_APP_SECRET")
            ).strip(),
            "tenant_id": self.config_value(source, "OD_TENANT_ID").strip(),
            "tenant": tenant,
            "user_email": self.config_value(source, "OD_USER_EMAIL").strip(),
            # OneDrive files live under the drive root, not a named document
            # library; an empty doc_library makes _normalize_path scope by folder
            # alone, and the inherited drive endpoints resolve against root.
            "doc_library": "",
            "folder": self.config_value(source, self.FOLDER_CONFIG_KEY)
            .strip()
            .strip("/"),
        }

    # ------------------------------------------------------------------ #
    # Site resolution (personal my-site instead of a team site)
    # ------------------------------------------------------------------ #
    def _site_id(
        self, source: ResolvedSource, settings: dict[str, Any], token: str
    ) -> str:
        state = self._state_for(source)
        if state["site_id"]:
            return state["site_id"]

        # Microsoft maps a user's OneDrive to a personal site whose path is the
        # email with '@' and '.' replaced by '_'.
        local = settings["user_email"].replace("@", "_").replace(".", "_")
        site_url = f"https://{settings['tenant']}-my.sharepoint.com/personal/{local}"
        parsed = urlparse(site_url)
        host = parsed.netloc
        path = (parsed.path or "").strip("/")
        if not host or not path:
            raise RuntimeError(
                f"Could not build OneDrive personal site URL for source "
                f"'{source.source_name}' (tenant/user_email)."
            )

        response = self._graph_get(f"/sites/{host}:/{path}", token)
        site_id = (response.json() or {}).get("id")
        if not site_id:
            raise RuntimeError("Unable to resolve OneDrive personal site id.")
        state["site_id"] = site_id
        return site_id
