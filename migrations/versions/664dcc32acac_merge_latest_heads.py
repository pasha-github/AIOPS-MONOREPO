"""merge latest heads

Revision ID: 664dcc32acac
Revises: 9210ee006200, a1b2c3d4e5f6
Create Date: 2026-06-01 20:30:39.237800

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "664dcc32acac"
down_revision: str | Sequence[str] | None = ("9210ee006200", "a1b2c3d4e5f6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
