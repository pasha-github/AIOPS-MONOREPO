"""add SOP ingestion/retrieval tables

Creates the data-plane (sop_document, sop_section, sop_element,
sop_section_embedding) and control-plane (ingestion_source, ingested_document)
tables for the two-pass SOP pipeline.

- No tenant_id anywhere: single-tenant-per-deployment (matches the rest of the
  schema). Per-user visibility is enforced at retrieval (JWT + sop_reader role).
- `sop_element` is the verbatim citation/edit unit; `sop_section` is the
  retrieval/embedding unit.
- `embedding` is a real pgvector `vector(SOP_EMBEDDING_DIM)` column on Postgres
  (with an HNSW cosine ANN index); on SQLite it falls back to JSON. The `vector`
  extension is created before the table so the column type resolves.
- pg_trgm trigram GIN index on sop_section.trigger_text (PostgreSQL only).

Revision ID: c4d5e6f7a8b9
Revises: a7b8c9d0e1f2
Create Date: 2026-06-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op
from pgvector.sqlalchemy import Vector

from src.utils.constants import SOP_EMBEDDING_DIM

# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    # pgvector's `vector` type must exist before the embedding column is created.
    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- Data plane -------------------------------------------------------
    if not inspector.has_table("sop_document"):
        op.create_table(
            "sop_document",
            sa.Column("sop_document_id", sa.Uuid(), nullable=False),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column(
                "groundtruth_hash",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.Column(
                "normalization_status",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="fallback_flat",
            ),
            sa.Column("slug", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("sop_document_id"),
        )
        op.create_index("ix_sop_document_slug", "sop_document", ["slug"], unique=True)

    if not inspector.has_table("sop_section"):
        op.create_table(
            "sop_section",
            sa.Column("sop_section_id", sa.Uuid(), nullable=False),
            sa.Column("sop_document_id", sa.Uuid(), nullable=False),
            sa.Column("section_index", sa.Integer(), nullable=False),
            sa.Column(
                "title_element_ref",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.Column(
                "content_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=True
            ),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column(
                "trigger_text", sqlmodel.sql.sqltypes.AutoString(), nullable=True
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["sop_document_id"],
                ["sop_document.sop_document_id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("sop_section_id"),
            sa.UniqueConstraint(
                "sop_document_id", "section_index", name="uq_sop_section_order"
            ),
        )
        op.create_index(
            "ix_sop_section_sop_document_id", "sop_section", ["sop_document_id"]
        )

    if not inspector.has_table("sop_element"):
        op.create_table(
            "sop_element",
            sa.Column("sop_element_id", sa.Uuid(), nullable=False),
            sa.Column("sop_section_id", sa.Uuid(), nullable=False),
            sa.Column(
                "element_ref", sqlmodel.sql.sqltypes.AutoString(), nullable=False
            ),
            sa.Column("element_index", sa.Integer(), nullable=False),
            sa.Column("char_start", sa.Integer(), nullable=True),
            sa.Column("char_end", sa.Integer(), nullable=True),
            sa.Column("label", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("text", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("prov_json", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["sop_section_id"],
                ["sop_section.sop_section_id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("sop_element_id"),
            sa.UniqueConstraint(
                "sop_section_id", "element_index", name="uq_sop_element_order"
            ),
        )
        op.create_index(
            "ix_sop_element_sop_section_id", "sop_element", ["sop_section_id"]
        )

    if not inspector.has_table("sop_section_embedding"):
        op.create_table(
            "sop_section_embedding",
            sa.Column("sop_section_embedding_id", sa.Uuid(), nullable=False),
            sa.Column("sop_section_id", sa.Uuid(), nullable=False),
            sa.Column(
                "embedding_model",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
            ),
            sa.Column("dim", sa.Integer(), nullable=False),
            sa.Column(
                "embedding",
                sa.JSON().with_variant(Vector(SOP_EMBEDDING_DIM), "postgresql"),
                nullable=False,
            ),
            sa.Column(
                "source_text_hash",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["sop_section_id"],
                ["sop_section.sop_section_id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("sop_section_embedding_id"),
            sa.UniqueConstraint(
                "sop_section_id", "embedding_model", name="uq_sop_embedding_model"
            ),
        )
        op.create_index(
            "ix_sop_section_embedding_sop_section_id",
            "sop_section_embedding",
            ["sop_section_id"],
        )

    # --- Control plane ----------------------------------------------------
    if not inspector.has_table("ingestion_source"):
        op.create_table(
            "ingestion_source",
            sa.Column("ingestion_source_id", sa.Uuid(), nullable=False),
            sa.Column(
                "source_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False
            ),
            sa.Column(
                "source_type",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="sharepoint",
            ),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column(
                "parser_backend",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="docling",
            ),
            sa.Column(
                "is_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("True"),
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("ingestion_source_id"),
        )

    if not inspector.has_table("ingested_document"):
        op.create_table(
            "ingested_document",
            sa.Column("ingested_document_id", sa.Uuid(), nullable=False),
            sa.Column("sop_document_id", sa.Uuid(), nullable=False),
            sa.Column("ingestion_source_id", sa.Uuid(), nullable=False),
            sa.Column("path", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("file_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("mime_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("source_modified", sa.DateTime(), nullable=True),
            sa.Column("size", sa.Integer(), nullable=True),
            sa.Column("version", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("last_ingested_at", sa.DateTime(), nullable=True),
            sa.Column(
                "ingest_status",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="pending",
            ),
            sa.Column(
                "ingest_error", sqlmodel.sql.sqltypes.AutoString(), nullable=True
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["sop_document_id"],
                ["sop_document.sop_document_id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["ingestion_source_id"],
                ["ingestion_source.ingestion_source_id"],
                ondelete="RESTRICT",
            ),
            sa.PrimaryKeyConstraint("ingested_document_id"),
            sa.UniqueConstraint(
                "ingestion_source_id", "path", name="uq_sop_source_location"
            ),
            sa.UniqueConstraint("sop_document_id", name="uq_ingested_document_doc"),
        )
        op.create_index(
            "ix_ingested_document_sop_document_id",
            "ingested_document",
            ["sop_document_id"],
        )
        op.create_index(
            "ix_ingested_document_ingestion_source_id",
            "ingested_document",
            ["ingestion_source_id"],
        )

    # PostgreSQL-only indexes. On SQLite (default dev/CI DB) these are skipped;
    # trigger_text is searched with LIKE and embeddings via in-app cosine.
    if is_postgres:
        # Trigram fuzzy search on trigger_text (pg_trgm GIN).
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_sop_section_trigger_text_trgm "
            "ON sop_section USING gin (trigger_text gin_trgm_ops)"
        )
        # HNSW cosine ANN index on the embedding vector (pgvector).
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_sop_section_embedding_hnsw "
            "ON sop_section_embedding USING hnsw (embedding vector_cosine_ops)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_sop_section_embedding_hnsw")
        op.execute("DROP INDEX IF EXISTS ix_sop_section_trigger_text_trgm")

    for table in (
        "ingested_document",
        "ingestion_source",
        "sop_section_embedding",
        "sop_element",
        "sop_section",
        "sop_document",
    ):
        if inspector.has_table(table):
            op.drop_table(table)
