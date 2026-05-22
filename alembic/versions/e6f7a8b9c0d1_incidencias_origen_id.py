"""incidencias: columna origen_id e índice único (origen, origen_id)

Revision ID: e6f7a8b9c0d1
Revises: c4d5e6f7a8b9
Create Date: 2026-05-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidencias",
        sa.Column("origen_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_incidencias_origen_origen_id",
        "incidencias",
        ["origen", "origen_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_incidencias_origen_origen_id", table_name="incidencias")
    op.drop_column("incidencias", "origen_id")
