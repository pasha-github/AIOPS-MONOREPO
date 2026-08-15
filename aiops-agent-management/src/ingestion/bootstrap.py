"""Temporary env-based IngestionSource bootstrap (until the management UI lands).

SOP sources will normally be configured from the UI as `IngestionSource` rows.
Until that exists, this upserts sources at startup from environment variables —
using the **same config keys as the matching connector** — so local end-to-end
testing needs no UI or admin endpoint.

Each source type below is bootstrapped independently: a source is created only
when *all* of its required env vars are present, so you can enable just the
ones you need. Each upsert is keyed by `source_name`, so it is idempotent
across restarts, and the sources coexist (one `IngestionSource` row each).

Supported source types and their env vars:

  SharePoint (source_type="sharepoint"):
    SHP_ID_APP, SHP_ID_APP_SECRET, SHP_TENANT_ID, SHP_SITE_URL, SHP_DOC_LIBRARY
    SOP_FOLDER_PATH       (optional — sub-folder scope)

  OneDrive (source_type="onedrive"):
    OD_ID_APP, OD_ID_APP_SECRET, OD_TENANT_ID, OD_TENANT, OD_USER_EMAIL
    OD_FOLDER             (optional — sub-folder scope; root if unset)

  Confluence (source_type="confluence"):
    CF_DOMAIN, CF_EMAIL, CF_API_TOKEN, CF_SPACE_KEY

Optional per-source overrides:
    <PREFIX>_SOP_SOURCE_NAME      (defaults to the spec's default_name)
    SOP_PARSER_BACKEND            (shared; defaults to "docling")

Secret values are Fernet-encrypted before being stored in
`IngestionSource.config` (requires `ENCRYPTION_KEY`); the matching fetcher
decrypts them on read.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime

from sqlmodel import Session, select

from src.database.database import engine
from src.database.models import IngestionSource
from src.utils.secrets import encrypt_secret

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _SourceSpec:
    """Declarative description of one env-bootstrappable source type."""

    source_type: str
    required_keys: tuple[str, ...]
    default_name: str
    optional_keys: tuple[str, ...] = ()
    secret_keys: frozenset[str] = field(default_factory=frozenset)
    # Env var that overrides this source's IngestionSource.source_name.
    name_env: str = ""


# One spec per source type. Config keys mirror the corresponding connector.
_SOURCE_SPECS: tuple[_SourceSpec, ...] = (
    _SourceSpec(
        source_type="sharepoint",
        required_keys=(
            "SHP_ID_APP",
            "SHP_ID_APP_SECRET",
            "SHP_TENANT_ID",
            "SHP_SITE_URL",
            "SHP_DOC_LIBRARY",
        ),
        optional_keys=("SOP_FOLDER_PATH",),
        secret_keys=frozenset({"SHP_ID_APP_SECRET"}),
        default_name="Local SOP Source",
        name_env="SOP_SOURCE_NAME",
    ),
    _SourceSpec(
        source_type="onedrive",
        required_keys=(
            "OD_ID_APP",
            "OD_ID_APP_SECRET",
            "OD_TENANT_ID",
            "OD_TENANT",
            "OD_USER_EMAIL",
        ),
        optional_keys=("OD_FOLDER",),
        secret_keys=frozenset({"OD_ID_APP_SECRET"}),
        default_name="OneDrive SOP Source",
        name_env="OD_SOP_SOURCE_NAME",
    ),
    _SourceSpec(
        source_type="confluence",
        required_keys=(
            "CF_DOMAIN",
            "CF_EMAIL",
            "CF_API_TOKEN",
            "CF_SPACE_KEY",
        ),
        secret_keys=frozenset({"CF_API_TOKEN"}),
        default_name="Confluence SOP Source",
        name_env="CF_SOP_SOURCE_NAME",
    ),
)


def _config_entry(key: str, secret_keys: frozenset[str]) -> dict[str, str]:
    """One {name, value} config item, encrypting the value if it is a secret."""
    value = os.environ[key]
    if key in secret_keys:
        value = encrypt_secret(value)
    return {"name": key, "value": value}


def _bootstrap_spec(spec: _SourceSpec, parser_backend: str) -> bool:
    """Upsert one IngestionSource from env for ``spec``. Returns True if done."""
    missing = [key for key in spec.required_keys if not os.getenv(key)]
    if missing:
        logger.info(
            "Env SOP source '%s' not configured (missing: %s); skipping.",
            spec.source_type,
            ", ".join(missing),
        )
        return False

    name = (
        os.getenv(spec.name_env, spec.default_name)
        if spec.name_env
        else (spec.default_name)
    )
    config = [_config_entry(key, spec.secret_keys) for key in spec.required_keys]
    config += [
        _config_entry(key, spec.secret_keys)
        for key in spec.optional_keys
        if os.getenv(key)
    ]

    with Session(engine) as session:
        row = session.exec(
            select(IngestionSource).where(IngestionSource.source_name == name)
        ).first()
        if row is None:
            row = IngestionSource(source_name=name)
            session.add(row)
        row.source_type = spec.source_type
        row.parser_backend = parser_backend
        row.config = config
        row.is_enabled = True
        row.updated_at = datetime.now()
        session.commit()

    logger.info(
        "Bootstrapped IngestionSource '%s' (source_type=%s, parser_backend=%s, "
        "%d config keys).",
        name,
        spec.source_type,
        parser_backend,
        len(config),
    )
    return True


def bootstrap_ingestion_sources_from_env() -> None:
    """Upsert one IngestionSource per configured source type, from env."""
    parser_backend = os.getenv("SOP_PARSER_BACKEND", "docling")
    bootstrapped = sum(_bootstrap_spec(spec, parser_backend) for spec in _SOURCE_SPECS)
    if not bootstrapped:
        logger.info("No env SOP sources configured; bootstrap is a no-op.")
