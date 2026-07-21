"""merge_structured_prompt_and_memory_fields

Revision ID: cee616054f22
Revises: a2b3c4d5e6f7, e6f7a8b9c0d1
Create Date: 2026-06-10 19:51:39.087714

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "cee616054f22"
down_revision: str | Sequence[str] | None = ("a2b3c4d5e6f7", "e6f7a8b9c0d1")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
