"""merge heads

Revision ID: a4c766827a74
Revises: b4c5d6e7f8a9, e2a3b4c5d6f7
Create Date: 2026-07-03 19:27:58.722778

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "a4c766827a74"
down_revision: str | Sequence[str] | None = ("b4c5d6e7f8a9", "e2a3b4c5d6f7")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
