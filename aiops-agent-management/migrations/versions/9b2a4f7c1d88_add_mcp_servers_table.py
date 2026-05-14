"""add_mcp_servers_table

Revision ID: 9b2a4f7c1d88
Revises: c3f4b2d1e6a7
Create Date: 2026-04-15 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b2a4f7c1d88"
down_revision: str | Sequence[str] | None = "c3f4b2d1e6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("mcpserver"):
        op.create_table(
            "mcpserver",
            sa.Column("mcp_server_id", sa.Uuid(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("server_url", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("auth_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column(
                "auth_username", sqlmodel.sql.sqltypes.AutoString(), nullable=True
            ),
            sa.Column("auth_secret", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column("tools_json", sa.JSON(), nullable=False),
            sa.Column("resources_json", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("mcp_server_id"),
        )

    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")
    if "mcp_server_ids" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "mcp_server_ids",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            ),
        )
        op.alter_column("agent", "mcp_server_ids", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "mcp_server_ids" in _column_names(inspector, "agent"):
        op.drop_column("agent", "mcp_server_ids")

    if inspector.has_table("mcpserver"):
        op.drop_table("mcpserver")
