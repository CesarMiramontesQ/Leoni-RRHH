"""un career level puede equivaler a varios global grades

Revision ID: v1a2r3g4g5m6
Revises: o1r2d3e4n5g6
Create Date: 2026-07-29

Contexto: la equivalencia era 1:1 (unique sobre `career_level_id`), pero en
Towers un career level abarca un TRAMO de grados: M4 puede ser GG17 y GG18. Esa
es la razon por la que dos empleados en M4 pueden estar clasificados distinto —
el nivel dice el tamano del puesto y el grado lo afina dentro de ese tamano.

La unicidad pasa a ser el PAR `(career_level_id, global_grade_id)`: lo que no se
puede repetir es la misma equivalencia, no el nivel.

Tras esto la posicion de un nivel deja de ser un numero y pasa a ser
`[min(orden), max(orden)]` sobre sus grados activos. La contiguidad del rango de
un perfil se calcula sobre la UNION de los ordenes cubiertos, no sobre posiciones
puntuales (ver `PuestoPerfilService`).

**El downgrade es irreversible en el dato**: para poder restaurar la unique 1:1
hay que quedarse con una sola equivalencia activa por nivel. Se conserva la del
global grade de menor `orden` y el resto se desactiva; las filas no se borran,
pero la informacion de que el nivel abarcaba varios grados se pierde.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text

revision: str = "v1a2r3g4g5m6"
down_revision: Union[str, None] = "o1r2d3e4n5g6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

T_MAPPINGS = "levelup_career_level_grade_mappings"
T_GRADES = "levelup_global_grades"

UQ_PAR = "uq_levelup_career_level_grade_mapping_level_grade"
UQ_NIVEL = "uq_levelup_career_level_grade_mapping_level"


def _uniques_sobre(table: str, columnas: list[str]) -> list[str]:
    """
    Uniques que cubren exactamente `columnas`, buscadas POR COLUMNA.

    El nombre depende de como se construyo la BD (`create_all` la autonombra,
    la migracion la nombra), asi que buscar por nombre no es fiable: ya fallo en
    `w1t2w3c4l5a6`.
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
    for nombre in _uniques_sobre(T_MAPPINGS, ["career_level_id"]):
        op.drop_constraint(nombre, T_MAPPINGS, type_="unique")
    if not _uniques_sobre(T_MAPPINGS, ["career_level_id", "global_grade_id"]):
        op.create_unique_constraint(
            UQ_PAR, T_MAPPINGS, ["career_level_id", "global_grade_id"]
        )


def downgrade() -> None:
    bind = op.get_bind()

    # Deja una sola equivalencia activa por nivel: la del grado de menor orden.
    # Sin esto la unique 1:1 no se puede recrear.
    bind.execute(
        text(
            f"""
            UPDATE {T_MAPPINGS} m SET activo = false
            WHERE m.id NOT IN (
                SELECT DISTINCT ON (m2.career_level_id) m2.id
                FROM {T_MAPPINGS} m2
                JOIN {T_GRADES} gg ON gg.id = m2.global_grade_id
                ORDER BY m2.career_level_id, gg.orden, m2.id
            )
            """
        )
    )
    # La unique 1:1 tampoco distinguia `activo`, asi que las desactivadas
    # seguirian chocando: se borran las sobrantes.
    bind.execute(
        text(
            f"""
            DELETE FROM {T_MAPPINGS} m
            WHERE m.id NOT IN (
                SELECT DISTINCT ON (m2.career_level_id) m2.id
                FROM {T_MAPPINGS} m2
                JOIN {T_GRADES} gg ON gg.id = m2.global_grade_id
                ORDER BY m2.career_level_id, gg.orden, m2.id
            )
            """
        )
    )

    for nombre in _uniques_sobre(T_MAPPINGS, ["career_level_id", "global_grade_id"]):
        op.drop_constraint(nombre, T_MAPPINGS, type_="unique")
    if not _uniques_sobre(T_MAPPINGS, ["career_level_id"]):
        op.create_unique_constraint(UQ_NIVEL, T_MAPPINGS, ["career_level_id"])
