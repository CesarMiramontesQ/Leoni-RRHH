"""levelup_incidencias_tress — horas del retardo (programada, entrada, minutos)

La página Incidencias no puede volver a TRESS a resolver el horario de un retardo: la
caché es su única fuente. Estas tres columnas guardan lo que el sync ya trae de
`dbo.HORARIO` (HO_INTIME) y `dbo.CHECADAS` (la checada de entrada de la jornada).

Las horas son texto "HH:MM" y no Time porque TRESS expresa "al día siguiente" con horas
>= 24 ("2500" es la 01:00 del turno que entró a las 18:00).

Revision ID: z1r2e3t4h5o6
Revises: s1c2h3e4d5j6
Create Date: 2026-08-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision: str = "z1r2e3t4h5o6"
down_revision: Union[str, None] = "s1c2h3e4d5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_incidencias_tress"
# (nombre, tipo). No se reusa un `sa.Column` ya construido: al añadirlo queda ligado a
# la tabla y no se puede volver a usar.
_COLUMNAS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("hora_programada", sa.String(5)),
    ("hora_entrada", sa.String(5)),
    ("minutos_retardo", sa.Integer()),
)


def upgrade() -> None:
    if not table_exists(_TABLA):
        return
    existentes = column_names(_TABLA)
    for nombre, tipo in _COLUMNAS:
        if nombre not in existentes:
            op.add_column(_TABLA, sa.Column(nombre, tipo, nullable=True))


def downgrade() -> None:
    if not table_exists(_TABLA):
        return
    existentes = column_names(_TABLA)
    for nombre, _tipo in _COLUMNAS:
        if nombre in existentes:
            op.drop_column(_TABLA, nombre)
