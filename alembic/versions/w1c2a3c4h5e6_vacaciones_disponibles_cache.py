"""levelup_vacaciones_disponibles — caché del saldo de vacaciones de TRESS

Recrea la tabla que dropeó `v2r3e4t5v6a7`, ahora con otro propósito: no es un saldo
editable sembrado de un Excel, sino la caché de `dbo.GET_SALDOS_VACACION` (DATOS_ANALISIS)
que sincroniza el job diario de las 06:00 y la aprobación de solicitudes de vacaciones.
Guarda el ciclo vigente completo para que el dashboard no tenga que volver a esa BD externa.

Revision ID: w1c2a3c4h5e6
Revises: v2r3e4t5v6a7
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "w1c2a3c4h5e6"
down_revision: Union[str, None] = "v2r3e4t5v6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_vacaciones_disponibles"):
        return

    op.create_table(
        "levelup_vacaciones_disponibles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("dias_disponibles", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("derecho_ciclo", sa.Numeric(6, 2), nullable=True),
        sa.Column("tomados_ciclo", sa.Numeric(6, 2), nullable=True),
        sa.Column("aniversario", sa.Integer(), nullable=True),
        sa.Column("fecha_vence", sa.Date(), nullable=True),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # Garantía anti-duplicados del upsert: una fila por empleado.
        sa.UniqueConstraint("no_empleado", name="uq_levelup_vacaciones_disponibles_no_empleado"),
    )
    op.create_index(
        "ix_levelup_vacaciones_disponibles_no_empleado",
        "levelup_vacaciones_disponibles",
        ["no_empleado"],
    )


def downgrade() -> None:
    if not table_exists("levelup_vacaciones_disponibles"):
        return
    op.drop_index(
        "ix_levelup_vacaciones_disponibles_no_empleado",
        table_name="levelup_vacaciones_disponibles",
    )
    op.drop_table("levelup_vacaciones_disponibles")
