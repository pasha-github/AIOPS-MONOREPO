"""add_bedrock_agentcore_deployment_fields

Revision ID: b7a4c9d2e1f3
Revises: 8de4d2f6b981
Create Date: 2026-05-03 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7a4c9d2e1f3"
down_revision: str | Sequence[str] | None = "8de4d2f6b981"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")

    if "bedrock_agentcore_resource_arn" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "bedrock_agentcore_resource_arn",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "bedrock_agentcore_deployment_status" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "bedrock_agentcore_deployment_status",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "bedrock_agentcore_deployment_error" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "bedrock_agentcore_deployment_error",
                sa.Text(),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("agent", "bedrock_agentcore_deployment_error")
    op.drop_column("agent", "bedrock_agentcore_deployment_status")
    op.drop_column("agent", "bedrock_agentcore_resource_arn")
