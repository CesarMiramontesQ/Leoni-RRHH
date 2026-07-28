"""quitar orden de career paths y career levels

Revision ID: o1r2d3e4n5g6
Revises: c1a2r3e4l5v6
Create Date: 2026-07-28

Contexto: el ordenador real del sistema Towers es el Global Grade, no una escala
propia de cada career path. Por eso un P10 y un M1 pueden pesar lo mismo: ambos
equivalen al mismo GG.

  - `levelup_career_paths.orden` solo decidia el orden de un select. Los career
    paths son alternativas, no una escala; se listan por codigo.
  - `levelup_grados_puesto.orden` duplicaba la posicion que ya da el Global
    Grade a traves de la equivalencia, y podia contradecirla: nada impedia un
    nivel con codigo 'P10' y orden 3.

Tras esto, la posicion de un career level sale de
`levelup_career_level_grade_mappings` -> `levelup_global_grades.orden`, y un
nivel sin equivalencia configurada queda sin posicion: no puede formar parte del
rango de un perfil. La UI lo marca y el backend lo rechaza con un mensaje que
apunta a Ajustes.

**Irreversible en el dato**: el downgrade recrea las columnas y las rellena por
el orden del GG cuando hay equivalencia, y con un correlativo por career path
cuando no la hay. No restaura el valor original si alguien lo habia fijado a
mano en contra del codigo.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "o1r2d3e4n5g6"
down_revision: Union[str, None] = "c1a2r3e4l5v6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

T_PATHS = "levelup_career_paths"
T_NIVELES = "levelup_grados_puesto"
T_MAPPINGS = "levelup_career_level_grade_mappings"
T_GRADES = "levelup_global_grades"

UQ_NIVEL_ORDEN = "uq_levelup_grados_puesto_path_orden"


def _columns(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _uniques_sobre(table: str, columnas: list[str]) -> list[str]:
    """
    Uniques que cubren exactamente `columnas`, buscadas POR COLUMNA.

    El nombre depende de como se construyo la BD (ver `w1t2w3c4l5a6`), asi que
    buscar por nombre no es fiable.
    """
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return []
    return [
        c["name"]
        for c in inspector.get_unique_constraints(table)
        if c["name"] and list(c["column_names"]) == columnas
    ]


def upgrade() -> None:
    for nombre in _uniques_sobre(T_NIVELES, ["career_path_id", "orden"]):
        op.drop_constraint(nombre, T_NIVELES, type_="unique")
    if "orden" in _columns(T_NIVELES):
        op.drop_column(T_NIVELES, "orden")

    for nombre in _uniques_sobre(T_PATHS, ["orden"]):
        op.drop_constraint(nombre, T_PATHS, type_="unique")
    if "orden" in _columns(T_PATHS):
        op.drop_column(T_PATHS, "orden")


def downgrade() -> None:
    bind = op.get_bind()

    if "orden" not in _columns(T_PATHS):
        op.add_column(T_PATHS, sa.Column("orden", sa.Integer(), nullable=True))
        # Correlativo estable por codigo, que es lo unico que queda para ordenar.
        bind.execute(
            sa.text(
                f"""
                UPDATE {T_PATHS} p SET orden = s.fila
                FROM (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY codigo) AS fila
                    FROM {T_PATHS}
                ) s
                WHERE s.id = p.id
                """
            )
        )
        op.alter_column(T_PATHS, "orden", nullable=False)
        op.create_unique_constraint("uq_levelup_career_paths_orden", T_PATHS, ["orden"])

    if "orden" not in _columns(T_NIVELES):
        op.add_column(T_NIVELES, sa.Column("orden", sa.Integer(), nullable=True))
        # Con equivalencia, el orden del GG; sin ella, un correlativo por path.
        bind.execute(
            sa.text(
                f"""
                UPDATE {T_NIVELES} n SET orden = s.fila
                FROM (
                    SELECT
                        n2.id,
                        ROW_NUMBER() OVER (
                            PARTITION BY n2.career_path_id
                            ORDER BY gg.orden NULLS LAST, n2.codigo
                        ) AS fila
                    FROM {T_NIVELES} n2
                    LEFT JOIN {T_MAPPINGS} m
                        ON m.career_level_id = n2.id AND m.activo
                    LEFT JOIN {T_GRADES} gg ON gg.id = m.global_grade_id
                ) s
                WHERE s.id = n.id
                """
            )
        )
        op.alter_column(T_NIVELES, "orden", nullable=False)
        op.create_unique_constraint(
            UQ_NIVEL_ORDEN, T_NIVELES, ["career_path_id", "orden"]
        )
