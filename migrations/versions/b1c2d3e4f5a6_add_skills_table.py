"""add_skills_table

Revision ID: b1c2d3e4f5a6
Revises: 9b2a4f7c1d88
Create Date: 2026-04-26 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | Sequence[str] | None = "9b2a4f7c1d88"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("skill"):
        op.create_table(
            "skill",
            sa.Column("skill_id", sa.Uuid(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column(
                "description", sqlmodel.sql.sqltypes.AutoString(), nullable=False
            ),
            sa.Column(
                "instructions", sqlmodel.sql.sqltypes.AutoString(), nullable=False
            ),
            sa.Column("tools", sa.JSON(), nullable=False),
            sa.Column("references", sa.JSON(), nullable=False),
            sa.Column("assets", sa.JSON(), nullable=False),
            sa.Column("scripts", sa.JSON(), nullable=False),
            sa.Column("connector_config_ids", sa.JSON(), nullable=False),
            sa.Column("mcp_server_ids", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("skill_id"),
        )

    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")
    if "skill_ids" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "skill_ids",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            ),
        )
        op.alter_column("agent", "skill_ids", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "skill_ids" in _column_names(inspector, "agent"):
        op.drop_column("agent", "skill_ids")

    if inspector.has_table("skill"):
        op.drop_table("skill")
