"""levelup_incidencias_tress — caché en Bono de las incidencias de TRESS

Espeja a `levelup_homeoffice_tomados`: no es un dato editable, sino la caché de
`dbo.AUSENCIA` + `dbo.PERMISO` (DATOS_ANALISIS) que escribe el sync semanal. Una fila
por evento de origen, con `(origen, origen_id)` como llave de idempotencia.

Revision ID: y1i2n3c4t5r6
Revises: x1h2o3f4f5i6
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.utils.migration_helpers import table_exists

revision: str = "y1i2n3c4t5r6"
down_revision: Union[str, None] = "x1h2o3f4f5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TIPOS_SQL = ", ".join(f"'{t}'" for t in FALTA_RETARDO_TIPOS)


def upgrade() -> None:
    if table_exists("levelup_incidencias_tress"):
        return

    op.create_table(
        "levelup_incidencias_tress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("origen", sa.String(16), nullable=False),
        sa.Column("origen_id", sa.Integer(), nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(32), nullable=False),
        sa.Column("fecha_evento", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("fecha_registro", sa.Date(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # Garantía anti-duplicados del upsert.
        sa.UniqueConstraint(
            "origen", "origen_id", name="uq_levelup_incidencias_tress_origen"
        ),
        sa.CheckConstraint(
            f"tipo IN ({_TIPOS_SQL})", name="chk_levelup_incidencias_tress_tipo"
        ),
    )
    op.create_index(
        "ix_levelup_incidencias_tress_fecha_evento",
        "levelup_incidencias_tress",
        ["fecha_evento"],
    )
    op.create_index(
        "ix_levelup_incidencias_tress_no_empleado",
        "levelup_incidencias_tress",
        ["no_empleado"],
    )
    op.create_index(
        "ix_levelup_incidencias_tress_tipo", "levelup_incidencias_tress", ["tipo"]
    )


def downgrade() -> None:
    if not table_exists("levelup_incidencias_tress"):
        return
    op.drop_table("levelup_incidencias_tress")
