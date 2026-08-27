"""levelup_empleados_config — profundidad_equipo (alcance del listado de solicitudes del gerente)

Un gerente elige hasta cuántos niveles jerárquicos baja el listado de solicitudes
de su equipo. NULL = todo el subárbol (comportamiento anterior).

Revision ID: p1r2o3f4u5n6
Revises: c1o2n3t4r5a6
Create Date: 2026-08-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision: str = "p1r2o3f4u5n6"
down_revision: Union[str, None] = "c1o2n3t4r5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_empleados_config"
_COLUMNA = "profundidad_equipo"


def upgrade() -> None:
    if not table_exists(_TABLA):
        return
    if _COLUMNA not in column_names(_TABLA):
        op.add_column(_TABLA, sa.Column(_COLUMNA, sa.Integer(), nullable=True))


def downgrade() -> None:
    if not table_exists(_TABLA):
        return
    if _COLUMNA in column_names(_TABLA):
        op.drop_column(_TABLA, _COLUMNA)
