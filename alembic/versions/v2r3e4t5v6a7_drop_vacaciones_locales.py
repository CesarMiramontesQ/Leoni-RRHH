"""drop levelup_vacaciones_disponibles y levelup_vacaciones

El saldo de vacaciones se lee de TRESS (``dbo.GET_SALDOS_VACACION`` en DATOS_ANALISIS)
desde que los dashboards y el formulario de solicitudes usan esa fuente. Estas dos tablas
locales quedaron sin lectores:

- ``levelup_vacaciones_disponibles``: saldo sembrado de un Excel (marzo 2022). Alimentaba
  el KPI del dashboard y ``vista360.saldo_vacaciones``; ambos migrados a TRESS.
- ``levelup_vacaciones``: nunca tuvo repositorio ni servicio; solo existía el modelo.

**Irreversible en cuanto a datos.** El downgrade recrea las tablas vacías, no su contenido:
respaldar antes de aplicar en producción si el saldo sembrado aún interesa.

    pg_dump -t levelup_vacaciones_disponibles ... > respaldo.sql

Nota sobre instalaciones antiguas: la revisión ``h9i0j1k2l3m4`` creó la tabla del modelo
``Vacaciones`` con el nombre **sin prefijo** ``vacaciones``. Esta migración NO la toca —
tocar tablas sin prefijo ``levelup_`` está prohibido en este proyecto porque el esquema de
Bono también vive ahí, y no se puede distinguir con certeza a quién pertenece. Si en algún
entorno existe una tabla ``vacaciones`` de este proyecto, se retira a mano tras verificarlo
con el dueño de la BD.

Revision ID: v2r3e4t5v6a7
Revises: v1s2t3r4o5l6
Create Date: 2026-08-03
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v2r3e4t5v6a7"
down_revision: Union[str, None] = "v1s2t3r4o5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLAS = ("levelup_vacaciones_disponibles", "levelup_vacaciones")


def _tabla_existe(bind, nombre: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM pg_class WHERE relname = :t AND relkind = 'r'"),
            {"t": nombre},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()
    for tabla in TABLAS:
        if _tabla_existe(bind, tabla):
            op.drop_table(tabla)


def downgrade() -> None:
    bind = op.get_bind()

    if not _tabla_existe(bind, "levelup_vacaciones_disponibles"):
        op.create_table(
            "levelup_vacaciones_disponibles",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("no_empleado", sa.Integer(), nullable=False),
            sa.Column("dias", sa.Integer(), server_default="0", nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "no_empleado", name="uq_levelup_vacaciones_disponibles_no_empleado"
            ),
        )

    if not _tabla_existe(bind, "levelup_vacaciones"):
        op.create_table(
            "levelup_vacaciones",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("empleado_id", sa.Integer(), nullable=False),
            sa.Column("dias_disponibles", sa.Integer(), server_default="0", nullable=False),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("empleado_id", name="uq_levelup_vacaciones_empleado_id"),
        )
