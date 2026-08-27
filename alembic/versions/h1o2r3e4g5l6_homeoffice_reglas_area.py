"""levelup_homeoffice_reglas_area — regla de home office por área

«N días cada M semanas» por área, editable por RH en Configuración laborales. Sustituye
la regla hardcodeada de «un home office por mes».

Revision ID: h1o2r3e4g5l6
Revises: r1e2i3n4t5o6
Create Date: 2026-08-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "h1o2r3e4g5l6"
down_revision: Union[str, None] = "r1e2i3n4t5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_homeoffice_reglas_area"


def upgrade() -> None:
    if table_exists(_TABLA):
        return
    op.create_table(
        _TABLA,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "area_id",
            sa.Integer(),
            sa.ForeignKey("areas.area_id"),
            nullable=False,
        ),
        sa.Column("dias_permitidos", sa.Integer(), nullable=False),
        sa.Column("periodo_semanas", sa.Integer(), nullable=False),
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
        sa.UniqueConstraint("area_id", name="uq_levelup_homeoffice_reglas_area_area"),
    )


def downgrade() -> None:
    if table_exists(_TABLA):
        op.drop_table(_TABLA)
