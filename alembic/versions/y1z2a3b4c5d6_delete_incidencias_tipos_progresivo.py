"""Eliminar incidencias tipo progresivo y progresivo_historico

Revision ID: y1z2a3b4c5d6
Revises: x8y7z6w5v4u3
Create Date: 2026-05-12
"""

from typing import Sequence, Union

from alembic import op

revision: str = "y1z2a3b4c5d6"
down_revision: Union[str, None] = "x8y7z6w5v4u3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Evidencias referencian incidencia por (entidad_tipo, entidad_id), sin FK.
    op.execute(
        """
        DELETE FROM evidencias
        WHERE entidad_tipo = 'incidencia'
          AND entidad_id IN (
            SELECT id FROM incidencias WHERE tipo IN ('progresivo', 'progresivo_historico')
          )
        """
    )
    # Actas pueden apuntar a incidencias.id.
    op.execute(
        """
        UPDATE actas_administrativas
        SET incidencia_id = NULL
        WHERE incidencia_id IN (
          SELECT id FROM incidencias WHERE tipo IN ('progresivo', 'progresivo_historico')
        )
        """
    )
    op.execute(
        """
        DELETE FROM incidencias
        WHERE tipo IN ('progresivo', 'progresivo_historico')
        """
    )


def downgrade() -> None:
    # Borrado de datos; no es posible restaurar filas eliminadas.
    pass
