"""Tests for the embedder, embedding storage, retrieval service, and the
env-based IngestionSource bootstrap. No live model/SharePoint calls — the
deterministic HashingEmbedder is used throughout."""

from __future__ import annotations

from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine, select

from src import retrieval
from src.database.models import (
    IngestedDocument,
    IngestionSource,
    SopSection,
    SopSectionEmbedding,
)
from src.embedding import HashingEmbedder, cosine_similarity
from src.ingestion.bootstrap import (
    _SOURCE_SPECS,
    bootstrap_ingestion_sources_from_env,
)
from src.ingestion.normalizer import FlatNormalizer
from src.ingestion.parser import PassthroughParser
from src.ingestion.storage import DbStorage
from src.ingestion.types import DocumentRef, FetchedDocument
from src.utils.secrets import decrypt_secret


def _mem_engine():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return engine


def _ingest(
    engine, source_id, *, slug_content, version="v1", embedder=None, web_url=None
):
    ref = DocumentRef(
        source_id=source_id,
        path=f"/Shared/{slug_content['name']}",
        name=slug_content["name"],
        mime_type="text/markdown",
        version=version,
        web_url=web_url,
    )
    fetched = FetchedDocument(ref=ref, content=slug_content["body"], encoding="utf-8")
    parsed = FlatNormalizer().normalize(PassthroughParser().parse(fetched))
    DbStorage(engine, embedder=embedder).upsert(parsed)
    return parsed


def _source(engine) -> str:
    with Session(engine) as s:
        src = IngestionSource(source_name="sp", source_type="sharepoint")
        s.add(src)
        s.commit()
        s.refresh(src)
        return str(src.ingestion_source_id)


# --------------------------------------------------------------------------- #
# Embedder
# --------------------------------------------------------------------------- #
def test_hashing_embedder_is_deterministic_and_normalized():
    a = HashingEmbedder().embed(["queue manager unavailable"])[0]
    b = HashingEmbedder().embed(["queue manager unavailable"])[0]
    assert a == b  # stable across instances/runs (hashlib, not built-in hash())
    assert abs(cosine_similarity(a, a) - 1.0) < 1e-9


def test_cosine_ranks_lexically_related_text_higher():
    emb = HashingEmbedder()
    q = emb.embed(["queue manager is down"])[0]
    related = emb.embed(["restart the stopped queue manager"])[0]
    unrelated = emb.embed(["clean up disk space on the server"])[0]
    assert cosine_similarity(q, related) > cosine_similarity(q, unrelated)


# --------------------------------------------------------------------------- #
# Storage writes embeddings
# --------------------------------------------------------------------------- #
def test_storage_writes_one_embedding_per_section():
    engine = _mem_engine()
    sid = _source(engine)
    _ingest(
        engine,
        sid,
        slug_content={
            "name": "MQ.md",
            "body": "# AMQ9524E\nCheck QMs.\n# Resolution\nRestart.",
        },
        embedder=HashingEmbedder(),
    )
    with Session(engine) as s:
        embs = s.exec(select(SopSectionEmbedding)).all()
        sections = s.exec(select(SopSection)).all()
    assert len(embs) == len(sections) == 2
    assert embs[0].embedding_model == "hashing-384"
    assert embs[0].dim == 384 and len(embs[0].embedding) == 384


def test_storage_skips_embeddings_when_embedder_none():
    engine = _mem_engine()
    sid = _source(engine)
    _ingest(
        engine,
        sid,
        slug_content={"name": "MQ.md", "body": "# A\nbody"},
        embedder=None,
    )
    with Session(engine) as s:
        assert s.exec(select(SopSectionEmbedding)).all() == []


# --------------------------------------------------------------------------- #
# pgvector dialect-aware embedding column
# --------------------------------------------------------------------------- #
def test_embedding_column_is_vector_on_postgres_json_on_sqlite():
    from sqlalchemy.dialects import postgresql, sqlite

    from src.database.models import SopSectionEmbedding

    col_type = SopSectionEmbedding.__table__.c.embedding.type
    pg_ddl = col_type.compile(dialect=postgresql.dialect()).upper()
    sqlite_ddl = col_type.compile(dialect=sqlite.dialect()).upper()
    assert "VECTOR(1536)" in pg_ddl  # real pgvector on Postgres
    assert "JSON" in sqlite_ddl  # transparent fallback on SQLite


