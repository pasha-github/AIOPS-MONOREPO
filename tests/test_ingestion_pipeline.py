"""Unit tests for the SOP ingestion pipeline (Pass 1 + flat Pass 2 + storage).

Covers the three implemented points without any live Docling/SharePoint calls:
- DoclingParser response->element mapping (against the saved fixture).
- FlatNormalizer sectioning.
- DbStorage upsert + re-ingest idempotency + change detection.
- IngestionManager fetch->parse->normalize->store via injected seams.
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from src.database.models import (
    IngestedDocument,
    IngestionSource,
    SopDocument,
    SopElement,
    SopSection,
)
from src.ingestion.docling_processor import DoclingParser
from src.ingestion.manager import IngestionManager
from src.ingestion.normalizer import FlatNormalizer
from src.ingestion.parser import PassthroughParser
from src.ingestion.storage import DbStorage
from src.ingestion.types import (
    DocumentRef,
    FetchedDocument,
    ParsedDocument,
    ResolvedSource,
)

FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "ingestion"
    / "docling_test_results.json"
)

# docling_test_results.json is a gitignored local Docling dump, so it is not
# present on a clean checkout / CI. Tests that load it skip when it is absent;
# the parser/normalizer logic is also covered fixture-free in test_normalizer.py.
requires_fixture = pytest.mark.skipif(
    not FIXTURE.exists(),
    reason="docling_test_results.json not present (gitignored local fixture)",
)


def _ref(source_id: str, version: str = "etag1") -> DocumentRef:
    return DocumentRef(
        source_id=source_id,
        path="/Shared/SOP - MQ.pdf",
        name="SOP - MQ.pdf",
        mime_type="application/pdf",
        modified="2026-06-01T10:00:00Z",
        size=1234,
        version=version,
    )


def _mem_engine():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return engine


# --------------------------------------------------------------------------- #
# Pass 1 — Docling response mapping
# --------------------------------------------------------------------------- #
@requires_fixture
def test_docling_parser_maps_fixture_to_elements():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    fetched = FetchedDocument(ref=_ref(str(uuid4())), content=b"", encoding="utf-8")

    parsed = DoclingParser()._to_parsed_document(fetched, payload)

    assert len(parsed.elements) == 15
    assert parsed.elements[0].label == "section_header"
    assert parsed.elements[0].element_ref == "#/texts/0"
    assert parsed.elements[0].text.startswith("AMQ9524E")
    assert parsed.elements[0].prov.get("page_no") == 1
    # title = first heading; slug derived from file name
    assert parsed.title.startswith("AMQ9524E")
    assert parsed.slug == "sop-mq"
    assert len(parsed.groundtruth_hash) == 64  # hex sha-256


@requires_fixture
def test_groundtruth_hash_is_deterministic():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    fetched = FetchedDocument(ref=_ref(str(uuid4())), content=b"", encoding="utf-8")
    a = DoclingParser()._to_parsed_document(fetched, payload)
    b = DoclingParser()._to_parsed_document(fetched, payload)
    assert a.groundtruth_hash == b.groundtruth_hash


# --------------------------------------------------------------------------- #
# Pass 2 — flat normalizer
# --------------------------------------------------------------------------- #
@requires_fixture
def test_flat_normalizer_splits_on_headings_and_preserves_elements():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    fetched = FetchedDocument(ref=_ref(str(uuid4())), content=b"", encoding="utf-8")
    parsed = DoclingParser()._to_parsed_document(fetched, payload)

    normalized = FlatNormalizer().normalize(parsed)

    # fixture has 7 section_header elements -> 7 sections (no lead element)
    assert len(normalized.sections) == 7
    assert normalized.normalization_status == "fallback_flat"
    # every element ends up in exactly one section (nothing dropped/duplicated)
    total = sum(len(s.elements) for s in normalized.sections)
    assert total == len(parsed.elements)
    first = normalized.sections[0]
    assert first.title_element_ref == "#/texts/0"
    assert first.trigger_text.startswith("AMQ9524E")
    assert first.content_hash and len(first.content_hash) == 64


def test_flat_normalizer_lead_section_when_no_leading_heading():
    ref = _ref(str(uuid4()))
    # plain text, no heading -> a single untitled lead section
    fetched = FetchedDocument(ref=ref, content="line one\nline two", encoding="utf-8")
    parsed = PassthroughParser().parse(fetched)
    normalized = FlatNormalizer().normalize(parsed)
    assert len(normalized.sections) == 1
    assert normalized.sections[0].title is None


# --------------------------------------------------------------------------- #
# Point 3 — DB storage
# --------------------------------------------------------------------------- #
def _normalized_doc(source_id: str, version: str = "etag1") -> ParsedDocument:
    ref = _ref(source_id, version=version)
    fetched = FetchedDocument(
        ref=ref,
        content="# AMQ9524E\nCheck queue managers.\n# Resolution\nRestart.",
        encoding="utf-8",
    )
    return FlatNormalizer().normalize(PassthroughParser().parse(fetched))


def test_db_storage_upsert_persists_full_chain():
    engine = _mem_engine()
    with Session(engine) as s:
        src = IngestionSource(source_name="sp", source_type="sharepoint")
        s.add(src)
        s.commit()
        s.refresh(src)
        source_id = str(src.ingestion_source_id)

    storage = DbStorage(engine)
    assert storage.existing_version(_ref(source_id)) is None  # never seen

    storage.upsert(_normalized_doc(source_id))

    with Session(engine) as s:
        docs = s.exec(select(SopDocument)).all()
        sections = s.exec(select(SopSection)).all()
        elements = s.exec(select(SopElement)).all()
        ingested = s.exec(select(IngestedDocument)).one()
    assert len(docs) == 1
    assert docs[0].groundtruth_hash and docs[0].normalization_status == "fallback_flat"
    assert len(sections) == 2  # two headings
    assert len(elements) == 4  # 2 headings + 2 body lines
    assert ingested.version == "etag1"
    assert ingested.ingest_status == "ingested"
    assert ingested.sop_document_id == docs[0].sop_document_id

    # change detection now reports the stored token
    assert storage.existing_version(_ref(source_id)) == "etag1"


def test_db_storage_reingest_is_idempotent():
    engine = _mem_engine()
    with Session(engine) as s:
        src = IngestionSource(source_name="sp", source_type="sharepoint")
        s.add(src)
        s.commit()
        s.refresh(src)
        source_id = str(src.ingestion_source_id)

    storage = DbStorage(engine)
    storage.upsert(_normalized_doc(source_id, version="etag1"))
    storage.upsert(_normalized_doc(source_id, version="etag2"))  # re-ingest

    with Session(engine) as s:
        assert len(s.exec(select(SopDocument)).all()) == 1  # same doc (by slug)
        assert len(s.exec(select(SopSection)).all()) == 2  # replaced, not duplicated
        assert len(s.exec(select(SopElement)).all()) == 4
        assert s.exec(select(IngestedDocument)).one().version == "etag2"


# --------------------------------------------------------------------------- #
# Identity is (source, path) — same filename across sources stays distinct
# --------------------------------------------------------------------------- #
def _doc_at(
    source_id: str, path: str, name: str, body: str, version: str = "etag1"
) -> ParsedDocument:
    ref = DocumentRef(
        source_id=source_id,
        path=path,
        name=name,
        mime_type="application/pdf",
        modified="2026-06-01T10:00:00Z",
        size=1234,
        version=version,
        web_url=f"https://example.test/{name}",
    )
    fetched = FetchedDocument(ref=ref, content=body, encoding="utf-8")
    return FlatNormalizer().normalize(PassthroughParser().parse(fetched))


def _source(engine, name: str, kind: str) -> str:
    with Session(engine) as s:
        src = IngestionSource(source_name=name, source_type=kind)
        s.add(src)
        s.commit()
        s.refresh(src)
        return str(src.ingestion_source_id)


def test_multi_source_same_name_are_distinct_documents():
    """Same filename in two sources with different content -> two documents."""
    engine = _mem_engine()
    sp_id = _source(engine, "sp", "sharepoint")
    od_id = _source(engine, "od", "onedrive")

    storage = DbStorage(engine)
    storage.upsert(
        _doc_at(sp_id, "/HR/Policy.docx", "Policy.docx", "# Leave\nSP text.")
    )
    storage.upsert(
        _doc_at(
            od_id, "/Ops/Policy.docx", "Policy.docx", "# Leave\nOD differs.\n# X\ny"
        )
    )

    with Session(engine) as s:
        docs = s.exec(select(SopDocument)).all()
        ingested = s.exec(select(IngestedDocument)).all()
        slugs = sorted(d.slug for d in docs)
        # each document keeps its own sections
        per_doc = {
            d.slug: len(
                s.exec(
                    select(SopSection).where(
                        SopSection.sop_document_id == d.sop_document_id
                    )
                ).all()
            )
            for d in docs
        }

    assert len(docs) == 2  # not collapsed into one
    assert slugs == ["policy", "policy-2"]  # slug disambiguated on create
    assert len(ingested) == 2
    assert {i.ingestion_source_id for i in ingested} == {UUID(sp_id), UUID(od_id)}
    assert {i.web_url for i in ingested} == {"https://example.test/Policy.docx"}
    assert all(count >= 1 for count in per_doc.values())


def test_reingest_same_source_path_updates_in_place():
    """Re-ingesting the same (source, path) updates the existing doc, no new row."""
    engine = _mem_engine()
    sp_id = _source(engine, "sp", "sharepoint")

    storage = DbStorage(engine)
    storage.upsert(_doc_at(sp_id, "/HR/Policy.docx", "Policy.docx", "# A\nx", "v1"))
    storage.upsert(
        _doc_at(sp_id, "/HR/Policy.docx", "Policy.docx", "# A\ny changed", "v2")
    )

    with Session(engine) as s:
        assert len(s.exec(select(SopDocument)).all()) == 1
        assert s.exec(select(IngestedDocument)).one().version == "v2"


def test_same_source_same_name_different_path_are_distinct():
    """Two same-named docs at different paths in ONE source stay distinct."""
    engine = _mem_engine()
    sp_id = _source(engine, "sp", "sharepoint")

    storage = DbStorage(engine)
    storage.upsert(_doc_at(sp_id, "/HR/Policy.docx", "Policy.docx", "# A\nx"))
    storage.upsert(_doc_at(sp_id, "/Finance/Policy.docx", "Policy.docx", "# B\ny"))

    with Session(engine) as s:
        assert len(s.exec(select(SopDocument)).all()) == 2
        assert len(s.exec(select(IngestedDocument)).all()) == 2


# --------------------------------------------------------------------------- #
# Manager — fetch -> parse -> normalize -> store
# --------------------------------------------------------------------------- #
class _FakeFetcher:
    def __init__(self, refs: list[DocumentRef]):
        self._refs = refs

    def list_documents(self, source):
        return self._refs

    def fetch_document(self, source, ref):
        return FetchedDocument(
            ref=ref, content="# AMQ9524E\nCheck QMs.", encoding="utf-8"
        )


def test_manager_run_source_ingests_via_seams():
    engine = _mem_engine()
    with Session(engine) as s:
        src = IngestionSource(source_name="sp", source_type="sharepoint")
        s.add(src)
        s.commit()
        s.refresh(src)
        source_id = str(src.ingestion_source_id)

    fetcher = _FakeFetcher([_ref(source_id)])
    manager = IngestionManager(
        fetcher_resolver=lambda source: fetcher,
        parser_resolver=lambda backend: PassthroughParser(),
        storage=DbStorage(engine),
    )
    resolved = ResolvedSource(
        source_id=source_id,
        source_name="sp",
        source_type="sharepoint",
        config=[],
        parser_backend="passthrough",
    )

    result = manager._run_source(resolved)

    assert result.discovered == 1
    assert result.stored == 1
    assert result.error is None
    with Session(engine) as s:
        assert len(s.exec(select(SopDocument)).all()) == 1
        assert len(s.exec(select(SopSection)).all()) >= 1

    # second run with the same version is skipped (change detection)
    result2 = manager._run_source(resolved)
    assert result2.skipped == 1 and result2.stored == 0


def test_manager_stop_after_discover_lists_without_storing(monkeypatch):
    """INGEST_STOP_AFTER=discover lists documents and halts before fetch/store."""
    monkeypatch.setenv("INGEST_STOP_AFTER", "discover")
    engine = _mem_engine()
    with Session(engine) as s:
        src = IngestionSource(source_name="sp", source_type="sharepoint")
        s.add(src)
        s.commit()
        s.refresh(src)
        source_id = str(src.ingestion_source_id)

    manager = IngestionManager(
        fetcher_resolver=lambda source: _FakeFetcher([_ref(source_id)]),
        parser_resolver=lambda backend: PassthroughParser(),
        storage=DbStorage(engine),
    )
    resolved = ResolvedSource(
        source_id=source_id,
        source_name="sp",
        source_type="sharepoint",
        config=[],
        parser_backend="passthrough",
    )

    result = manager._run_source(resolved)

    assert result.discovered == 1
    assert result.changed == 0 and result.stored == 0  # halted before fetch
    with Session(engine) as s:
        assert s.exec(select(SopDocument)).all() == []  # nothing persisted
