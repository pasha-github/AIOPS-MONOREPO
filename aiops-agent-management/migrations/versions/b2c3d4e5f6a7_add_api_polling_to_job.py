"""add api polling fields to job

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-06-23 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "job")

    if "url" not in cols:
        op.add_column("job", sa.Column("url", sa.String(), nullable=True))
    if "method" not in cols:
        op.add_column(
            "job",
            sa.Column("method", sa.String(), nullable=False, server_default="GET"),
        )
    if "headers" not in cols:
        op.add_column("job", sa.Column("headers", sa.JSON(), nullable=True))
    if "body" not in cols:
        op.add_column("job", sa.Column("body", sa.JSON(), nullable=True))
    if "conditions" not in cols:
        op.add_column("job", sa.Column("conditions", sa.JSON(), nullable=True))
    if "condition_operator" not in cols:
        op.add_column(
            "job",
            sa.Column(
                "condition_operator", sa.String(), nullable=False, server_default="AND"
            ),
        )


def downgrade() -> None:
    op.drop_column("job", "condition_operator")
    op.drop_column("job", "conditions")
    op.drop_column("job", "body")
    op.drop_column("job", "headers")
    op.drop_column("job", "method")
    op.drop_column("job", "url")