# --------------------------------------------------------------------------- #
# Retrieval service
# --------------------------------------------------------------------------- #
def test_search_sop_semantic_ranks_relevant_section_first():
    engine = _mem_engine()
    sid = _source(engine)
    emb = HashingEmbedder()
    _ingest(
        engine,
        sid,
        slug_content={
            "name": "MQ.md",
            "body": "# AMQ9524E queue manager unavailable\nRestart the queue manager.",
        },
        embedder=emb,
    )
    _ingest(
        engine,
        sid,
        slug_content={
            "name": "Disk.md",
            "body": "# Disk space cleanup\nDelete old logs to free disk space.",
        },
        embedder=emb,
    )

    results = retrieval.search_sop(
        "queue manager is down", top_k=3, embedder=emb, engine=engine
    )
    assert results
    assert results[0]["match"] == "semantic"
    assert "queue manager" in (results[0]["title"] or "").lower()
    assert results[0]["snippet"]  # preview text attached for agent reranking


def test_search_sop_keyword_fallback_when_no_matching_embeddings():
    engine = _mem_engine()
    sid = _source(engine)
    # store with one model, query with a different-dim model -> no semantic rows
    _ingest(
        engine,
        sid,
        slug_content={"name": "MQ.md", "body": "# AMQ9524E\nRestart."},
        embedder=HashingEmbedder(dim=384),
    )
    results = retrieval.search_sop(
        "AMQ9524E", top_k=3, embedder=HashingEmbedder(dim=256), engine=engine
    )
    assert results and results[0]["match"] == "keyword"


def test_search_sop_trigger_match_ranks_first_as_hybrid():
    """An exact trigger hit (error code) outranks merely-similar sections and is
    labelled 'hybrid' when the section also carries an embedding."""
    engine = _mem_engine()
    sid = _source(engine)
    emb = HashingEmbedder()
    _ingest(
        engine,
        sid,
        slug_content={"name": "MQ.md", "body": "# AMQ9524E\nRestart the channel."},
        embedder=emb,
    )
    _ingest(
        engine,
        sid,
        slug_content={"name": "Disk.md", "body": "# Disk cleanup\nFree disk space."},
        embedder=emb,
    )
    results = retrieval.search_sop("AMQ9524E", top_k=3, embedder=emb, engine=engine)
    assert results
    assert results[0]["match"] == "hybrid"  # trigger tier + semantic score
    assert "AMQ9524E" in (results[0]["title"] or "")


def test_get_and_list_sections():
    engine = _mem_engine()
    sid = _source(engine)
    _ingest(
        engine,
        sid,
        slug_content={
            "name": "MQ.md",
            "body": "# AMQ9524E\nCheck QMs.\n# Resolution\nRestart.",
        },
        embedder=HashingEmbedder(),
    )
    docs = retrieval.list_documents(engine=engine)
    assert len(docs) == 1
    sections = retrieval.list_sop_sections(docs[0]["sop_document_id"], engine=engine)
    assert len(sections) == 2
    assert sections[0]["element_refs"]

    section = retrieval.get_sop_section(sections[0]["sop_section_id"], engine=engine)
    assert section is not None
    assert "AMQ9524E" in section["markdown"]
    assert section["elements"][0]["element_index"] == 0

    assert retrieval.get_sop_section(str(uuid4()), engine=engine) is None


# --------------------------------------------------------------------------- #
# Source attribution (agent cites which source/document an answer came from)
# --------------------------------------------------------------------------- #
def _source_named(engine, *, source_name: str, source_type: str) -> str:
    with Session(engine) as s:
        src = IngestionSource(source_name=source_name, source_type=source_type)
        s.add(src)
        s.commit()
        s.refresh(src)
        return str(src.ingestion_source_id)


