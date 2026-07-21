"""add guardrail fields to agent

Revision ID: f8a9b0c1d2e3
Revises: cee616054f22
Create Date: 2026-06-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f8a9b0c1d2e3"
down_revision: str | Sequence[str] | None = "cee616054f22"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "agent")
    if "guardrail_sensitive_data" not in cols:
        op.add_column(
            "agent",
            sa.Column(
                "guardrail_sensitive_data",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
        )
    if "guardrails_config" not in cols:
        op.add_column(
            "agent",
            sa.Column("guardrails_config", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("agent", "guardrails_config")
    op.drop_column("agent", "guardrail_sensitive_data")
