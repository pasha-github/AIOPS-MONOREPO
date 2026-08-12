"""Pure contracts for the SOP ingestion subsystem.

This module holds only dataclasses, enums and Protocol seams. It imports no
I/O, no FastAPI and no DB so the ingestion package can later be lifted into a
standalone service without dragging the management API along.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Protocol, runtime_checkable


class TriggerSource(str, Enum):
    """The four entry points that can start an ingestion run."""

    STARTUP = "startup"
    REST = "rest"
    AGENT = "agent"
    SCHEDULED = "scheduled"


class IngestionState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass
class ResolvedSource:
    """An ``IngestionSource`` row resolved into the inputs a fetcher needs.

    ``source_id`` is the ``ingestion_source_id``. ``source_type`` selects the
    fetcher (sharepoint, confluence, …); ``parser_backend`` selects the parser.
    """

    source_id: str
    source_name: str
    source_type: str
    config: list[dict[str, str]]
    parser_backend: str = "docling"


@dataclass
class DocumentRef:
    """A reference to a single document discovered in a source.

    ``version`` is a source-provided change-detection token taken from the
    listing call (e.g. SharePoint's ``cTag`` / ``quickXorHash``, Confluence's
    version number, Drive's ``md5Checksum``). The manager compares it against the
    stored value to decide whether to download the document at all — no content
    hashing required. ``None`` means the source could not supply one, so the
    document is always (re)processed.
    """

    source_id: str
    path: str
    name: str | None = None
    mime_type: str | None = None
    modified: str | None = None
    size: int | None = None
    version: str | None = None
    # Direct browser URL populated by the fetcher (Graph webUrl / Confluence
    # _links.webui). Stored in IngestedDocument so retrieval never touches config.
    web_url: str | None = None


@dataclass
class FetchedDocument:
    """Raw content fetched for a ``DocumentRef``."""

    ref: DocumentRef
    content: bytes | str
    encoding: str
    mime_type: str | None = None


@dataclass
class ParsedElement:
    """One verbatim text unit from Pass 1 (the citation/edit unit).

    ``text`` is copied byte-for-byte from the layout parser and is immutable.
    ``element_ref`` is the parser's stable-within-a-run id (Docling ``self_ref``,
    e.g. ``#/texts/11``); it is NOT unique once Pass 2 splits an element by
    offset (``char_start``/``char_end``).
    """

    element_ref: str
    # section_header | list_item | text | step | table_header | table_row | image_caption | image_placeholder
    label: str
    text: str
    prov: dict[str, Any] = field(default_factory=dict)  # {page_no, bbox}
    char_start: int | None = None
    char_end: int | None = None


@dataclass
class ParsedSection:
    """A retrieval unit: an ordered group of elements (Pass 2 output).

    ``elements`` are the section's elements in order; each becomes a
    ``sop_element`` row with ``element_index`` = its position here.
    """

    section_index: int
    elements: list[ParsedElement] = field(default_factory=list)
    title: str | None = None
    title_element_ref: str | None = None
    trigger_text: str | None = None
    content_hash: str | None = None
    section_type: str = "text"  # "text" | "table" | "image"


@dataclass
class ParsedDocument:
    """Structured output for a fetched document.

    Pass 1 fills ``elements`` (verbatim, reading order) + ``groundtruth_hash``;
    Pass 2 (normalizer) fills ``sections``. Markdown is never stored — it is
    rendered from a section's elements on demand.
    """

    ref: DocumentRef
    title: str
    slug: str
    elements: list[ParsedElement]
    groundtruth_hash: str
    sections: list[ParsedSection] = field(default_factory=list)
    normalization_status: str = "fallback_flat"  # normalized | fallback_flat
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SourceResult:
    """Per-source outcome of an ingestion run."""

    source_id: str
    source_name: str
    source_type: str
    discovered: int = 0
    changed: int = 0
    parsed: int = 0
    stored: int = 0
    skipped: int = 0
    error: str | None = None
    doc_errors: list[str] = field(default_factory=list)


@dataclass
class IngestionSummary:
    """Overall outcome of a single ingestion run."""

    trigger_source: TriggerSource
    started_at: datetime
    finished_at: datetime | None = None
    state: IngestionState = IngestionState.RUNNING
    sources: list[SourceResult] = field(default_factory=list)
    error: str | None = None

    @property
    def total_stored(self) -> int:
        return sum(source.stored for source in self.sources)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trigger_source": self.trigger_source.value,
            "state": self.state.value,
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "total_stored": self.total_stored,
            "error": self.error,
            "sources": [vars(source) for source in self.sources],
        }


# --------------------------------------------------------------------------- #
# Injectable seams. Swap points for fetch (SharePoint -> other sources),
# parse (Docling -> other parsers) and store (log -> DB / vector store).
# --------------------------------------------------------------------------- #
@runtime_checkable
class SourceFetcher(Protocol):
    def list_documents(self, source: ResolvedSource) -> list[DocumentRef]: ...

    def fetch_document(
        self, source: ResolvedSource, ref: DocumentRef
    ) -> FetchedDocument: ...


@runtime_checkable
class Parser(Protocol):
    """Pass 1: layout extraction. Produces verbatim elements (no sections)."""

    def parse(self, doc: FetchedDocument) -> ParsedDocument: ...


@runtime_checkable
class Normalizer(Protocol):
    """Pass 2: groups a document's elements into sections.

    Must not alter element text. The default ``FlatNormalizer`` sections
    deterministically by heading; an LLM normalizer + validator replaces it
    later (still id/structure-only, with id-set + groundtruth-hash validation).
    """

    def normalize(self, doc: ParsedDocument) -> ParsedDocument: ...


@runtime_checkable
class Storage(Protocol):
    def existing_version(self, ref: DocumentRef) -> str | None: ...

    def upsert(self, doc: ParsedDocument) -> bool: ...

    def record_failure(self, ref: DocumentRef, error: str) -> None:
        """Record that a document failed to ingest (fail-soft; never raises)."""
        ...

    def update_metadata(self, ref: DocumentRef) -> None:
        """Backfill mutable metadata (e.g. web_url) for a skipped document (fail-soft)."""
        ...
