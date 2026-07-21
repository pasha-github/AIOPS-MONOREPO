"""add memory fields to agent

Revision ID: e6f7a8b9c0d1
Revises: 664dcc32acac
Create Date: 2026-06-05 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: str | Sequence[str] | None = "664dcc32acac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "agent")
    if "memory_enabled" not in cols:
        op.add_column(
            "agent",
            sa.Column(
                "memory_enabled",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
        )
    if "memory_tool_type" not in cols:
        op.add_column(
            "agent",
            sa.Column("memory_tool_type", sa.String(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("agent", "memory_tool_type")
    op.drop_column("agent", "memory_enabled")
