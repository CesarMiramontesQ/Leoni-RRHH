"""levelup_scheduler_job_log — número de intento de la corrida

Los jobs de sync reintentan con backoff tras una corrida con `error`; cada intento deja
su propia fila y esta columna dice cuál fue (1 = disparo del cron, 2..4 = reintentos).
NOT NULL con server_default '1': todas las corridas históricas fueron primer intento.

Revision ID: r1e2i3n4t5o6
Revises: z1r2e3t4h5o6
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision: str = "r1e2i3n4t5o6"
down_revision: Union[str, None] = "z1r2e3t4h5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = "levelup_scheduler_job_log"
_COLUMNA = "intento"


def upgrade() -> None:
    if not table_exists(_TABLA):
        return
    if _COLUMNA not in column_names(_TABLA):
        op.add_column(
            _TABLA,
            sa.Column(_COLUMNA, sa.Integer(), nullable=False, server_default="1"),
        )


def downgrade() -> None:
    if not table_exists(_TABLA):
        return
    if _COLUMNA in column_names(_TABLA):
        op.drop_column(_TABLA, _COLUMNA)
