"""desempeno: historial objetivo como senal (peso_historial + indice)

Revision ID: h1s2t3s4e5n6
Revises: c1a2l3i4b5r6
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h1s2t3s4e5n6"
down_revision: Union[str, None] = "c1a2l3i4b5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CICLO = "levelup_ciclo_desempeno"
RESULTADO = "levelup_ciclo_desempeno_resultado"


def upgrade() -> None:
    op.add_column(
        CICLO,
        sa.Column("peso_historial", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )
    op.add_column(RESULTADO, sa.Column("indice_historial", sa.Numeric(6, 2), nullable=True))
    op.add_column(
        RESULTADO, sa.Column("peso_historial_efectivo", sa.Numeric(5, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column(RESULTADO, "peso_historial_efectivo")
    op.drop_column(RESULTADO, "indice_historial")
    op.drop_column(CICLO, "peso_historial")
