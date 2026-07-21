"""replace api_base with extra_config on model table

Revision ID: a1b2c3d4e5f6
Revises: e14b893ccb6e
Create Date: 2026-06-01 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "e14b893ccb6e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "model")
    if "extra_config" not in cols:
        op.add_column("model", sa.Column("extra_config", sa.JSON(), nullable=True))
    if "api_base" in cols:
        # Migrate any existing api_base values into extra_config before dropping.
        op.execute(
            "UPDATE model SET extra_config = json_object('api_base', api_base) "
            "WHERE api_base IS NOT NULL AND extra_config IS NULL"
        )
        op.drop_column("model", "api_base")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = _column_names(inspector, "model")
    if "api_base" not in cols:
        op.add_column("model", sa.Column("api_base", sa.String(), nullable=True))
    if "extra_config" in cols:
        op.drop_column("model", "extra_config")
