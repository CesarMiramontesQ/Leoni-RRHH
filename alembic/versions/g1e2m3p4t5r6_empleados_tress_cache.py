"""levelup_empleados_tress — caché de los datos generales del colaborador en TRESS

Hoy solo la fecha de ingreso (`dbo.COLABORA.CB_FEC_ING`, DATOS_ANALISIS), que Bono no
tiene en ninguna parte: `empleados` es tabla legada del esquema externo. Elimina la
consulta ODBC en vivo que la Vista 360 hacía en cada apertura del detalle de un empleado.

La escribe el job de las 04:10 y el CLI `python -m app.scripts.sync_empleados_tress`.

Revision ID: g1e2m3p4t5r6
Revises: f1j2o3r4n5a6
Create Date: 2026-08-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "g1e2m3p4t5r6"
down_revision: Union[str, None] = "f1j2o3r4n5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_empleados_tress"):
        return

    op.create_table(
        "levelup_empleados_tress",
        # CB_CODIGO de TRESS = empleados.no_empleado en Bono. Es la llave: una fila por
        # colaborador, sin autoincrement que obligaría a una UNIQUE redundante.
        sa.Column("no_empleado", sa.Integer(), autoincrement=False, nullable=False),
        # CB_FEC_ING puede venir vacío en TRESS.
        sa.Column("fecha_ingreso", sa.Date(), nullable=True),
        sa.Column(
            "sincronizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("no_empleado"),
    )


def downgrade() -> None:
    if not table_exists("levelup_empleados_tress"):
        return
    op.drop_table("levelup_empleados_tress")
