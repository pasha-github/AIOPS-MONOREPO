"""merge heads

Revision ID: e14b893ccb6e
Revises: 8de4d2f6b981, e7a9c2d4f1b3
Create Date: 2026-05-19 16:22:50.314284

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "e14b893ccb6e"
down_revision: str | Sequence[str] | None = ("8de4d2f6b981", "e7a9c2d4f1b3")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
