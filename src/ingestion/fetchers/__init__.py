"""Source fetchers for the ingestion subsystem.

Each source type (sharepoint, and later confluence, drive, ...) has its own
fetcher module here. A SOP source selects its fetcher via the
``IngestionSource.source_type`` column (defaults to ``sharepoint``). To add a
source: drop a new module implementing ``BaseSourceFetcher`` and register it in
``_FETCHER_REGISTRY`` below.
"""

from __future__ import annotations

from src.ingestion.fetchers.base import BaseSourceFetcher
from src.ingestion.fetchers.confluence import ConfluenceFetcher
from src.ingestion.fetchers.onedrive import OneDriveGraphFetcher
from src.ingestion.fetchers.sharepoint import SharePointGraphFetcher
from src.ingestion.types import ResolvedSource, SourceFetcher

DEFAULT_SOURCE_TYPE = "sharepoint"

# source type -> fetcher singleton (fetchers cache tokens/site ids per source).
_FETCHER_REGISTRY: dict[str, SourceFetcher] = {
    "sharepoint": SharePointGraphFetcher(),
    "onedrive": OneDriveGraphFetcher(),
    "confluence": ConfluenceFetcher(),
}


def resolve_fetcher(source: ResolvedSource) -> SourceFetcher:
    """Return the fetcher for a source based on its ``source_type``."""
    source_type = (source.source_type or "").strip().lower() or DEFAULT_SOURCE_TYPE
    fetcher = _FETCHER_REGISTRY.get(source_type)
    if fetcher is None:
        raise RuntimeError(
            f"No fetcher registered for source type '{source_type}' "
            f"(source '{source.source_name}')."
        )
    return fetcher


__all__ = [
    "DEFAULT_SOURCE_TYPE",
    "BaseSourceFetcher",
    "ConfluenceFetcher",
    "OneDriveGraphFetcher",
    "SharePointGraphFetcher",
    "resolve_fetcher",
]
