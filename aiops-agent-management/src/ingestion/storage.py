"""Storage seam implementations.

``DbStorage`` (the default) persists a normalized document into the SOP tables
in one transaction. Re-ingestion is idempotent:
- **Byte-identical** (``groundtruth_hash`` matches and embeddings for the active
  model exist): existing sections/elements/embeddings are kept untouched, so
  their ids survive re-ingest (citations don't dangle) and re-embedding is skipped.
- **Changed**: sections + elements are delete-and-reinserted (parser refs are
  positional, not stable across a structural change).

``LoggingStorage`` is a no-op stub for dev/tests (persists nothing).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime
from typing import cast
from uuid import UUID

from sqlalchemy import Engine, delete, or_
from sqlmodel import Session, col, select

from src.database.database import engine as default_engine
from src.database.models import (
    IngestedDocument,
    SopDocument,
    SopElement,
    SopSection,
    SopSectionEmbedding,
)
from src.embedding import Embedder, resolve_embedder
from src.ingestion.types import DocumentRef, ParsedDocument

logger = logging.getLogger(__name__)

_UNSET = object()  # distinguishes "use default embedder" from "embeddings off"


class LoggingStorage:
    """Default STUB storage. Persists nothing; logs upserts."""

    def existing_version(self, ref: DocumentRef) -> str | None:
        return None

    def upsert(self, doc: ParsedDocument) -> bool:
        logger.info(
            "LoggingStorage (stub) upsert: path=%s version=%s sections=%d elements=%d",
            doc.ref.path,
            doc.ref.version,
            len(doc.sections),
            len(doc.elements),
        )
        return True

    def record_failure(self, ref: DocumentRef, error: str) -> None:
        logger.info("LoggingStorage (stub) record_failure: path=%s", ref.path)

    def update_metadata(self, ref: DocumentRef) -> None:
        pass


class DbStorage:
    """DB-backed storage writing the SOP tables (atomic per document).

    Pass ``embedder=None`` to skip embedding (e.g. tests); omit it to use the
    env-resolved embedder (``resolve_embedder()``).
    """

    def __init__(
        self, engine: Engine | None = None, embedder: Embedder | object | None = _UNSET
    ) -> None:
        self._engine = engine or default_engine
        self._embedder: Embedder | None = (
            resolve_embedder()
            if embedder is _UNSET
            else cast("Embedder | None", embedder)
        )

    def existing_version(self, ref: DocumentRef) -> str | None:
        """Stored change token for this (source, path), or None if never seen."""
        with Session(self._engine) as session:
            row = session.exec(
                select(IngestedDocument).where(
                    IngestedDocument.ingestion_source_id == UUID(ref.source_id),
                    IngestedDocument.path == ref.path,
                )
            ).first()
            return row.version if row else None

    def upsert(self, doc: ParsedDocument) -> bool:
        source_id = UUID(doc.ref.source_id)
        now = datetime.now()
        with Session(self._engine) as session:
            sop_doc, content_unchanged = self._upsert_document(session, doc, now)
            if content_unchanged:
                # Byte-identical re-ingest: keep existing sections, elements and
                # embeddings (ids preserved, no re-embed cost).
                logger.debug(
                    "[6/embed] doc=%s — content unchanged (groundtruth match): "
                    "kept sections/embeddings, skipped re-embed",
                    doc.slug,
                )
            else:
                vectors = self._embed_sections(doc)
                self._replace_sections(session, sop_doc.sop_document_id, doc, vectors)
            self._upsert_ingested(session, sop_doc.sop_document_id, source_id, doc, now)
            session.commit()
        if not content_unchanged:
            logger.debug(
                "DbStorage upserted doc=%s sections=%d elements=%d status=%s",
                doc.slug,
                len(doc.sections),
                len(doc.elements),
                doc.normalization_status,
            )
        return True

    def record_failure(self, ref: DocumentRef, error: str) -> None:
        """Mark this (source, path) as failed in ``ingested_document``.

        Fail-soft: never raises. No-op if the document has no row yet — a
        never-successfully-ingested doc has no ``SopDocument`` to attach to
        (``sop_document_id`` is NOT NULL), so first-time parse failures are
        reported in the run summary only.
        """
        try:
            with Session(self._engine) as session:
                row = session.exec(
                    select(IngestedDocument).where(
                        IngestedDocument.ingestion_source_id == UUID(ref.source_id),
                        IngestedDocument.path == ref.path,
                    )
                ).first()
                if row is None:
                    return
                now = datetime.now()
                row.ingest_status = "error"
                row.ingest_error = error[:2000]
                row.last_ingested_at = now
                row.updated_at = now
                session.add(row)
                session.commit()
        except Exception:
            logger.warning(
                "Failed to record ingest failure for %s", ref.path, exc_info=True
            )

    def update_metadata(self, ref: DocumentRef) -> None:
        """Update mutable metadata (web_url, last_ingested_at) for a skipped document.

        Called when a version-unchanged document is skipped so that fields added
        after the original ingest (e.g. web_url) are backfilled without
        re-parsing or re-embedding. Fail-soft: never raises.
        """
        try:
            with Session(self._engine) as session:
                row = session.exec(
                    select(IngestedDocument).where(
                        IngestedDocument.ingestion_source_id == UUID(ref.source_id),
                        IngestedDocument.path == ref.path,
                    )
                ).first()
                if row is None:
                    return
                row.web_url = ref.web_url
                row.last_ingested_at = datetime.now()
                session.add(row)
                session.commit()
        except Exception:
            logger.warning("Failed to update metadata for %s", ref.path, exc_info=True)

    # ------------------------------------------------------------------ #
    def _embed_sections(self, doc: ParsedDocument) -> Sequence[list[float] | None]:
        """Embed each section's text (one batched call). Fail-soft: on any
        embedder error, return no vectors so content still persists."""
        if self._embedder is None or not doc.sections:
            return [None] * len(doc.sections)
        texts = [
            "\n".join(el.text for el in section.elements) for section in doc.sections
        ]
        try:
            vectors = list(self._embedder.embed(texts))
            logger.debug(
                "[6/embed] doc=%s — %d section(s) embedded (model=%s, dim=%s)",
                doc.slug,
                len(vectors),
                self._embedder.model_name,
                self._embedder.dim or "?",
            )
            return vectors
        except Exception as exc:
            logger.warning(
                "[6/embed] doc=%s — embedding FAILED (%s); storing sections without vectors",
                doc.slug,
                exc,
            )
            return [None] * len(doc.sections)

    def _upsert_document(
        self, session: Session, doc: ParsedDocument, now: datetime
    ) -> tuple[SopDocument, bool]:
        """Get-or-create the SopDocument; return it plus whether its content is
        byte-identical to what's already stored (so callers can skip the
        section/embedding rewrite).

        Identity is ``(ingestion_source_id, path)``, resolved via the document's
        provenance row — NOT the slug. Two documents that share a filename but
        come from different sources (or different paths within one source) are
        therefore distinct SopDocuments, each independently retrievable and
        citable. The filename-derived slug is only a display label; it is
        de-duplicated on create (``policy``, ``policy-2``, …) to satisfy the
        global unique constraint.
        """
        source_id = UUID(doc.ref.source_id)
        existing_ref = session.exec(
            select(IngestedDocument).where(
                IngestedDocument.ingestion_source_id == source_id,
                IngestedDocument.path == doc.ref.path,
            )
        ).first()
        sop_doc = (
            session.get(SopDocument, existing_ref.sop_document_id)
            if existing_ref is not None
            else None
        )
        is_new = sop_doc is None
        prior_groundtruth = None if is_new else sop_doc.groundtruth_hash
        if sop_doc is None:
            sop_doc = SopDocument(
                title=doc.title, slug=self._unique_slug(session, doc.slug)
            )
            session.add(sop_doc)
            session.flush()  # assign PK

        content_unchanged = self._content_unchanged(
            session, sop_doc, doc, is_new, prior_groundtruth
        )
        sop_doc.title = doc.title
        sop_doc.groundtruth_hash = doc.groundtruth_hash
        sop_doc.updated_at = now
        # Only advance normalization_status when we actually rebuild sections —
        # otherwise the status could claim "normalized" over kept flat sections.
        if not content_unchanged:
            sop_doc.normalization_status = doc.normalization_status
        session.flush()
        return sop_doc, content_unchanged

    def _unique_slug(self, session: Session, base: str) -> str:
        """Return ``base`` if free, else the first free ``base-N`` (N>=2).

        The slug is a display label with a global unique constraint; identity is
        ``(source, path)``, so same-named docs from different sources coexist as
        ``policy``, ``policy-2``, ``policy-3``.
        """
        taken = set(
            session.exec(
                select(SopDocument.slug).where(
                    or_(
                        col(SopDocument.slug) == base,
                        col(SopDocument.slug).like(f"{base}-%"),
                    )
                )
            ).all()
        )
        if base not in taken:
            return base
        i = 2
        while f"{base}-{i}" in taken:
            i += 1
        return f"{base}-{i}"

    def _content_unchanged(
        self,
        session: Session,
        sop_doc: SopDocument,
        doc: ParsedDocument,
        is_new: bool,
        prior_groundtruth: str | None,
    ) -> bool:
        """True only if the stored document is byte-identical AND already fully
        persisted (has sections, and embeddings for the active model unless
        embedding is disabled). Conservative: any doubt → False → full rewrite."""
        if (
            is_new
            or not doc.groundtruth_hash
            or prior_groundtruth != doc.groundtruth_hash
        ):
            return False
        section_ids = session.exec(
            select(SopSection.sop_section_id).where(
                SopSection.sop_document_id == sop_doc.sop_document_id
            )
        ).all()
        if not section_ids:
            return False
        if self._embedder is not None:
            has_embedding = session.exec(
                select(SopSectionEmbedding.sop_section_embedding_id).where(
                    col(SopSectionEmbedding.sop_section_id).in_(section_ids),
                    SopSectionEmbedding.embedding_model == self._embedder.model_name,
                )
            ).first()
            if has_embedding is None:
                return False
        return True

    def _replace_sections(
        self,
        session: Session,
        sop_document_id: UUID,
        doc: ParsedDocument,
        vectors: Sequence[list[float] | None],
    ) -> None:
        # Delete-and-reinsert: child-first, explicit (no reliance on FK cascade).
        section_ids = session.exec(
            select(SopSection.sop_section_id).where(
                SopSection.sop_document_id == sop_document_id
            )
        ).all()
        if section_ids:
            session.execute(
                delete(SopSectionEmbedding).where(
                    col(SopSectionEmbedding.sop_section_id).in_(section_ids)
                )
            )
            session.execute(
                delete(SopElement).where(
                    col(SopElement.sop_section_id).in_(section_ids)
                )
            )
            session.execute(
                delete(SopSection).where(
                    col(SopSection.sop_document_id) == sop_document_id
                )
            )

        for section, vector in zip(doc.sections, vectors, strict=False):
            sop_section = SopSection(
                sop_document_id=sop_document_id,
                section_index=section.section_index,
                title=section.title,
                title_element_ref=section.title_element_ref,
                trigger_text=section.trigger_text,
                content_hash=section.content_hash,
                # Store None for the default "text" type to keep the column sparse.
                section_type=section.section_type
                if section.section_type != "text"
                else None,
            )
            session.add(sop_section)
            session.flush()  # assign sop_section_id
            for element_index, el in enumerate(section.elements):
                session.add(
                    SopElement(
                        sop_section_id=sop_section.sop_section_id,
                        element_ref=el.element_ref,
                        element_index=element_index,
                        char_start=el.char_start,
                        char_end=el.char_end,
                        label=el.label,
                        text=el.text,
                        prov_json=el.prov or {},
                    )
                )
            if vector is not None and self._embedder is not None:
                session.add(
                    SopSectionEmbedding(
                        sop_section_id=sop_section.sop_section_id,
                        embedding_model=self._embedder.model_name,
                        dim=self._embedder.dim or len(vector),
                        embedding=vector,
                        source_text_hash=section.content_hash,
                    )
                )

    def _upsert_ingested(
        self,
        session: Session,
        sop_document_id: UUID,
        source_id: UUID,
        doc: ParsedDocument,
        now: datetime,
    ) -> None:
        ref = doc.ref
        # Identity is (source, path). Each (source, path) owns its own
        # SopDocument, so there is exactly one provenance row per document and
        # a plain insert never collides with uq_ingested_document_doc.
        row = session.exec(
            select(IngestedDocument).where(
                IngestedDocument.ingestion_source_id == source_id,
                IngestedDocument.path == ref.path,
            )
        ).first()
        if row is None:
            row = IngestedDocument(
                sop_document_id=sop_document_id,
                ingestion_source_id=source_id,
                path=ref.path,
                file_name=ref.name or ref.path.rsplit("/", 1)[-1],
            )
            session.add(row)
        row.sop_document_id = sop_document_id
        row.file_name = ref.name or row.file_name
        row.mime_type = ref.mime_type
        row.source_modified = _parse_dt(ref.modified)
        row.size = ref.size
        row.version = ref.version
        row.web_url = ref.web_url
        row.last_ingested_at = now
        row.ingest_status = "ingested"
        row.ingest_error = None
        row.updated_at = now


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
