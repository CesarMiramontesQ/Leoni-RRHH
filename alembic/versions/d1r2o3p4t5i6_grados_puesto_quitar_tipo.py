"""grados puesto: quitar la columna tipo

Revision ID: d1r2o3p4t5i6
Revises: f7u8s9c0m1p2
Create Date: 2026-07-27

Contexto: una rama nunca mergeada (`feat/cm/tipo-puesto-grados`) corrio su
migracion contra la BD Bono y dejo `levelup_grados_puesto.tipo` NOT NULL, con
unicidad POR tipo. El codigo de main no conoce esa columna, asi que el INSERT
de "crear grado" fallaba con NotNullViolation.

Esta migracion revierte la BD al esquema que main declara:
  - fusiona los grados duplicados que aparecen en ambos tipos (mismo nombre u
    orden), conservando el de menor id y propagando `activo`,
  - quita el CHECK y las uniques por tipo,
  - elimina la columna `tipo`,
  - restaura las uniques de columna unica sobre `nombre` y `orden`.

Idempotente: si `tipo` no existe (BD creada desde los modelos de main), no hace
nada. Segura: aborta si un grado a fusionar esta referenciado, en vez de borrar
datos en cascada de forma silenciosa.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "d1r2o3p4t5i6"
down_revision: Union[str, None] = "f7u8s9c0m1p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "levelup_grados_puesto"

CK_TIPO = "ck_levelup_grados_puesto_tipo"
UQ_TIPO_NOMBRE = "uq_levelup_grados_puesto_tipo_nombre"
UQ_TIPO_ORDEN = "uq_levelup_grados_puesto_tipo_orden"
UQ_NOMBRE = "uq_levelup_grados_puesto_nombre"
UQ_ORDEN = "uq_levelup_grados_puesto_orden"

# Tablas que apuntan a levelup_grados_puesto.grado_id
REFERENTES = (
    "levelup_perfil_tareas",
    "levelup_competencia_requisitos",
    "levelup_eval360_participante",
    "levelup_perfil_funciones",
    "levelup_puesto_perfil_grados",
)


def _columns(table: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _constraints(table: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table):
        return set()
    nombres = {c["name"] for c in inspector.get_unique_constraints(table) if c["name"]}
    nombres |= {c["name"] for c in inspector.get_check_constraints(table) if c["name"]}
    return nombres


def _sobrantes(columna: str) -> list[int]:
    """Ids duplicados en `columna`: todos menos el de menor id de cada grupo."""
    bind = op.get_bind()
    filas = bind.execute(
        sa.text(
            f"""
            SELECT id
            FROM {TABLA} g
            WHERE g.id > (
                SELECT MIN(m.id) FROM {TABLA} m WHERE m.{columna} = g.{columna}
            )
            """
        )
    ).scalars().all()
    return list(filas)


def _propagar_activo_y_borrar(ids: list[int], columna: str) -> None:
    """Fusiona los duplicados de `columna` sobre el superviviente de menor id."""
    if not ids:
        return

    bind = op.get_bind()

    # Nadie puede estar usando un grado que vamos a borrar.
    en_uso: list[str] = []
    for tabla in REFERENTES:
        if "grado_id" not in _columns(tabla):
            continue
        usos = bind.execute(
            sa.text(
                f"SELECT COUNT(*) FROM {tabla} WHERE grado_id IN :ids"
            ).bindparams(sa.bindparam("ids", value=ids, expanding=True))
        ).scalar()
        if usos:
            en_uso.append(f"{tabla} ({usos} fila(s))")
    if en_uso:
        raise RuntimeError(
            f"No se puede fusionar los grados {ids} por {columna}: siguen "
            f"referenciados en {', '.join(en_uso)}. Reasigna esas filas a los "
            "grados que se conservan y vuelve a correr la migracion."
        )

    # Si el duplicado estaba activo, el superviviente queda activo (no dejar
    # huecos en la secuencia de grados visible en la UI).
    op.execute(
        sa.text(
            f"""
            UPDATE {TABLA} superviviente
            SET activo = TRUE
            FROM {TABLA} dup
            WHERE dup.id IN :ids
              AND dup.activo IS TRUE
              AND superviviente.{columna} = dup.{columna}
              AND superviviente.id < dup.id
            """
        ).bindparams(sa.bindparam("ids", value=ids, expanding=True))
    )
    op.execute(
        sa.text(f"DELETE FROM {TABLA} WHERE id IN :ids").bindparams(
            sa.bindparam("ids", value=ids, expanding=True)
        )
    )


def upgrade() -> None:
    if "tipo" not in _columns(TABLA):
        return

    # 1. Fusionar duplicados: primero por nombre, luego por orden.
    _propagar_activo_y_borrar(_sobrantes("nombre"), "nombre")
    _propagar_activo_y_borrar(_sobrantes("orden"), "orden")

    # 2. Quitar CHECK y uniques por tipo.
    existentes = _constraints(TABLA)
    for nombre in (CK_TIPO, UQ_TIPO_NOMBRE, UQ_TIPO_ORDEN):
        if nombre in existentes:
            tipo = "check" if nombre.startswith("ck_") else "unique"
            op.drop_constraint(nombre, TABLA, type_=tipo)

    # 3. Eliminar la columna.
    op.drop_column(TABLA, "tipo")

    # 4. Restaurar unicidad global sobre nombre y orden (lo que declara el modelo).
    existentes = _constraints(TABLA)
    if UQ_NOMBRE not in existentes:
        op.create_unique_constraint(UQ_NOMBRE, TABLA, ["nombre"])
    if UQ_ORDEN not in existentes:
        op.create_unique_constraint(UQ_ORDEN, TABLA, ["orden"])


def downgrade() -> None:
    """Recrea la estructura por tipo. No restaura los grados fusionados."""
    if "tipo" in _columns(TABLA):
        return

    existentes = _constraints(TABLA)
    for nombre in (UQ_NOMBRE, UQ_ORDEN):
        if nombre in existentes:
            op.drop_constraint(nombre, TABLA, type_="unique")

    op.add_column(
        TABLA,
        sa.Column(
            "tipo",
            sa.String(length=20),
            nullable=False,
            server_default="administrativo",
        ),
    )
    op.create_check_constraint(
        CK_TIPO,
        TABLA,
        "tipo IN ('administrativo', 'operativo')",
    )
    op.create_unique_constraint(UQ_TIPO_NOMBRE, TABLA, ["tipo", "nombre"])
    op.create_unique_constraint(UQ_TIPO_ORDEN, TABLA, ["tipo", "orden"])
