"""add vertex config table

Revision ID: e7a9c2d4f1b3
Revises: d4e5f6a7b8c9
Create Date: 2026-05-14 18:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7a9c2d4f1b3"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("vertex_config"):
        return

    op.create_table(
        "vertex_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("staging_bucket", sa.String(), nullable=False),
        sa.Column("service_account_json", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("vertex_config"):
        op.drop_table("vertex_config")
