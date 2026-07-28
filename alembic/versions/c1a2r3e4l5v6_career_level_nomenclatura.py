"""career level: renombrar los objetos que decian global level

Revision ID: c1a2r3e4l5v6
Revises: g5g6r7a8d9e0
Create Date: 2026-07-28

Contexto: "Global Level" y "Global Grade" se confundian entre si por compartir
prefijo. RH pidio que el nivel pase a llamarse Career Level, que ademas lo ata
al Career Path del que cuelga y lo distingue del grado organizacional.

Renombra SOLO lo que decia "global level":
  - levelup_global_level_grade_mappings -> levelup_career_level_grade_mappings
  - su columna global_level_id -> career_level_id y la unique correspondiente
  - en la bitacora de clasificacion, global_level_desde_id / _hasta_id

NO toca el vocabulario legacy en espanol (`levelup_grados_puesto`, `grado_id`
en requisitos, tareas y asignaciones, `PuestoPerfilGrado`): esos no dicen
"global level", son ~430 puntos de codigo y su renombrado es una limpieza
aparte. La tabla de niveles conserva su nombre por la misma razon que en
`w1t2w3c4l5a6`: cuatro tablas la referencian por FK.

En Postgres RENAME de tabla y columna es metadata-only: las FKs y los indices
siguen a su objeto sin reescribir datos.

Idempotente: cada paso comprueba el estado actual antes de actuar.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

revision: str = "c1a2r3e4l5v6"
down_revision: Union[str, None] = "g5g6r7a8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

T_VIEJA = "levelup_global_level_grade_mappings"
T_NUEVA = "levelup_career_level_grade_mappings"
T_HISTORIAL = "levelup_puesto_perfil_clasificacion_historial"

UQ_VIEJA = "uq_levelup_global_level_grade_mapping_level"
UQ_NUEVA = "uq_levelup_career_level_grade_mapping_level"

COLUMNAS_HISTORIAL = (
    ("global_level_desde_id", "career_level_desde_id"),
    ("global_level_hasta_id", "career_level_hasta_id"),
)

PK_MAPPING = "levelup_career_level_grade_mappings_pkey"
FK_MAPPING_LEVEL = "fk_levelup_career_level_grade_mapping_level"
FK_MAPPING_GRADE = "fk_levelup_career_level_grade_mapping_grade"
FKS_HISTORIAL = (
    ("career_level_desde_id", "fk_levelup_clasificacion_historial_career_level_desde"),
    ("career_level_hasta_id", "fk_levelup_clasificacion_historial_career_level_hasta"),
)


def _has_table(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _columns(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _uniques(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {c["name"] for c in inspector.get_unique_constraints(table) if c["name"]}


def _renombrar_tabla(desde: str, hacia: str) -> None:
    if _has_table(desde) and not _has_table(hacia):
        op.rename_table(desde, hacia)


def _renombrar_columna(tabla: str, desde: str, hacia: str) -> None:
    columnas = _columns(tabla)
    if desde in columnas and hacia not in columnas:
        op.alter_column(tabla, desde, new_column_name=hacia)


def _renombrar_unique(tabla: str, desde: str, hacia: str) -> None:
    nombres = _uniques(tabla)
    if desde in nombres and hacia not in nombres:
        op.execute(f'ALTER TABLE {tabla} RENAME CONSTRAINT "{desde}" TO "{hacia}"')


def _renombrar_pk(tabla: str, nuevo: str) -> None:
    """El PK tampoco sigue al rename de tabla: conserva el nombre autogenerado."""
    inspector = inspect(op.get_bind())
    if not inspector.has_table(tabla):
        return
    pk = inspector.get_pk_constraint(tabla)
    actual = pk.get("name")
    if actual and actual != nuevo:
        op.execute(f'ALTER TABLE {tabla} RENAME CONSTRAINT "{actual}" TO "{nuevo}"')


def _renombrar_fks_por_columna(tabla: str, columna: str, nuevo: str) -> None:
    """
    Renombra la FK que cuelga de `columna`, buscandola POR COLUMNA.

    Postgres no renombra las constraints al renombrar la tabla o la columna, asi
    que las FKs autogeneradas conservan el nombre viejo y dejan "global_level"
    dentro del esquema. Buscarlas por nombre no sirve: segun como se construyera
    la BD el nombre difiere (ver `w1t2w3c4l5a6`, donde esa suposicion fallo).
    """
    inspector = inspect(op.get_bind())
    if not inspector.has_table(tabla):
        return
    for fk in inspector.get_foreign_keys(tabla):
        if fk.get("name") and list(fk.get("constrained_columns") or []) == [columna]:
            if fk["name"] != nuevo:
                op.execute(
                    f'ALTER TABLE {tabla} RENAME CONSTRAINT "{fk["name"]}" TO "{nuevo}"'
                )
            return


def upgrade() -> None:
    _renombrar_tabla(T_VIEJA, T_NUEVA)
    _renombrar_columna(T_NUEVA, "global_level_id", "career_level_id")
    _renombrar_unique(T_NUEVA, UQ_VIEJA, UQ_NUEVA)

    for viejo, nuevo in COLUMNAS_HISTORIAL:
        _renombrar_columna(T_HISTORIAL, viejo, nuevo)

    # Las FKs autogeneradas siguen diciendo "global_level" tras el rename.
    _renombrar_fks_por_columna(T_NUEVA, "career_level_id", FK_MAPPING_LEVEL)
    _renombrar_fks_por_columna(T_NUEVA, "global_grade_id", FK_MAPPING_GRADE)
    for columna, nombre in FKS_HISTORIAL:
        _renombrar_fks_por_columna(T_HISTORIAL, columna, nombre)
    _renombrar_pk(T_NUEVA, PK_MAPPING)


def downgrade() -> None:
    for viejo, nuevo in COLUMNAS_HISTORIAL:
        _renombrar_columna(T_HISTORIAL, nuevo, viejo)

    _renombrar_unique(T_NUEVA, UQ_NUEVA, UQ_VIEJA)
    _renombrar_columna(T_NUEVA, "career_level_id", "global_level_id")
    _renombrar_tabla(T_NUEVA, T_VIEJA)
