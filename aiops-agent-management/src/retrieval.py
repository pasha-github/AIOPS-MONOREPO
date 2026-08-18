"""SOP retrieval — the read path shared by the REST endpoints and the
agent-facing DocumentConnector. The agent's only path to text is by id.

- ``search_sop`` — **hybrid**: exact/substring ``trigger_text``/``title`` match
  (so error codes like ``AMQ9524E`` rank deterministically) fused with semantic
  cosine. Returns section ids + metadata, never raw text. Search is dialect-aware:
  pgvector ``<=>`` over the HNSW index on Postgres, brute-force Python cosine on
  SQLite (dev/CI).
- ``get_sop_section`` — one section, whole, rendered from its elements in order.
- ``list_sop_sections`` — a document's sections by id (ids + titles only).

Single-tenant per deployment; per-user access control (JWT groups + the
``sop_reader`` DB role) is planned at this layer, not yet enforced.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, text
from sqlmodel import Session, col, select

from src.database.database import engine as default_engine
from src.database.models import (
    IngestedDocument,
    IngestionSource,
    SopDocument,
    SopElement,
    SopSection,
    SopSectionEmbedding,
)
from src.embedding import Embedder, cosine_similarity, resolve_embedder

logger = logging.getLogger(__name__)


def _source_map(
    session: Session, sop_document_ids: Sequence[str | UUID]
) -> dict[str, dict[str, Any]]:
    """Map sop_document_id → its source attribution, for citation.

    Read at retrieval time by joining the control plane (``ingested_document`` ⋈
    ``ingestion_source``) rather than denormalizing onto ``sop_document`` — so no
    extra columns / migration. Returns ``source_type`` (sharepoint | onedrive |
    confluence), ``source_name`` (the IngestionSource label), and ``source_uri``
    (the document's path/page-id within the source). Documents with no
    provenance row simply don't appear in the map.
    """
    ids = [UUID(str(i)) for i in sop_document_ids]
    if not ids:
        return {}
    rows = session.exec(
        select(IngestedDocument, IngestionSource)
        .join(
            IngestionSource,
            col(IngestedDocument.ingestion_source_id)
            == IngestionSource.ingestion_source_id,
        )
        .where(col(IngestedDocument.sop_document_id).in_(ids))
    ).all()
    return {
        str(ingested.sop_document_id): {
            "source_type": source.source_type,
            "source_name": source.source_name,
            "source_uri": ingested.path,
            "web_url": ingested.web_url,
        }
        for ingested, source in rows
    }


def _empty_source() -> dict[str, Any]:
    return {
        "source_type": None,
        "source_name": None,
        "source_uri": None,
        "web_url": None,
    }


def search_sop(
    query: str,
    top_k: int = 3,
    *,
    embedder: Embedder | None = None,
    engine=None,
) -> list[dict[str, Any]]:
    """Return up to ``top_k`` candidate sections for a query (ids + metadata).

    Hybrid ranking, in tiers so a literal trigger hit is deterministic:
      2 — exact ``trigger_text``/``title`` match (e.g. an error code)
      1 — substring keyword match on ``trigger_text``/``title``
      0 — semantic only
    Within a tier, higher cosine wins. ``match`` is ``hybrid`` (keyword tier +
    a semantic score), ``keyword``, or ``semantic``.
    """
    embedder = embedder or resolve_embedder()
    engine = engine or default_engine
    query_vec = embedder.embed([query])[0]
    # Pull a few extra semantic candidates so a keyword hit that is also
    # embedded still gets its cosine score (labelled "hybrid").
    pool = max(top_k * 5, 20)

    with Session(engine) as session:
        candidates: dict[str, dict[str, Any]] = {}

        # --- Semantic: pgvector HNSW ANN on Postgres, Python cosine on SQLite. ---
        for cand in _semantic_candidates(session, engine, embedder, query_vec, pool):
            candidates[cand["sop_section_id"]] = cand

        # --- Keyword/trigger: first-class, covers sections without a vector. ---
        for section, doc in _keyword_rows(session, query):
            sid = str(section.sop_section_id)
            cand = candidates.get(sid) or _candidate(section, doc)
            candidates[sid] = cand
            cand["tier"] = max(cand.get("tier", 0), _keyword_tier(query, section))

        if not candidates:
            return []

        ranked = sorted(
            candidates.values(),
            key=lambda c: (c.get("tier", 0), c.get("semantic") or 0.0),
            reverse=True,
        )[:top_k]

        # Attach a short preview so the caller (agent) can rerank/verify the
        # candidates from the search response without fetching each full section.
        snippets = _section_snippets(
            session, [UUID(c["sop_section_id"]) for c in ranked]
        )
        # Attach source attribution (one join over the ranked docs) so the agent
        # can cite origin straight from a search hit, no follow-up lookup.
        sources = _source_map(session, [c["sop_document_id"] for c in ranked])
        results = []
        for cand in ranked:
            cand.update(sources.get(cand["sop_document_id"], _empty_source()))
            presented = _present(cand)
            presented["snippet"] = snippets.get(cand["sop_section_id"], "")
            results.append(presented)
        return results


def _semantic_candidates(
    session: Session,
    engine,
    embedder: Embedder,
    query_vec: list[float],
    pool: int,
) -> list[dict[str, Any]]:
    """Top semantic candidates for the active model, ranked by cosine.

    PostgreSQL: pgvector ``<=>`` ordered + LIMIT, served by the HNSW index.
    SQLite (dev/CI): load the model's vectors and score in Python.
    """
    if engine.dialect.name == "postgresql":
        vec_literal = "[" + ",".join(repr(float(x)) for x in query_vec) + "]"
        rows = (
            session.execute(
                text(
                    "SELECT s.sop_section_id AS sop_section_id, "
                    "s.sop_document_id AS sop_document_id, "
                    "d.title AS document_title, s.title AS title, "
                    "s.section_type AS section_type, "
                    "s.trigger_text AS trigger_text, "
                    "1 - (e.embedding <=> CAST(:qvec AS vector)) AS score "
                    "FROM sop_section_embedding e "
                    "JOIN sop_section s ON e.sop_section_id = s.sop_section_id "
                    "JOIN sop_document d ON s.sop_document_id = d.sop_document_id "
                    "WHERE e.embedding_model = :model "
                    "ORDER BY e.embedding <=> CAST(:qvec AS vector) "
                    "LIMIT :pool"
                ),
                {"qvec": vec_literal, "model": embedder.model_name, "pool": pool},
            )
            .mappings()
            .all()
        )
        return [
            {
                "sop_section_id": str(r["sop_section_id"]),
                "sop_document_id": str(r["sop_document_id"]),
                "document_title": r["document_title"],
                "title": r["title"],
                "section_type": r["section_type"] or "text",
                "trigger_text": r["trigger_text"],
                "semantic": round(float(r["score"]), 4),
                "tier": 0,
            }
            for r in rows
        ]

    # SQLite: brute-force cosine in Python.
    sem_rows = session.exec(
        select(SopSectionEmbedding, SopSection, SopDocument)
        .join(
            SopSection,
            col(SopSectionEmbedding.sop_section_id) == SopSection.sop_section_id,
        )
        .join(
            SopDocument,
            col(SopSection.sop_document_id) == SopDocument.sop_document_id,
        )
        .where(SopSectionEmbedding.embedding_model == embedder.model_name)
    ).all()
    out: list[dict[str, Any]] = []
    for emb, section, doc in sem_rows:
        cand = _candidate(section, doc)
        cand["semantic"] = round(cosine_similarity(query_vec, emb.embedding), 4)
        out.append(cand)
    return out


def _section_snippets(
    session: Session, section_ids: list[UUID], max_chars: int = 240
) -> dict[str, str]:
    """Short text preview per section (its first elements, in order, truncated).

    Lets the agent rerank/verify search candidates from the result alone.
    """
    if not section_ids:
        return {}
    rows = session.exec(
        select(SopElement.sop_section_id, SopElement.text)
        .where(col(SopElement.sop_section_id).in_(section_ids))
        .order_by(col(SopElement.sop_section_id), col(SopElement.element_index))
    ).all()
    acc: dict[str, str] = {}
    for sid, txt in rows:
        key = str(sid)
        current = acc.get(key, "")
        if len(current) >= max_chars:
            continue
        acc[key] = f"{current} {txt}".strip() if current else (txt or "")
    return {
        key: (text[:max_chars].rstrip() + "…") if len(text) > max_chars else text
        for key, text in acc.items()
    }


def _candidate(section: SopSection, doc: SopDocument) -> dict[str, Any]:
    return {
        "sop_section_id": str(section.sop_section_id),
        "sop_document_id": str(doc.sop_document_id),
        "document_title": doc.title,
        "title": section.title,
        "section_type": section.section_type or "text",
        "trigger_text": section.trigger_text,
        "semantic": None,
        "tier": 0,
    }


def _present(c: dict[str, Any]) -> dict[str, Any]:
    has_keyword = c.get("tier", 0) > 0
    has_semantic = c.get("semantic") is not None
    match = (
        "hybrid"
        if has_keyword and has_semantic
        else "keyword"
        if has_keyword
        else "semantic"
    )
    return {
        "sop_section_id": c["sop_section_id"],
        "sop_document_id": c["sop_document_id"],
        "document_title": c["document_title"],
        # Source attribution so the agent can cite origin straight from a search
        # hit, without a follow-up lookup.
        "source_type": c.get("source_type"),
        "source_name": c.get("source_name"),
        "source_uri": c.get("source_uri"),
        "web_url": c.get("web_url"),
        "title": c["title"],
        "section_type": c.get("section_type", "text"),
        "trigger_text": c["trigger_text"],
        "score": c.get("semantic"),
        "match": match,
    }


def _keyword_rows(session: Session, query: str):
    """Sections whose trigger_text/title contain the whole query (case-insensitive)."""
    needle = f"%{query.strip().lower()}%"
    return session.exec(
        select(SopSection, SopDocument)
        .join(
            SopDocument, col(SopSection.sop_document_id) == SopDocument.sop_document_id
        )
        .where(
            or_(
                func.lower(SopSection.trigger_text).like(needle),
                func.lower(SopSection.title).like(needle),
            )
        )
    ).all()


def _keyword_tier(query: str, section: SopSection) -> int:
    """2 = exact (whole field, or one of comma-separated triggers); 1 = substring."""
    needle = query.strip().lower()
    fields = [section.trigger_text or "", section.title or ""]
    for field in fields:
        tokens = [t.strip().lower() for t in field.split(",")]
        if needle == field.strip().lower() or needle in tokens:
            return 2
    return 1


def list_documents(*, engine=None) -> list[dict[str, Any]]:
    """List all SOP documents (id, title, slug, normalization status)."""
    engine = engine or default_engine
    with Session(engine) as session:
        docs = session.exec(select(SopDocument).order_by(SopDocument.title)).all()
        sources = _source_map(session, [d.sop_document_id for d in docs])
        return [
            {
                "sop_document_id": str(d.sop_document_id),
                "title": d.title,
                "slug": d.slug,
                **sources.get(str(d.sop_document_id), _empty_source()),
                "normalization_status": d.normalization_status,
            }
            for d in docs
        ]


def get_sop_section(
    sop_section_id: str,
    element_ids: list[str] | None = None,
    *,
    engine=None,
) -> dict[str, Any] | None:
    """Return a whole section rendered from its elements, or None if missing."""
    engine = engine or default_engine
    with Session(engine) as session:
        section = session.get(SopSection, UUID(sop_section_id))
        if section is None:
            return None
        doc = session.get(SopDocument, section.sop_document_id)
        elements = session.exec(
            select(SopElement)
            .where(SopElement.sop_section_id == section.sop_section_id)
            .order_by(col(SopElement.element_index))
        ).all()
        # Source attribution via the control-plane join (no denormalized columns).
        source = _source_map(session, [section.sop_document_id]).get(
            str(section.sop_document_id), _empty_source()
        )

    if element_ids:
        wanted = set(element_ids)
        elements = [e for e in elements if e.element_ref in wanted]

    return {
        "sop_section_id": str(section.sop_section_id),
        "sop_document_id": str(section.sop_document_id),
        # Source attribution so the answer can be cited as
        # "<source_name> (<source_type>) > <document_title> > <section title>".
        "document_title": doc.title if doc else None,
        "source_type": source["source_type"],
        "source_name": source["source_name"],
        "source_uri": source["source_uri"],
        "web_url": source.get("web_url"),
        "title": section.title,
        "section_type": section.section_type or "text",
        "trigger_text": section.trigger_text,
        "markdown": _render_markdown(section.title, elements),
        "elements": [
            {
                "element_ref": e.element_ref,
                "element_index": e.element_index,
                "label": e.label,
                "text": e.text,
            }
            for e in elements
        ],
    }


def list_sop_sections(sop_document_id: str, *, engine=None) -> list[dict[str, Any]]:
    """List a document's sections (ids + titles + element refs); no raw text."""
    engine = engine or default_engine
    with Session(engine) as session:
        doc_uuid = UUID(sop_document_id)
        sections = session.exec(
            select(SopSection)
            .where(SopSection.sop_document_id == doc_uuid)
            .order_by(col(SopSection.section_index))
        ).all()
        result = []
        for section in sections:
            refs = session.exec(
                select(SopElement.element_ref)
                .where(SopElement.sop_section_id == section.sop_section_id)
                .order_by(col(SopElement.element_index))
            ).all()
            result.append(
                {
                    "sop_section_id": str(section.sop_section_id),
                    "section_index": section.section_index,
                    "title": section.title,
                    "trigger_text": section.trigger_text,
                    "element_refs": list(refs),
                }
            )
        return result


def _render_markdown(title: str | None, elements: Sequence[SopElement]) -> str:
    """Render elements as GitHub-flavoured markdown.

    Non-table elements are separated by blank lines (``\\n\\n``). Table rows
    are accumulated into a single block with single-newline separators so that
    GFM renders them as a real table (GFM requires consecutive lines with no
    blank lines between rows).
    """
    blocks: list[str] = []  # each block is \n\n-separated from the next
    table_buf: list[str] = []  # accumulated table rows (joined with \n inside)

    def _flush_table() -> None:
        if table_buf:
            blocks.append("\n".join(table_buf))
            table_buf.clear()

    i = 0
    while i < len(elements):
        el = elements[i]
        if el.label == "section_header":
            _flush_table()
            blocks.append(f"## {el.text}")
        elif el.label == "list_item":
            _flush_table()
            blocks.append(f"- {el.text}")
        elif el.label == "table_header":
            table_buf.append(f"| {el.text} |")
            # Emit GFM separator after the last consecutive header row.
            next_el = elements[i + 1] if i + 1 < len(elements) else None
            if next_el is None or next_el.label != "table_header":
                col_count = el.text.count("|") + 1
                table_buf.append("| " + " | ".join(["---"] * col_count) + " |")
        elif el.label == "table_row":
            table_buf.append(f"| {el.text} |")
        elif el.label in ("image_caption", "image_placeholder"):
            _flush_table()
            blocks.append(f"*{el.text}*")
        else:
            _flush_table()
            blocks.append(el.text)
        i += 1

    _flush_table()

    if not blocks and title:
        blocks.append(f"## {title}")
    return "\n\n".join(blocks)
