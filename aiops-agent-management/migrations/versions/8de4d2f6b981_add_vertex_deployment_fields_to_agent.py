"""add_vertex_deployment_fields_to_agent

Revision ID: 8de4d2f6b981
Revises: c3f4b2d1e6a7
Create Date: 2026-04-10 20:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8de4d2f6b981"
down_revision: str | Sequence[str] | None = "c3f4b2d1e6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")

    if "deployment_target" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "deployment_target",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="adk",
            ),
        )
    if "vertex_resource_name" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "vertex_resource_name",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "vertex_deployment_status" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "vertex_deployment_status",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "vertex_deployment_error" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "vertex_deployment_error",
                sa.Text(),
                nullable=True,
            ),
        )

    op.execute(sa.text("UPDATE agent SET deployment_target = 'adk'"))
    if bind.dialect.name != "sqlite":
        op.alter_column("agent", "deployment_target", server_default=None)


def downgrade() -> None:
    op.drop_column("agent", "vertex_deployment_error")
    op.drop_column("agent", "vertex_deployment_status")
    op.drop_column("agent", "vertex_resource_name")
    op.drop_column("agent", "deployment_target")
