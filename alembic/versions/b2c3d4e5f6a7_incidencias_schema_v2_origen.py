"""incidencias: origen/synced_at, quitar semana/estatus/descuento, tipo 255

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("incidencias", "semana_id")
    op.drop_column("incidencias", "numero_semana")
    op.drop_column("incidencias", "descuento_porcentaje")
    op.drop_column("incidencias", "estatus_id")
    op.alter_column(
        "incidencias",
        "tipo",
        existing_type=sa.String(length=100),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.add_column(
        "incidencias",
        sa.Column(
            "origen",
            sa.String(length=32),
            nullable=False,
            server_default="manual",
        ),
    )
    op.add_column(
        "incidencias",
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_incidencias_origen", "incidencias", ["origen"], unique=False)
    op.create_index("ix_incidencias_tipo", "incidencias", ["tipo"], unique=False)
    op.create_index("ix_incidencias_fecha", "incidencias", ["fecha"], unique=False)
    op.create_index("ix_incidencias_empleado_id", "incidencias", ["empleado_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_incidencias_empleado_id", table_name="incidencias")
    op.drop_index("ix_incidencias_fecha", table_name="incidencias")
    op.drop_index("ix_incidencias_tipo", table_name="incidencias")
    op.drop_index("ix_incidencias_origen", table_name="incidencias")
    op.drop_column("incidencias", "synced_at")
    op.drop_column("incidencias", "origen")
    op.alter_column(
        "incidencias",
        "tipo",
        existing_type=sa.String(length=255),
        type_=sa.String(length=100),
        existing_nullable=False,
    )
    op.add_column("incidencias", sa.Column("estatus_id", sa.Integer(), nullable=True))
    op.add_column(
        "incidencias",
        sa.Column("descuento_porcentaje", sa.Float(), nullable=True),
    )
    op.add_column("incidencias", sa.Column("numero_semana", sa.Integer(), nullable=True))
    op.add_column("incidencias", sa.Column("semana_id", sa.Integer(), nullable=True))
