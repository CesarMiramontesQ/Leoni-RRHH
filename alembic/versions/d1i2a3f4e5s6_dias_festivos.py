"""levelup_dias_festivos — días festivos de la planta

Lista propia capturada por RH en Configuración laborales. Bloquea inicio/fin de
vacaciones y la fecha de home office; no descuenta días de vacaciones.

Revision ID: d1i2a3f4e5s6
Revises: p1r2o3f4u5n6
Create Date: 2026-08-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "d1i2a3f4e5s6"
down_revision: Union[str, None] = "p1r2o3f4u5n6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_dias_festivos"


def upgrade() -> None:
    if table_exists(_TABLA):
        return
    op.create_table(
        _TABLA,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("descripcion", sa.String(length=120), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "actualizado_por_empleado_id",
            sa.Integer(),
            sa.ForeignKey("empleados.empleado_id", ondelete="SET NULL"),
            nullable=True,
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
        sa.UniqueConstraint("fecha", name="uq_levelup_dias_festivos_fecha"),
    )


def downgrade() -> None:
    if table_exists(_TABLA):
        op.drop_table(_TABLA)
