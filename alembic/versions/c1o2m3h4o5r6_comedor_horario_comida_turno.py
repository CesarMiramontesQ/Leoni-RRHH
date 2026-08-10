"""levelup_comedor_horarios_turno — franja de comida por turno

Tabla propia del proyecto que asigna a cada turno del catálogo replicado
(``levelup_turnos``) una hora de inicio y una hora de fin de comida. La página
«Ajustes Comedor» la administra.

Se crea aparte y no como columnas de ``levelup_turnos`` porque esa tabla es la réplica
1:1 de ``[Datos].[dbo].[TURNO]`` de TRESS: un dato propio no debe viajar dentro del
espejo, que se recarga desde el origen con ``docs/sql/levelup_turnos_replica.sql``.

La FK apunta a ``levelup_turnos.tu_codigo`` (``CHAR(6)``, con relleno de espacios en el
origen). El ``UNIQUE`` sobre ``tu_codigo`` es lo que hace inequívoca la relación
turno↔horario y permite el upsert desde el servicio.

Revision ID: c1o2m3h4o5r6
Revises: b1t2u3r4n5o6
Create Date: 2026-08-10

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "c1o2m3h4o5r6"
down_revision: Union[str, None] = "b1t2u3r4n5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_comedor_horarios_turno"):
        return

    op.create_table(
        "levelup_comedor_horarios_turno",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tu_codigo", sa.CHAR(6), nullable=False),
        sa.Column("hora_inicio_comida", sa.Time(), nullable=False),
        sa.Column("hora_fin_comida", sa.Time(), nullable=False),
        sa.Column("actualizado_por_empleado_id", sa.Integer(), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name="pk_levelup_comedor_horarios_turno"),
        sa.UniqueConstraint("tu_codigo", name="uq_levelup_comedor_horarios_turno_tu_codigo"),
        sa.ForeignKeyConstraint(
            ["tu_codigo"],
            ["levelup_turnos.tu_codigo"],
            name="fk_levelup_comedor_horarios_turno_turno",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actualizado_por_empleado_id"],
            ["empleados.empleado_id"],
            name="fk_levelup_comedor_horarios_turno_empleado",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "hora_inicio_comida < hora_fin_comida",
            name="ck_levelup_comedor_horarios_turno_rango",
        ),
    )


def downgrade() -> None:
    if not table_exists("levelup_comedor_horarios_turno"):
        return
    op.drop_table("levelup_comedor_horarios_turno")
