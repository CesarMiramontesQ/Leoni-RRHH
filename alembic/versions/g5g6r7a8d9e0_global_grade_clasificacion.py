"""global grade en la clasificacion de puesto

Revision ID: g5g6r7a8d9e0
Revises: w1t2w3c4l5a6
Create Date: 2026-07-28

Contexto: la clasificacion WTW de un puesto se completa con el Global Grade (GG),
que RH define fuera del sistema junto con el resto de la clasificacion. Falta el
catalogo y la equivalencia configurable Global Level -> Global Grade.

Esta migracion:
  1. crea `levelup_global_grades` (codigo, nombre, descripcion, orden, activo),
  2. crea `levelup_global_level_grade_mappings`, con unicidad POR global level: un
     nivel equivale a un solo grado. El career path no se guarda aqui porque ya
     cuelga del global level y duplicarlo permitiria que las copias se contradigan,
  3. agrega `global_grade_id` a `levelup_puestos_perfil` (nullable: los perfiles sin
     clasificar se marcan como pendientes en la UI, no se bloquean),
  4. agrega `global_grade_id` y `cambios` (JSONB) a la bitacora de clasificacion,
     para que cada fila guarde la foto del estado nuevo Y el diff del evento.

NO siembra global grades ni equivalencias: el formato de los codigos y la
correspondencia entre niveles y grados los define RH desde Ajustes. Asumir que P10
equivale a GG10 seria exactamente el hardcodeo que hay que evitar.

El Global Grade clasifica puestos; no representa sueldo, banda ni compensacion.

Idempotente: cada paso comprueba antes si la tabla o columna ya existe.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "g5g6r7a8d9e0"
down_revision: Union[str, None] = "w1t2w3c4l5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

T_GRADES = "levelup_global_grades"
T_MAPPINGS = "levelup_global_level_grade_mappings"
T_PERFILES = "levelup_puestos_perfil"
T_HISTORIAL = "levelup_puesto_perfil_clasificacion_historial"
T_NIVELES = "levelup_grados_puesto"

UQ_MAPPING_LEVEL = "uq_levelup_global_level_grade_mapping_level"
FK_PERFIL_GRADE = "fk_levelup_puestos_perfil_global_grade"
FK_HISTORIAL_GRADE = "fk_levelup_clasificacion_historial_global_grade"


def _has_table(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _columns(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _foreign_keys(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {fk["name"] for fk in inspector.get_foreign_keys(table) if fk["name"]}


def upgrade() -> None:
    if not _has_table(T_GRADES):
        op.create_table(
            T_GRADES,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("codigo", sa.String(length=20), nullable=False),
            sa.Column("nombre", sa.String(length=100), nullable=False),
            sa.Column("descripcion", sa.Text(), nullable=True),
            sa.Column("orden", sa.Integer(), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
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
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("codigo"),
            sa.UniqueConstraint("orden"),
        )

    if not _has_table(T_MAPPINGS):
        op.create_table(
            T_MAPPINGS,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("global_level_id", sa.Integer(), nullable=False),
            sa.Column("global_grade_id", sa.Integer(), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
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
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["global_level_id"], [f"{T_NIVELES}.id"]),
            sa.ForeignKeyConstraint(["global_grade_id"], [f"{T_GRADES}.id"]),
            # Un global level equivale a un solo global grade.
            sa.UniqueConstraint("global_level_id", name=UQ_MAPPING_LEVEL),
        )

    if "global_grade_id" not in _columns(T_PERFILES):
        op.add_column(
            T_PERFILES, sa.Column("global_grade_id", sa.Integer(), nullable=True)
        )
    if FK_PERFIL_GRADE not in _foreign_keys(T_PERFILES):
        op.create_foreign_key(
            FK_PERFIL_GRADE, T_PERFILES, T_GRADES, ["global_grade_id"], ["id"]
        )

    columnas_historial = _columns(T_HISTORIAL)
    if "global_grade_id" not in columnas_historial:
        op.add_column(
            T_HISTORIAL, sa.Column("global_grade_id", sa.Integer(), nullable=True)
        )
    if FK_HISTORIAL_GRADE not in _foreign_keys(T_HISTORIAL):
        op.create_foreign_key(
            FK_HISTORIAL_GRADE, T_HISTORIAL, T_GRADES, ["global_grade_id"], ["id"]
        )
    if "cambios" not in columnas_historial:
        op.add_column(
            T_HISTORIAL,
            sa.Column(
                "cambios",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                comment=(
                    "Diff del evento: [{campo, etiqueta, anterior, nuevo}] con los "
                    "valores ya resueltos a texto legible"
                ),
            ),
        )


def downgrade() -> None:
    if "cambios" in _columns(T_HISTORIAL):
        op.drop_column(T_HISTORIAL, "cambios")
    if "global_grade_id" in _columns(T_HISTORIAL):
        op.drop_column(T_HISTORIAL, "global_grade_id")
    if "global_grade_id" in _columns(T_PERFILES):
        op.drop_column(T_PERFILES, "global_grade_id")
    for tabla in (T_MAPPINGS, T_GRADES):
        if _has_table(tabla):
            op.drop_table(tabla)
