"""add agent_file table and knowledge_file_ids to agent

Revision ID: a1b2c3d4e5f7
Revises: f8a9b0c1d2e3
Create Date: 2026-06-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f7"
down_revision: str | Sequence[str] | None = "f8a9b0c1d2e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "agent_file" not in _table_names(inspector):
        op.create_table(
            "agent_file",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("content_type", sa.String(), nullable=False),
            sa.Column("size", sa.Integer(), nullable=False),
            sa.Column("content", sa.LargeBinary(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    cols = _column_names(inspector, "agent")
    if "knowledge_file_ids" not in cols:
        op.add_column(
            "agent",
            sa.Column(
                "knowledge_file_ids", sa.JSON(), nullable=True, server_default="[]"
            ),
        )


def downgrade() -> None:
    op.drop_table("agent_file")
    op.drop_column("agent", "knowledge_file_ids")
