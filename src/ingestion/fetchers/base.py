"""Abstract source fetcher.

One concrete implementation per source type (SharePoint, and later Confluence,
Google Drive, ...). Fetchers are self-contained: they read their credentials
from the ``ResolvedSource.config`` and talk to the source API directly, so the
ingestion subsystem does not depend on any agent-facing connector.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from src.ingestion.types import DocumentRef, FetchedDocument, ResolvedSource


class BaseSourceFetcher(ABC):
    """Base class for source fetchers (structurally a ``SourceFetcher``)."""

    @staticmethod
    def config_value(source: ResolvedSource, name: str, default: str = "") -> str:
        """Read a single config value by name from a source's config list."""
        for item in source.config:
            if item.get("name") == name:
                value = item.get("value")
                return value if value is not None else default
        return default

    @staticmethod
    def config_signature(source: ResolvedSource) -> tuple:
        """A hashable signature of a source's config, for cache invalidation."""
        return tuple(
            sorted((item.get("name"), item.get("value")) for item in source.config)
        )

    @abstractmethod
    def list_documents(self, source: ResolvedSource) -> list[DocumentRef]: ...

    @abstractmethod
    def fetch_document(
        self, source: ResolvedSource, ref: DocumentRef
    ) -> FetchedDocument: ...
