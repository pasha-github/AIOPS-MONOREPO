"""add section_type to sop_section

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-06-26

Adds a nullable ``section_type`` column to ``sop_section`` to distinguish
table and image sibling sections from ordinary text sections.  Values:
  NULL / absent  → text section (default; kept NULL to keep the column sparse)
  "table"        → a table's rows extracted from Docling ``tables[]``
  "image"        → an image caption/placeholder from Docling ``pictures[]``

No index is added — the column is low-cardinality and not part of any query
filter today.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("sop_section"):
        existing_cols = {c["name"] for c in inspector.get_columns("sop_section")}
        if "section_type" not in existing_cols:
            op.add_column(
                "sop_section",
                sa.Column("section_type", sa.String(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("sop_section"):
        existing_cols = {c["name"] for c in inspector.get_columns("sop_section")}
        if "section_type" in existing_cols:
            op.drop_column("sop_section", "section_type")
