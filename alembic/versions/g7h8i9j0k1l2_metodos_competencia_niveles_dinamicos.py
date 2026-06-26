"""metodos competencia niveles dinamicos

Revision ID: g7h8i9j0k1l2
Revises: f1r2t3a4r5d6
Create Date: 2026-06-24

Relaja restricciones fijas 1-4 en metodos de calificacion de competencias
y en nivel_requerido / nivel_actual para permitir catalogo configurable.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, Sequence[str], None] = "f1r2t3a4r5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA_METODOS = "levelup_metodos_calificacion_competencia"
TABLA_REQUISITOS = "levelup_competencia_requisitos"
TABLA_EVALUACIONES = "levelup_evaluaciones_competencia"


def _drop_check_if_exists(table: str, constraint: str) -> None:
    op.execute(
        f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}"
    )


def upgrade() -> None:
    from sqlalchemy import text
    bind = op.get_bind()

    _drop_check_if_exists(TABLA_METODOS, "ck_metodo_calificacion_competencia_valor")
    _drop_check_if_exists(TABLA_REQUISITOS, "ck_nivel_requerido_rango")
    _drop_check_if_exists(TABLA_EVALUACIONES, "ck_nivel_actual_rango")

    def _create_if_missing(name, table, expr):
        exists = bind.execute(
            text("SELECT 1 FROM pg_constraint WHERE conname = :n"),
            {"n": name},
        ).scalar()
        if not exists:
            op.create_check_constraint(name, table, expr)

    _create_if_missing("ck_levelup_metodo_calificacion_competencia_valor_pos", TABLA_METODOS, "valor >= 1")
    _create_if_missing("ck_levelup_nivel_requerido_nonneg", TABLA_REQUISITOS, "nivel_requerido >= 0")
    _create_if_missing("ck_levelup_nivel_actual_nonneg", TABLA_EVALUACIONES, "nivel_actual >= 0")


def downgrade() -> None:
    _drop_check_if_exists(TABLA_METODOS, "ck_metodo_calificacion_competencia_valor_pos")
    _drop_check_if_exists(TABLA_REQUISITOS, "ck_nivel_requerido_nonneg")
    _drop_check_if_exists(TABLA_EVALUACIONES, "ck_nivel_actual_nonneg")

    op.create_check_constraint(
        "ck_metodo_calificacion_competencia_valor",
        TABLA_METODOS,
        "valor >= 1 AND valor <= 4",
    )
    op.create_check_constraint(
        "ck_nivel_requerido_rango",
        TABLA_REQUISITOS,
        "nivel_requerido >= 0 AND nivel_requerido <= 4",
    )
    op.create_check_constraint(
        "ck_nivel_actual_rango",
        TABLA_EVALUACIONES,
        "nivel_actual >= 0 AND nivel_actual <= 4",
    )