def test_source_attribution_flows_through_to_retrieval():
    """Source attribution is read by retrieval via a join over the control plane
    (ingested_document ⋈ ingestion_source) — no denormalized columns — and
    surfaced by every read path: search_sop, get_sop_section, list_documents.
    source_type/source_name come from IngestionSource; source_uri and web_url
    come from IngestedDocument (populated by the fetcher at ingest time)."""
    engine = _mem_engine()
    sid = _source_named(
        engine, source_name="Engineering Wiki", source_type="confluence"
    )
    emb = HashingEmbedder()
    doc_web_url = "https://company.atlassian.net/wiki/spaces/PROJ/pages/12345"
    _ingest(
        engine,
        sid,
        slug_content={
            "name": "CO.docx",
            "body": "# Cost Impact Analysis\nTotal change cost is $52,800.",
        },
        embedder=emb,
        web_url=doc_web_url,
    )
    uri = "/Shared/CO.docx"  # _ingest builds path as /Shared/<name>

    # list_documents
    docs = retrieval.list_documents(engine=engine)
    assert docs[0]["source_type"] == "confluence"
    assert docs[0]["source_name"] == "Engineering Wiki"
    assert docs[0]["source_uri"] == uri
    assert docs[0]["web_url"] == doc_web_url

    # search_sop
    results = retrieval.search_sop(
        "Cost Impact Analysis", top_k=3, embedder=emb, engine=engine
    )
    assert results
    top = results[0]
    assert top["source_type"] == "confluence"
    assert top["source_name"] == "Engineering Wiki"
    assert top["source_uri"] == uri
    assert top["web_url"] == doc_web_url
    assert top["document_title"]  # doc title also exposed for citation

    # get_sop_section
    section = retrieval.get_sop_section(top["sop_section_id"], engine=engine)
    assert section["source_type"] == "confluence"
    assert section["source_name"] == "Engineering Wiki"
    assert section["source_uri"] == uri
    assert section["web_url"] == doc_web_url
    assert section["document_title"]


# --------------------------------------------------------------------------- #
# Re-ingestion: id stability + failure provenance
# --------------------------------------------------------------------------- #
def test_reingest_unchanged_content_preserves_ids_and_embeddings():
    engine = _mem_engine()
    sid = _source(engine)
    body = {"name": "MQ.md", "body": "# AMQ9524E\nCheck QMs.\n# Resolution\nRestart."}
    _ingest(engine, sid, slug_content=body, embedder=HashingEmbedder())
    with Session(engine) as s:
        sec_ids = {str(x) for x in s.exec(select(SopSection.sop_section_id)).all()}
        emb_ids = {
            str(x)
            for x in s.exec(select(SopSectionEmbedding.sop_section_embedding_id)).all()
        }

    # Identical content again: sections/elements/embeddings must be kept as-is.
    _ingest(engine, sid, slug_content=body, version="v2", embedder=HashingEmbedder())
    with Session(engine) as s:
        assert {
            str(x) for x in s.exec(select(SopSection.sop_section_id)).all()
        } == sec_ids
        assert {
            str(x)
            for x in s.exec(select(SopSectionEmbedding.sop_section_embedding_id)).all()
        } == emb_ids
        assert len(s.exec(select(SopSection)).all()) == 2  # no duplication


def test_reingest_changed_content_replaces_sections():
    engine = _mem_engine()
    sid = _source(engine)
    _ingest(
        engine,
        sid,
        slug_content={"name": "MQ.md", "body": "# AMQ9524E\nCheck QMs."},
        embedder=HashingEmbedder(),
    )
    with Session(engine) as s:
        old_ids = {str(x) for x in s.exec(select(SopSection.sop_section_id)).all()}

    _ingest(
        engine,
        sid,
        slug_content={"name": "MQ.md", "body": "# AMQ9524E\nRestart the channel now."},
        version="v2",
        embedder=HashingEmbedder(),
    )
    with Session(engine) as s:
        new_ids = {str(x) for x in s.exec(select(SopSection.sop_section_id)).all()}
        assert new_ids.isdisjoint(old_ids)  # changed content → fresh rows
        section = retrieval.get_sop_section(next(iter(new_ids)), engine=engine)
        assert "Restart the channel now." in section["markdown"]


def test_record_failure_marks_existing_row():
    engine = _mem_engine()
    sid = _source(engine)
    parsed = _ingest(
        engine, sid, slug_content={"name": "MQ.md", "body": "# A\nbody"}, embedder=None
    )
    DbStorage(engine, embedder=None).record_failure(parsed.ref, "parse blew up")
    with Session(engine) as s:
        row = s.exec(select(IngestedDocument)).first()
    assert row.ingest_status == "error"
    assert row.ingest_error == "parse blew up"
    assert row.last_ingested_at is not None


def test_record_failure_is_noop_when_never_ingested():
    engine = _mem_engine()
    sid = _source(engine)
    ref = DocumentRef(source_id=sid, path="/never-seen.pdf")
    DbStorage(engine, embedder=None).record_failure(ref, "boom")  # must not raise
    with Session(engine) as s:
        assert s.exec(select(IngestedDocument)).all() == []


