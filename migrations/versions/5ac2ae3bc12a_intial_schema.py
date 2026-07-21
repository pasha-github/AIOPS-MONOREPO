"""intial_schema

Revision ID: 5ac2ae3bc12a
Revises:
Create Date: 2026-02-27 01:46:15.686046

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5ac2ae3bc12a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")

    if "type" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "type",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="agent",
            ),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")

    if "type" in agent_columns:
        op.drop_column("agent", "type")

    op.create_table(
        "sessions",
        sa.Column("app_name", sa.TEXT(), nullable=False),
        sa.Column("user_id", sa.TEXT(), nullable=False),
        sa.Column("id", sa.TEXT(), nullable=False),
        sa.Column("state", sa.TEXT(), nullable=False),
        sa.Column("create_time", sa.REAL(), nullable=False),
        sa.Column("update_time", sa.REAL(), nullable=False),
        sa.PrimaryKeyConstraint("app_name", "user_id", "id"),
    )
    op.create_table(
        "app_states",
        sa.Column("app_name", sa.TEXT(), nullable=True),
        sa.Column("state", sa.TEXT(), nullable=False),
        sa.Column("update_time", sa.REAL(), nullable=False),
        sa.PrimaryKeyConstraint("app_name"),
    )
    op.create_table(
        "user_states",
        sa.Column("app_name", sa.TEXT(), nullable=False),
        sa.Column("user_id", sa.TEXT(), nullable=False),
        sa.Column("state", sa.TEXT(), nullable=False),
        sa.Column("update_time", sa.REAL(), nullable=False),
        sa.PrimaryKeyConstraint("app_name", "user_id"),
    )
    op.create_table(
        "events",
        sa.Column("id", sa.TEXT(), nullable=False),
        sa.Column("app_name", sa.TEXT(), nullable=False),
        sa.Column("user_id", sa.TEXT(), nullable=False),
        sa.Column("session_id", sa.TEXT(), nullable=False),
        sa.Column("invocation_id", sa.TEXT(), nullable=False),
        sa.Column("timestamp", sa.REAL(), nullable=False),
        sa.Column("event_data", sa.TEXT(), nullable=False),
        sa.ForeignKeyConstraint(
            ["app_name", "user_id", "session_id"],
            ["sessions.app_name", "sessions.user_id", "sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("app_name", "user_id", "session_id", "id"),
    )
    # ### end Alembic commands ###
