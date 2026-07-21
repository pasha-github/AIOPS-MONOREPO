"""merge heads

Revision ID: 9210ee006200
Revises: e14b893ccb6e, f6a7b8c9d0e1
Create Date: 2026-05-20 21:50:05.312388

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "9210ee006200"
down_revision: str | Sequence[str] | None = ("e14b893ccb6e", "f6a7b8c9d0e1")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
