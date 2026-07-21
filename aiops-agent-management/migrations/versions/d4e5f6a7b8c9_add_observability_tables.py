"""add observability tables

Revision ID: d4e5f6a7b8c9
Revises: b1c2d3e4f5a6
Create Date: 2026-05-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "observability_span",
        sa.Column("observability_span_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("span_id", sa.String(), nullable=False),
        sa.Column("trace_id", sa.String(), nullable=False),
        sa.Column("start_time", sa.BigInteger(), nullable=True),
        sa.Column("end_time", sa.BigInteger(), nullable=True),
        sa.Column("attributes", sa.JSON(), nullable=True),
        sa.Column("parent_span_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("observability_span_id"),
        sa.UniqueConstraint(
            "agent_id", "session_id", "span_id", name="uq_span_session"
        ),
    )
    op.create_index(
        op.f("ix_observability_span_agent_id"),
        "observability_span",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_observability_span_session_id"),
        "observability_span",
        ["session_id"],
        unique=False,
    )

    op.create_table(
        "observability_token_usage",
        sa.Column("token_usage_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("llm_model", sa.String(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("invocation_id", sa.String(), nullable=True),
        sa.Column("event_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("token_usage_id"),
    )
    op.create_index(
        op.f("ix_observability_token_usage_agent_id"),
        "observability_token_usage",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_observability_token_usage_llm_model"),
        "observability_token_usage",
        ["llm_model"],
        unique=False,
    )
    op.create_index(
        op.f("ix_observability_token_usage_session_id"),
        "observability_token_usage",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_observability_token_usage_session_id"),
        table_name="observability_token_usage",
    )
    op.drop_index(
        op.f("ix_observability_token_usage_llm_model"),
        table_name="observability_token_usage",
    )
    op.drop_index(
        op.f("ix_observability_token_usage_agent_id"),
        table_name="observability_token_usage",
    )
    op.drop_table("observability_token_usage")
    op.drop_index(
        op.f("ix_observability_span_session_id"),
        table_name="observability_span",
    )
    op.drop_index(
        op.f("ix_observability_span_agent_id"),
        table_name="observability_span",
    )
    op.drop_table("observability_span")
