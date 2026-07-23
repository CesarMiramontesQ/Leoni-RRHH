"""calibracion desempeno: override de banda en ciclo_desempeno_resultado

Revision ID: c1a2l3i4b5r6
Revises: c1d2e3s4e5f1
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1a2l3i4b5r6"
down_revision: Union[str, None] = "c1d2e3s4e5f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "levelup_ciclo_desempeno_resultado"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("banda_desempeno_ajustada", sa.String(length=10), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajuste_motivo", sa.Text(), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajustada_por_id", sa.Integer(), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajustada_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_levelup_ciclo_desempeno_resultado_banda_ajustada_por",
        TABLE, "empleados",
        ["banda_ajustada_por_id"], ["empleado_id"],
        ondelete=None,
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_levelup_ciclo_desempeno_resultado_banda_ajustada_por", TABLE, type_="foreignkey"
    )
    op.drop_column(TABLE, "banda_ajustada_at")
    op.drop_column(TABLE, "banda_ajustada_por_id")
    op.drop_column(TABLE, "banda_ajuste_motivo")
    op.drop_column(TABLE, "banda_desempeno_ajustada")
