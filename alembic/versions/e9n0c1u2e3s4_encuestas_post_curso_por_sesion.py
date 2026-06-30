"""encuestas post curso por sesión (levelup_curso_encuesta + repurpose respuestas)

Crea la tabla de habilitación de encuesta por sesión (levelup_curso_encuesta) y
reorienta la tabla de respuestas (levelup_encuestas_post_curso) del módulo Talento
(capacitacion_id) hacia el módulo de cursos Level Up (encuesta_id/curso_id/sesion_id),
con respuesta única por (sesión, empleado).

Solo toca tablas levelup_*. La tabla de respuestas no tenía endpoints, por lo que no
hay datos productivos que migrar (los cambios destructivos son seguros).

Revision ID: e9n0c1u2e3s4
Revises: b2c3d4e5f6i7
Create Date: 2026-06-28
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e9n0c1u2e3s4"
down_revision: Union[str, None] = "b2c3d4e5f6i7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RESP_TABLE = "levelup_encuestas_post_curso"
ENC_TABLE = "levelup_curso_encuesta"


def _col_exists(bind, table: str, column: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).scalar()
    )


def _constraint_exists(bind, name: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM pg_constraint WHERE conname = :n"),
            {"n": name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Tabla de habilitación por sesión
    if not bind.execute(
        sa.text(f"SELECT 1 FROM pg_class WHERE relname = '{ENC_TABLE}' AND relkind = 'r'")
    ).scalar():
        op.create_table(
            ENC_TABLE,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("curso_id", sa.Integer(), nullable=False),
            sa.Column("sesion_id", sa.Integer(), nullable=False),
            sa.Column(
                "estado",
                sa.Enum("activa", "cerrada", name="estado_encuesta_enum"),
                server_default="activa",
                nullable=False,
            ),
            sa.Column("fecha_limite", sa.DateTime(timezone=True), nullable=True),
            sa.Column("fecha_cierre", sa.DateTime(timezone=True), nullable=True),
            sa.Column("habilitada_por", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["curso_id"], ["levelup_cursos.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["sesion_id"], ["levelup_curso_sesion.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["habilitada_por"], ["empleados.empleado_id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("sesion_id", name="uq_levelup_curso_encuesta_sesion"),
        )
        op.create_index(
            "ix_levelup_curso_encuesta_curso_id", ENC_TABLE, ["curso_id"]
        )

    # 2) Reorientar la tabla de respuestas hacia curso/sesión
    # Vaciar (no hay endpoints previos; evita conflictos con columnas NOT NULL nuevas)
    op.execute(sa.text(f"DELETE FROM {RESP_TABLE}"))

    if _constraint_exists(bind, "uq_levelup_encuesta_cap_emp"):
        op.drop_constraint("uq_levelup_encuesta_cap_emp", RESP_TABLE, type_="unique")

    if _col_exists(bind, RESP_TABLE, "capacitacion_id"):
        op.drop_column(RESP_TABLE, "capacitacion_id")

    if not _col_exists(bind, RESP_TABLE, "encuesta_id"):
        op.add_column(RESP_TABLE, sa.Column("encuesta_id", sa.Integer(), nullable=False))
        op.create_foreign_key(
            "fk_levelup_encuesta_resp_encuesta",
            RESP_TABLE,
            ENC_TABLE,
            ["encuesta_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(
            "ix_levelup_encuestas_post_curso_encuesta_id", RESP_TABLE, ["encuesta_id"]
        )

    if not _col_exists(bind, RESP_TABLE, "curso_id"):
        op.add_column(RESP_TABLE, sa.Column("curso_id", sa.Integer(), nullable=False))
        op.create_foreign_key(
            "fk_levelup_encuesta_resp_curso",
            RESP_TABLE,
            "levelup_cursos",
            ["curso_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(
            "ix_levelup_encuestas_post_curso_curso_id", RESP_TABLE, ["curso_id"]
        )

    if not _col_exists(bind, RESP_TABLE, "sesion_id"):
        op.add_column(RESP_TABLE, sa.Column("sesion_id", sa.Integer(), nullable=False))
        op.create_foreign_key(
            "fk_levelup_encuesta_resp_sesion",
            RESP_TABLE,
            "levelup_curso_sesion",
            ["sesion_id"],
            ["id"],
            ondelete="CASCADE",
        )

    if not _constraint_exists(bind, "uq_levelup_encuesta_sesion_emp"):
        op.create_unique_constraint(
            "uq_levelup_encuesta_sesion_emp", RESP_TABLE, ["sesion_id", "empleado_id"]
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _constraint_exists(bind, "uq_levelup_encuesta_sesion_emp"):
        op.drop_constraint("uq_levelup_encuesta_sesion_emp", RESP_TABLE, type_="unique")

    op.execute(sa.text(f"DELETE FROM {RESP_TABLE}"))

    for col, fk, idx in (
        ("sesion_id", "fk_levelup_encuesta_resp_sesion", None),
        ("curso_id", "fk_levelup_encuesta_resp_curso", "ix_levelup_encuestas_post_curso_curso_id"),
        ("encuesta_id", "fk_levelup_encuesta_resp_encuesta", "ix_levelup_encuestas_post_curso_encuesta_id"),
    ):
        if _col_exists(bind, RESP_TABLE, col):
            if _constraint_exists(bind, fk):
                op.drop_constraint(fk, RESP_TABLE, type_="foreignkey")
            if idx:
                op.drop_index(idx, table_name=RESP_TABLE)
            op.drop_column(RESP_TABLE, col)

    if not _col_exists(bind, RESP_TABLE, "capacitacion_id"):
        op.add_column(RESP_TABLE, sa.Column("capacitacion_id", sa.Integer(), nullable=False))
        op.create_foreign_key(
            "fk_levelup_encuesta_resp_capacitacion",
            RESP_TABLE,
            "levelup_capacitaciones",
            ["capacitacion_id"],
            ["id"],
        )
        op.create_unique_constraint(
            "uq_levelup_encuesta_cap_emp", RESP_TABLE, ["capacitacion_id", "empleado_id"]
        )

    op.drop_index("ix_levelup_curso_encuesta_curso_id", table_name=ENC_TABLE)
    op.drop_table(ENC_TABLE)
    sa.Enum(name="estado_encuesta_enum").drop(bind, checkfirst=True)
