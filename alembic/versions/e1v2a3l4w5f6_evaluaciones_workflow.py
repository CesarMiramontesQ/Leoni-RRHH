"""Evaluaciones: agregar campo estado y comentario_devolucion para workflow

Revision ID: e1v2a3l4w5f6
Revises: w9x0y1z2a3b4
Create Date: 2026-06-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1v2a3l4w5f6"
down_revision: Union[str, None] = "w9x0y1z2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_evaluaciones_competencia",
        sa.Column("estado", sa.String(20), nullable=False, server_default="cerrado"),
    )
    op.add_column(
        "levelup_evaluaciones_competencia",
        sa.Column("comentario_devolucion", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_evaluaciones_estado",
        "levelup_evaluaciones_competencia",
        ["estado"],
    )


def downgrade() -> None:
    op.drop_index("ix_evaluaciones_estado", table_name="levelup_evaluaciones_competencia")
    op.drop_column("levelup_evaluaciones_competencia", "comentario_devolucion")
    op.drop_column("levelup_evaluaciones_competencia", "estado")