# --------------------------------------------------------------------------- #
# Env bootstrap
# --------------------------------------------------------------------------- #
def _clear_all_source_env(monkeypatch):
    """Clear every source-spec env var so a test isn't perturbed by a real .env.

    Bootstrap reads keys for several source types (SharePoint, OneDrive,
    Confluence); a test that only sets one type must clear the others or they
    leak in from the developer's shell / .env.
    """
    monkeypatch.delenv("SOP_SOURCE_NAME", raising=False)
    monkeypatch.delenv("SOP_PARSER_BACKEND", raising=False)
    for spec in _SOURCE_SPECS:
        for key in (*spec.required_keys, *spec.optional_keys):
            monkeypatch.delenv(key, raising=False)
        if spec.name_env:
            monkeypatch.delenv(spec.name_env, raising=False)


def test_bootstrap_creates_source_from_env_and_is_idempotent(monkeypatch):
    engine = _mem_engine()
    monkeypatch.setattr("src.ingestion.bootstrap.engine", engine)
    _clear_all_source_env(monkeypatch)
    for key, val in {
        "SHP_ID_APP": "app",
        "SHP_ID_APP_SECRET": "secret",
        "SHP_TENANT_ID": "tenant",
        "SHP_SITE_URL": "https://x.sharepoint.com/sites/y",
        "SHP_DOC_LIBRARY": "Docs",
        "SOP_SOURCE_NAME": "Local SOP Source",
        "SOP_PARSER_BACKEND": "docling",
    }.items():
        monkeypatch.setenv(key, val)

    bootstrap_ingestion_sources_from_env()
    bootstrap_ingestion_sources_from_env()  # idempotent

    with Session(engine) as s:
        rows = s.exec(select(IngestionSource)).all()
    assert len(rows) == 1
    src = rows[0]
    assert src.source_type == "sharepoint" and src.parser_backend == "docling"
    keys = {c["name"] for c in src.config}
    assert {"SHP_ID_APP", "SHP_SITE_URL", "SHP_DOC_LIBRARY"} <= keys

    # The secret is stored Fernet-encrypted (not plaintext) and round-trips.
    secret = next(c["value"] for c in src.config if c["name"] == "SHP_ID_APP_SECRET")
    assert secret != "secret"
    assert decrypt_secret(secret) == "secret"


def test_bootstrap_seeds_multiple_source_types(monkeypatch):
    """OneDrive + Confluence env vars each seed their own source, idempotently."""
    engine = _mem_engine()
    monkeypatch.setattr("src.ingestion.bootstrap.engine", engine)
    _clear_all_source_env(monkeypatch)
    for key, val in {
        "OD_ID_APP": "od-app",
        "OD_ID_APP_SECRET": "od-secret",
        "OD_TENANT_ID": "od-tenant-id",
        "OD_TENANT": "rcyber",
        "OD_USER_EMAIL": "u@rcyber.com",
        "CF_DOMAIN": "rc.atlassian.net",
        "CF_EMAIL": "u@rcyber.com",
        "CF_API_TOKEN": "cf-token",
        "CF_SPACE_KEY": "SOP",
    }.items():
        monkeypatch.setenv(key, val)

    bootstrap_ingestion_sources_from_env()
    bootstrap_ingestion_sources_from_env()  # idempotent

    with Session(engine) as s:
        rows = s.exec(select(IngestionSource)).all()
    by_type = {r.source_type: r for r in rows}
    assert set(by_type) == {"onedrive", "confluence"}

    # Each source's secret is Fernet-encrypted at rest and round-trips.
    od_secret = next(
        c["value"]
        for c in by_type["onedrive"].config
        if c["name"] == "OD_ID_APP_SECRET"
    )
    assert od_secret != "od-secret" and decrypt_secret(od_secret) == "od-secret"
    cf_token = next(
        c["value"] for c in by_type["confluence"].config if c["name"] == "CF_API_TOKEN"
    )
    assert cf_token != "cf-token" and decrypt_secret(cf_token) == "cf-token"


def test_bootstrap_noop_without_env(monkeypatch):
    engine = _mem_engine()
    monkeypatch.setattr("src.ingestion.bootstrap.engine", engine)
    _clear_all_source_env(monkeypatch)
    bootstrap_ingestion_sources_from_env()
    with Session(engine) as s:
        assert s.exec(select(IngestionSource)).all() == []
