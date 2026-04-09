"""add_global_model_stack_to_agents

Revision ID: c3f4b2d1e6a7
Revises: 5ac2ae3bc12a
Create Date: 2026-04-09 16:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f4b2d1e6a7"
down_revision: str | Sequence[str] | None = "5ac2ae3bc12a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _foreign_key_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {
        fk["name"]
        for fk in inspector.get_foreign_keys(table_name)
        if fk.get("name")
    }


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "model_defaults"):
        op.create_table(
            "model_defaults",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "primary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.Column(
                "secondary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.Column(
                "tertiary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["primary_model_id"], ["model.model_id"]),
            sa.ForeignKeyConstraint(["secondary_model_id"], ["model.model_id"]),
            sa.ForeignKeyConstraint(["tertiary_model_id"], ["model.model_id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)

    defaults_exists = bind.execute(
        sa.text("SELECT 1 FROM model_defaults WHERE id = 1")
    ).scalar()
    if defaults_exists is None:
        op.execute(
            sa.text(
                """
                INSERT INTO model_defaults (
                    id,
                    primary_model_id,
                    secondary_model_id,
                    tertiary_model_id
                )
                VALUES (1, NULL, NULL, NULL)
                """
            )
        )

    agent_columns = _column_names(inspector, "agent")

    if "primary_use_global" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "primary_use_global",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "primary_model_id" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "primary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "secondary_use_global" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "secondary_use_global",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "secondary_model_id" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "secondary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )
    if "tertiary_use_global" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "tertiary_use_global",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "tertiary_model_id" not in agent_columns:
        op.add_column(
            "agent",
            sa.Column(
                "tertiary_model_id",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )

    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")
    agent_fks = _foreign_key_names(inspector, "agent")

    if (
        "primary_model_id" in agent_columns
        and "fk_agent_primary_model_id_model" not in agent_fks
    ):
        op.create_foreign_key(
            "fk_agent_primary_model_id_model",
            "agent",
            "model",
            ["primary_model_id"],
            ["model_id"],
        )
    if (
        "secondary_model_id" in agent_columns
        and "fk_agent_secondary_model_id_model" not in agent_fks
    ):
        op.create_foreign_key(
            "fk_agent_secondary_model_id_model",
            "agent",
            "model",
            ["secondary_model_id"],
            ["model_id"],
        )
    if (
        "tertiary_model_id" in agent_columns
        and "fk_agent_tertiary_model_id_model" not in agent_fks
    ):
        op.create_foreign_key(
            "fk_agent_tertiary_model_id_model",
            "agent",
            "model",
            ["tertiary_model_id"],
            ["model_id"],
        )

    if "model_id" in agent_columns:
        # Preserve old behavior for existing agents:
        # their previous model_id becomes the new manual primary model,
        # and no global/default fallbacks are auto-enabled.
        op.execute(
            sa.text(
                """
                UPDATE agent
                SET
                    primary_use_global = FALSE,
                    primary_model_id = model_id,
                    secondary_use_global = FALSE,
                    secondary_model_id = NULL,
                    tertiary_use_global = FALSE,
                    tertiary_model_id = NULL
                """
            )
        )

        inspector = sa.inspect(bind)
        for fk in inspector.get_foreign_keys("agent"):
            constrained = set(fk.get("constrained_columns") or [])
            fk_name = fk.get("name")
            if "model_id" in constrained and fk_name:
                op.drop_constraint(fk_name, "agent", type_="foreignkey")
                break

        op.drop_column("agent", "model_id")

    inspector = sa.inspect(bind)
    agent_columns = _column_names(inspector, "agent")
    if "primary_use_global" in agent_columns:
        op.alter_column("agent", "primary_use_global", server_default=None)
    if "secondary_use_global" in agent_columns:
        op.alter_column("agent", "secondary_use_global", server_default=None)
    if "tertiary_use_global" in agent_columns:
        op.alter_column("agent", "tertiary_use_global", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "agent",
        sa.Column(
            "model_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_agent_model_id_model",
        "agent",
        "model",
        ["model_id"],
        ["model_id"],
    )

    # Best-effort downgrade:
    # prefer the explicit manual primary; if absent, fall back to the global primary.
    op.execute(
        sa.text(
            """
            UPDATE agent
            SET model_id = primary_model_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE agent
            SET model_id = (
                SELECT primary_model_id
                FROM model_defaults
                WHERE id = 1
            )
            WHERE model_id IS NULL AND primary_use_global = TRUE
            """
        )
    )

    op.drop_constraint("fk_agent_tertiary_model_id_model", "agent", type_="foreignkey")
    op.drop_constraint("fk_agent_secondary_model_id_model", "agent", type_="foreignkey")
    op.drop_constraint("fk_agent_primary_model_id_model", "agent", type_="foreignkey")
    op.drop_column("agent", "tertiary_model_id")
    op.drop_column("agent", "tertiary_use_global")
    op.drop_column("agent", "secondary_model_id")
    op.drop_column("agent", "secondary_use_global")
    op.drop_column("agent", "primary_model_id")
    op.drop_column("agent", "primary_use_global")

    op.drop_table("model_defaults")
