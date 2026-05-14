"""add activity messages table

Revision ID: 0002_activity_messages
Revises: 0001_initial_schema
Create Date: 2026-05-12 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_activity_messages"
down_revision: Union[str, Sequence[str], None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_messages",
        sa.Column("activity_id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=512), nullable=False),
        sa.Column("text_value", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("activity_id"),
    )


def downgrade() -> None:
    op.drop_table("activity_messages")
