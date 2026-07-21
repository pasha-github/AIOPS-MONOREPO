"""rename_aws_credential_is_active_to_is_default

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = _column_names(inspector, "aws_credential")

    if "is_default" in columns:
        return
    if "is_active" in columns:
        with op.batch_alter_table("aws_credential") as batch_op:
            batch_op.alter_column("is_active", new_column_name="is_default")
        return

    op.add_column(
        "aws_credential",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = _column_names(inspector, "aws_credential")

    if "is_active" in columns:
        return
    if "is_default" in columns:
        with op.batch_alter_table("aws_credential") as batch_op:
            batch_op.alter_column("is_default", new_column_name="is_active")
