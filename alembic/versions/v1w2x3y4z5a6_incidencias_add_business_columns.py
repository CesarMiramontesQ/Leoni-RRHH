"""incidencias add business fields for bono mapping

Revision ID: v1w2x3y4z5a6
Revises: u7v8w9x0y1z2
Create Date: 2026-05-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v1w2x3y4z5a6"
down_revision: Union[str, None] = "u7v8w9x0y1z2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidencias",
        sa.Column("no_empleado", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("nombre", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("fecha", sa.Date(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("semana_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("numero_semana", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("categoria", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("detalle", sa.Text(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("descuento_porcentaje", sa.Float(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("estatus_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("area", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("subarea", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("incidencias", "subarea")
    op.drop_column("incidencias", "area")
    op.drop_column("incidencias", "estatus_id")
    op.drop_column("incidencias", "descuento_porcentaje")
    op.drop_column("incidencias", "detalle")
    op.drop_column("incidencias", "categoria")
    op.drop_column("incidencias", "numero_semana")
    op.drop_column("incidencias", "semana_id")
    op.drop_column("incidencias", "fecha")
    op.drop_column("incidencias", "nombre")
    op.drop_column("incidencias", "no_empleado")
