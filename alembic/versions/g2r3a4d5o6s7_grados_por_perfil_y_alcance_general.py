"""grados por perfil y alcance general

Revision ID: g2r3a4d5o6s7
Revises: s1p2r3o4v5s6
Create Date: 2026-07-13

- Crea levelup_puesto_perfil_grados (M2M perfil↔grado) con backfill.
- Hace nullable levelup_competencia_requisitos.grado_id + índice parcial único
  para requisitos generales (grado_id IS NULL).
- Asegura levelup_perfil_tareas.grado_id nullable.
- Elimina restos de niveles organizacionales si existen.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "g2r3a4d5o6s7"
down_revision: Union[str, None] = "s1p2r3o4v5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA_PERFIL = "levelup_puestos_perfil"
TABLA_GRADOS = "levelup_grados_puesto"
TABLA_M2M = "levelup_puesto_perfil_grados"
TABLA_REQUISITOS = "levelup_competencia_requisitos"
TABLA_TAREAS = "levelup_perfil_tareas"
TABLA_ASIGNACIONES = "levelup_perfil_funciones"
TABLA_NIVELES = "levelup_niveles_puesto"


def _columns(table: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _indexes(table: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table):
        return set()
    return {idx["name"] for idx in inspector.get_indexes(table) if idx["name"]}


def _fks(table: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table):
        return set()
    return {fk["name"] for fk in inspector.get_foreign_keys(table) if fk["name"]}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # ── 1. M2M perfil ↔ grado ───────────────────────────────────────────────
    if not inspector.has_table(TABLA_M2M):
        op.create_table(
            TABLA_M2M,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
            sa.Column("grado_id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["puesto_perfil_id"],
                [f"{TABLA_PERFIL}.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(["grado_id"], [f"{TABLA_GRADOS}.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "puesto_perfil_id",
                "grado_id",
                name="uq_levelup_puesto_perfil_grado",
            ),
        )

    # Backfill: grados usados en requisitos/asignaciones; si no hay, Grado orden=1
    op.execute(
        sa.text(
            f"""
            INSERT INTO {TABLA_M2M} (puesto_perfil_id, grado_id)
            SELECT DISTINCT src.puesto_perfil_id, src.grado_id
            FROM (
                SELECT puesto_perfil_id, grado_id
                FROM {TABLA_REQUISITOS}
                WHERE grado_id IS NOT NULL
                UNION
                SELECT puesto_perfil_id, grado_id
                FROM {TABLA_ASIGNACIONES}
                WHERE grado_id IS NOT NULL AND activo IS TRUE
            ) AS src
            WHERE NOT EXISTS (
                SELECT 1 FROM {TABLA_M2M} m
                WHERE m.puesto_perfil_id = src.puesto_perfil_id
                  AND m.grado_id = src.grado_id
            )
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            INSERT INTO {TABLA_M2M} (puesto_perfil_id, grado_id)
            SELECT p.id, g.id
            FROM {TABLA_PERFIL} p
            CROSS JOIN LATERAL (
                SELECT id FROM {TABLA_GRADOS}
                WHERE activo IS TRUE
                ORDER BY orden
                LIMIT 1
            ) g
            WHERE p.activo IS TRUE
              AND NOT EXISTS (
                SELECT 1 FROM {TABLA_M2M} m
                WHERE m.puesto_perfil_id = p.id
              )
            """
        )
    )

    # ── 2. Requisitos: grado_id nullable + índice parcial único ──────────────
    req_cols = _columns(TABLA_REQUISITOS)
    if "grado_id" in req_cols:
        op.alter_column(
            TABLA_REQUISITOS,
            "grado_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
    if "uq_levelup_competencia_puesto_general" not in _indexes(TABLA_REQUISITOS):
        op.create_index(
            "uq_levelup_competencia_puesto_general",
            TABLA_REQUISITOS,
            ["competencia_id", "puesto_perfil_id"],
            unique=True,
            postgresql_where=sa.text("grado_id IS NULL"),
        )

    # ── 3. Tareas: asegurar grado_id nullable ────────────────────────────────
    tarea_cols = _columns(TABLA_TAREAS)
    if "grado_id" not in tarea_cols:
        op.add_column(
            TABLA_TAREAS,
            sa.Column("grado_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_levelup_perfil_tareas_grado_id",
            TABLA_TAREAS,
            TABLA_GRADOS,
            ["grado_id"],
            ["id"],
        )
    else:
        op.alter_column(
            TABLA_TAREAS,
            "grado_id",
            existing_type=sa.Integer(),
            nullable=True,
        )

    # ── 4. Drop restos de niveles organizacionales ───────────────────────────
    perfil_cols = _columns(TABLA_PERFIL)
    if "nivel_id" in perfil_cols:
        for fk_name in list(_fks(TABLA_PERFIL)):
            if "nivel" in fk_name.lower():
                op.drop_constraint(fk_name, TABLA_PERFIL, type_="foreignkey")
        for idx_name in list(_indexes(TABLA_PERFIL)):
            if "nivel" in idx_name.lower():
                op.drop_index(idx_name, table_name=TABLA_PERFIL)
        op.drop_column(TABLA_PERFIL, "nivel_id")

    if inspector.has_table(TABLA_NIVELES):
        op.drop_table(TABLA_NIVELES)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "uq_levelup_competencia_puesto_general" in _indexes(TABLA_REQUISITOS):
        op.drop_index(
            "uq_levelup_competencia_puesto_general",
            table_name=TABLA_REQUISITOS,
        )

    # No re-creamos niveles ni forzamos NOT NULL en grado_id (datos generales).
    if inspector.has_table(TABLA_M2M):
        op.drop_table(TABLA_M2M)
