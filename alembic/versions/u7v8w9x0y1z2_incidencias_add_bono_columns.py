"""incidencias add bono source columns

Revision ID: u7v8w9x0y1z2
Revises: f6e5d4c3b2a1
Create Date: 2026-05-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u7v8w9x0y1z2"
down_revision: Union[str, None] = "f6e5d4c3b2a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidencias",
        sa.Column("bono_source_key", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_tipo", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_categoria", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_detalle", sa.Text(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_fecha", sa.Date(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_semana_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_numero_semana", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_descuento_porcentaje", sa.Float(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_estatus_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_area", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidencias",
        sa.Column("bono_subarea", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_incidencias_bono_source_key_unique",
        "incidencias",
        ["bono_source_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_incidencias_bono_source_key_unique", table_name="incidencias")
    op.drop_column("incidencias", "bono_subarea")
    op.drop_column("incidencias", "bono_area")
    op.drop_column("incidencias", "bono_estatus_id")
    op.drop_column("incidencias", "bono_descuento_porcentaje")
    op.drop_column("incidencias", "bono_numero_semana")
    op.drop_column("incidencias", "bono_semana_id")
    op.drop_column("incidencias", "bono_fecha")
    op.drop_column("incidencias", "bono_detalle")
    op.drop_column("incidencias", "bono_categoria")
    op.drop_column("incidencias", "bono_tipo")
    op.drop_column("incidencias", "bono_source_key")
