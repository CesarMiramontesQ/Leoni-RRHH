"""levelup_homeoffice_tomados — caché de los días de home office tomados en TRESS

Espeja a `levelup_vacaciones_disponibles`: no es un dato editable, sino la caché de
`dbo.PERMISO` (PM_TIPO = 'HO', DATOS_ANALISIS) que escriben el job diario de las 06:00, la
aprobación de una solicitud de home office y el CLI de sincronización. Una fila por
empleado y año calendario.

Revision ID: x1h2o3f4f5i6
Revises: w1c2a3c4h5e6
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "x1h2o3f4f5i6"
down_revision: Union[str, None] = "w1c2a3c4h5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_homeoffice_tomados"):
        return

    op.create_table(
        "levelup_homeoffice_tomados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("dias_tomados", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # Garantía anti-duplicados del upsert: una fila por empleado y año.
        sa.UniqueConstraint(
            "no_empleado", "anio", name="uq_levelup_homeoffice_tomados_empleado_anio"
        ),
    )


def downgrade() -> None:
    if not table_exists("levelup_homeoffice_tomados"):
        return
    op.drop_table("levelup_homeoffice_tomados")
