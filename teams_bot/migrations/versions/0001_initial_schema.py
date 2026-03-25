"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-03 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("conversation_id", sa.String(length=512), nullable=False),
        sa.Column("service_url", sa.String(length=512), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("conversation_type", sa.String(length=32), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("conversation_id"),
    )

    op.create_table(
        "email_subscriptions",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("conversation_id", sa.String(length=512), nullable=False),
        sa.Column("updated_at_utc", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("email"),
    )
    op.create_index(
        "ix_email_subscriptions_conversation_id",
        "email_subscriptions",
        ["conversation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_subscriptions_conversation_id",
        table_name="email_subscriptions",
    )
    op.drop_table("email_subscriptions")
    op.drop_table("subscriptions")
