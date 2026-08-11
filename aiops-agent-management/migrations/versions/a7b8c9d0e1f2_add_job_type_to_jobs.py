"""add job_type to jobs and make agent_id/prompt nullable

Revision ID: a7b8c9d0e1f2
Revises: c4d5e6f7a8b9
Create Date: 2026-06-09 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    job_columns = _column_names(inspector, "job")
    if not job_columns:
        return

    if "job_type" not in job_columns:
        op.add_column(
            "job",
            sa.Column(
                "job_type",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="agent",
            ),
        )

    # Ingestion jobs have no agent_id/prompt — relax both to nullable.
    # batch_alter_table keeps this SQLite-compatible (also works on Postgres).
    with op.batch_alter_table("job") as batch_op:
        batch_op.alter_column(
            "agent_id",
            existing_type=sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        )
        batch_op.alter_column(
            "prompt",
            existing_type=sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    job_columns = _column_names(inspector, "job")
    if not job_columns:
        return

    with op.batch_alter_table("job") as batch_op:
        batch_op.alter_column(
            "prompt",
            existing_type=sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        )
        batch_op.alter_column(
            "agent_id",
            existing_type=sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        )

    if "job_type" in job_columns:
        op.drop_column("job", "job_type")
