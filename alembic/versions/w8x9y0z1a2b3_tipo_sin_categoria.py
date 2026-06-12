"""tipo sin categoria

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w8x9y0z1a2b3"
down_revision: Union[str, Sequence[str], None] = "v7w8x9y0z1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("tipos_competencia", "categoria")


def downgrade() -> None:
    op.add_column(
        "tipos_competencia",
        sa.Column("categoria", sa.String(length=20), nullable=True),
    )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE tipos_competencia t "
            "SET categoria = CASE "
            "  WHEN lower(g.nombre) LIKE '%tecnica%' "
            "    OR lower(g.nombre) LIKE '%técnica%' THEN 'tecnica' "
            "  ELSE 'blanda' "
            "END "
            "FROM grupos_competencia g "
            "WHERE t.grupo_competencia_id = g.id"
        )
    )

    op.alter_column("tipos_competencia", "categoria", nullable=False)
