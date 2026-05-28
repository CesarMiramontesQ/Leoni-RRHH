"""add perfil_funciones_tarea

Revision ID: d8555a6354e3
Revises: 04548db06678
Create Date: 2026-05-27 20:31:57.295292

Incluye tareas_catalogo (migración original a1b2c3d4e5f6 eliminada por error en main)
antes de perfil_funciones_tarea, que referencia tareas_catalogo por FK.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import (
    column_names,
    constraint_names,
    foreign_key_names,
    table_exists,
)

revision: str = "d8555a6354e3"
down_revision: Union[str, None] = "04548db06678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not table_exists("tareas_catalogo"):
        op.create_table(
            "tareas_catalogo",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("nombre", sa.String(255), nullable=False),
            sa.Column("categoria", sa.String(50), nullable=True),
            sa.Column(
                "es_complemento",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "activo",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
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

    if table_exists("perfil_tareas"):
        cols = column_names("perfil_tareas")
        if "tarea_catalogo_id" not in cols:
            op.add_column(
                "perfil_tareas",
                sa.Column("tarea_catalogo_id", sa.Integer(), nullable=True),
            )
        if "fk_perfil_tareas_tarea_catalogo_id" not in foreign_key_names(
            "perfil_tareas"
        ):
            op.create_foreign_key(
                "fk_perfil_tareas_tarea_catalogo_id",
                "perfil_tareas",
                "tareas_catalogo",
                ["tarea_catalogo_id"],
                ["id"],
                ondelete="SET NULL",
            )

    if not table_exists("perfil_funciones_tarea"):
        op.create_table(
            "perfil_funciones_tarea",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("perfil_funciones_id", sa.Integer(), nullable=False),
            sa.Column("tarea_catalogo_id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["perfil_funciones_id"],
                ["perfil_funciones.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["tarea_catalogo_id"],
                ["tareas_catalogo.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "perfil_funciones_id",
                "tarea_catalogo_id",
                name="uq_perfil_funciones_tarea_pair",
            ),
        )


def downgrade() -> None:
    if table_exists("perfil_funciones_tarea"):
        op.drop_table("perfil_funciones_tarea")

    if table_exists("perfil_tareas"):
        if "fk_perfil_tareas_tarea_catalogo_id" in foreign_key_names(
            "perfil_tareas"
        ):
            op.drop_constraint(
                "fk_perfil_tareas_tarea_catalogo_id",
                "perfil_tareas",
                type_="foreignkey",
            )
        if "tarea_catalogo_id" in column_names("perfil_tareas"):
            op.drop_column("perfil_tareas", "tarea_catalogo_id")

    if table_exists("tareas_catalogo"):
        if "uq_tareas_catalogo_nombre" in constraint_names("tareas_catalogo"):
            op.drop_constraint(
                "uq_tareas_catalogo_nombre", "tareas_catalogo", type_="unique"
            )
        op.drop_table("tareas_catalogo")
