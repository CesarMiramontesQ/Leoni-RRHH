"""incidencias evaluacion_historica_gral: mover tipo → subtipo, tipo = Evaluacion

Revision ID: g8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-05-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g8b9c0d1e2f3"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ORIGEN_EVALUACION = "evaluacion_historica_gral"
_TIPO_EVALUACION = "Evaluacion"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE incidencias
            SET subtipo = tipo,
                tipo = :tipo_evaluacion
            WHERE origen = :origen
              AND tipo IS NOT NULL
              AND tipo <> :tipo_evaluacion
            """
        ).bindparams(
            origen=_ORIGEN_EVALUACION,
            tipo_evaluacion=_TIPO_EVALUACION,
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE incidencias
            SET tipo = subtipo,
                subtipo = NULL
            WHERE origen = :origen
              AND tipo = :tipo_evaluacion
              AND subtipo IS NOT NULL
            """
        ).bindparams(
            origen=_ORIGEN_EVALUACION,
            tipo_evaluacion=_TIPO_EVALUACION,
        )
    )
