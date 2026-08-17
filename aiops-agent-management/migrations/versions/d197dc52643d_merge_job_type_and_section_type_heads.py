"""merge_job_type_and_section_type_heads

Revision ID: d197dc52643d
Revises: a7b8c9d0e1f2, d5e6f7a8b9c0
Create Date: 2026-06-26 23:28:04.431647

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "d197dc52643d"
down_revision: str | Sequence[str] | None = ("a7b8c9d0e1f2", "d5e6f7a8b9c0")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
