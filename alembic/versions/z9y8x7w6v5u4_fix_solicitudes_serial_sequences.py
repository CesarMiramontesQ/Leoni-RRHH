"""Sincronizar secuencias id de solicitudes tras datos importados

Revision ID: z9y8x7w6v5u4
Revises: t3u4v5w6x7y8
Create Date: 2026-05-06

Si se insertaron filas con id explícito (restore, COPY, SQL manual), la secuencia
de PostgreSQL puede quedar por debajo del MAX(id) y los INSERT normales fallan
con duplicate key en solicitudes_pkey.

Solo aplica a PostgreSQL; los tests usan SQLite con create_all.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "z9y8x7w6v5u4"
down_revision: Union[str, None] = "t3u4v5w6x7y8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('solicitudes', 'id'),
            COALESCE((SELECT MAX(id) FROM solicitudes), 0) + 1,
            false
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('solicitud_aprobaciones', 'id'),
            COALESCE((SELECT MAX(id) FROM solicitud_aprobaciones), 0) + 1,
            false
        )
        """
    )


def downgrade() -> None:
    pass
