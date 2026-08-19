"""add_web_url_to_ingested_document

Revision ID: e2a3b4c5d6f7
Revises: d197dc52643d
Create Date: 2026-06-30

Adds web_url to ingested_document so retrieval can surface a direct browser link
to the source document (SharePoint webUrl, OneDrive webUrl, Confluence _links.webui)
without joining across the encrypted control-plane config at query time.

Existing rows get NULL (no back-fill needed; the next ingestion run updates
the column for every document via _upsert_ingested, which always runs even for
content-unchanged skips).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2a3b4c5d6f7"
down_revision: str | Sequence[str] | None = "b4c5d6e7f8a9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c["name"] for c in inspector.get_columns("ingested_document")]
    if "web_url" not in cols:
        op.add_column(
            "ingested_document",
            sa.Column("web_url", sa.String(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("ingested_document", "web_url")
