"""levelup_empleados_tress — columnas de contrato (tipo, duración, inicio, vencimiento)

La caché de datos generales del colaborador guarda ahora también el contrato actual de
`dbo.COLABORA` + `dbo.CONTRATO`. Sin tabla nueva: es la misma foto por empleado que ya
escribe el sync de las 04:10.

Revision ID: c1o2n3t4r5a6
Revises: h1o2r3e4g5l6
Create Date: 2026-08-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision: str = "c1o2n3t4r5a6"
down_revision: Union[str, None] = "h1o2r3e4g5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_empleados_tress"

_COLUMNAS = (
    sa.Column("contrato_codigo", sa.String(10), nullable=True),
    sa.Column("contrato_descripcion", sa.String(100), nullable=True),
    sa.Column("contrato_dias", sa.Integer(), nullable=True),
    sa.Column("fecha_contrato", sa.Date(), nullable=True),
    sa.Column("fecha_vencimiento_contrato", sa.Date(), nullable=True),
)


def upgrade() -> None:
    if not table_exists(_TABLA):
        return
    existentes = column_names(_TABLA)
    for col in _COLUMNAS:
        if col.name not in existentes:
            op.add_column(_TABLA, col)
    op.create_index(
        "ix_levelup_empleados_tress_fecha_vencimiento_contrato",
        _TABLA,
        ["fecha_vencimiento_contrato"],
        if_not_exists=True,
    )


def downgrade() -> None:
    if not table_exists(_TABLA):
        return
    op.drop_index("ix_levelup_empleados_tress_fecha_vencimiento_contrato", table_name=_TABLA, if_exists=True)
    existentes = column_names(_TABLA)
    for col in reversed(_COLUMNAS):
        if col.name in existentes:
            op.drop_column(_TABLA, col.name)
