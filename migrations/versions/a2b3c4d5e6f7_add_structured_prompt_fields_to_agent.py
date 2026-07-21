"""add_structured_prompt_fields_to_agent

Revision ID: a2b3c4d5e6f7
Revises: 664dcc32acac
Create Date: 2026-06-10 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: str | Sequence[str] | None = "664dcc32acac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = [
    "prompt_role",
    "prompt_objectives",
    "prompt_behavior",
    "prompt_output_format",
    "prompt_constraints",
    "prompt_safety",
    "prompt_tools_instructions",
    "prompt_policy",
    "prompt_examples",
    "prompt_additional_info",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"] for col in inspector.get_columns("agent")}
    for column in COLUMNS:
        if column not in existing:
            op.add_column("agent", sa.Column(column, sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"] for col in inspector.get_columns("agent")}
    for column in COLUMNS:
        if column in existing:
            op.drop_column("agent", column)
