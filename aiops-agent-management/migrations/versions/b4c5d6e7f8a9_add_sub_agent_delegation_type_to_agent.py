"""add sub_agent_delegation_type to agent

Revision ID: b4c5d6e7f8a9
Revises: d197dc52643d
Create Date: 2026-06-30 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b4c5d6e7f8a9"
down_revision: str | Sequence[str] | None = "d197dc52643d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "agent")
    if "sub_agent_delegation_type" not in cols:
        op.add_column(
            "agent",
            sa.Column(
                "sub_agent_delegation_type",
                sa.String(),
                nullable=False,
                server_default="task",
            ),
        )


def downgrade() -> None:
    op.drop_column("agent", "sub_agent_delegation_type")
