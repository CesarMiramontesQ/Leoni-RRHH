"""grupo sin categoria, tipo con categoria

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v7w8x9y0z1a2"
down_revision: Union[str, Sequence[str], None] = "u6v7w8x9y0z1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tipos_competencia",
        sa.Column("categoria", sa.String(length=20), nullable=True),
    )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE tipos_competencia t "
            "SET categoria = g.categoria "
            "FROM grupos_competencia g "
            "WHERE t.grupo_competencia_id = g.id"
        )
    )

    op.alter_column("tipos_competencia", "categoria", nullable=False)
    op.drop_column("grupos_competencia", "categoria")


def downgrade() -> None:
    op.add_column(
        "grupos_competencia",
        sa.Column("categoria", sa.String(length=20), nullable=True),
    )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE grupos_competencia g "
            "SET categoria = sub.categoria "
            "FROM ("
            "  SELECT DISTINCT ON (grupo_competencia_id) "
            "    grupo_competencia_id, categoria "
            "  FROM tipos_competencia "
            "  ORDER BY grupo_competencia_id, id"
            ") sub "
            "WHERE g.id = sub.grupo_competencia_id"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE grupos_competencia SET categoria = 'blanda' WHERE categoria IS NULL"
        )
    )

    op.alter_column("grupos_competencia", "categoria", nullable=False)
    op.drop_column("tipos_competencia", "categoria")
