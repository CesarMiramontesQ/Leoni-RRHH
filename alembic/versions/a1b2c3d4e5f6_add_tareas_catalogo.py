"""add_tareas_catalogo

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-05-27 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str]] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tareas_catalogo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("categoria", sa.String(50), nullable=True),
        sa.Column("es_complemento", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_tareas_catalogo_nombre"),
    )

    op.add_column(
        "perfil_tareas",
        sa.Column("tarea_catalogo_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_perfil_tareas_tarea_catalogo_id",
        "perfil_tareas",
        "tareas_catalogo",
        ["tarea_catalogo_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_perfil_tareas_tarea_catalogo_id", "perfil_tareas", type_="foreignkey")
    op.drop_column("perfil_tareas", "tarea_catalogo_id")
    op.drop_table("tareas_catalogo")
