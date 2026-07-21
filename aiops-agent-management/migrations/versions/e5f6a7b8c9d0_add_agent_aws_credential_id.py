"""add_agent_aws_credential_id

Revision ID: e5f6a7b8c9d0
Revises: f1a2b3c4d5e6
Create Date: 2026-05-18 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("agent")}
    if "aws_credential_id" in columns:
        return

    op.add_column("agent", sa.Column("aws_credential_id", sa.Uuid(), nullable=True))
    if bind.dialect.name == "sqlite":
        return

    op.create_foreign_key(
        "fk_agent_aws_credential_id_aws_credential",
        "agent",
        "aws_credential",
        ["aws_credential_id"],
        ["credential_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("agent")}
    if "aws_credential_id" not in columns:
        return

    if bind.dialect.name != "sqlite":
        op.drop_constraint(
            "fk_agent_aws_credential_id_aws_credential",
            "agent",
            type_="foreignkey",
        )
    op.drop_column("agent", "aws_credential_id")
