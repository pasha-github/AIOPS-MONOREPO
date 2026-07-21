"""add_aws_credentials

Revision ID: f1a2b3c4d5e6
Revises: b7a4c9d2e1f3
Create Date: 2026-05-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "b7a4c9d2e1f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("aws_credential"):
        return

    op.create_table(
        "aws_credential",
        sa.Column("credential_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("access_key_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "secret_access_key",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column("session_token", sa.Text(), nullable=True),
        sa.Column(
            "region",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="us-east-1",
        ),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("credential_id"),
    )


def downgrade() -> None:
    op.drop_table("aws_credential")
