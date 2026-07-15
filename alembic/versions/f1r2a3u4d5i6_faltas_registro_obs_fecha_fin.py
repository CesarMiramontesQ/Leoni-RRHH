"""levelup_faltas_retardos_registro: observaciones y fecha_fin

Revision ID: f1r2a3u4d5i6
Revises: a1u2s3e4n5c6
Create Date: 2026-07-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1r2a3u4d5i6"
down_revision: Union[str, None] = "a1u2s3e4n5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_faltas_retardos_registro",
        sa.Column("observaciones", sa.Text(), nullable=True),
    )
    op.add_column(
        "levelup_faltas_retardos_registro",
        sa.Column("fecha_fin", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("levelup_faltas_retardos_registro", "fecha_fin")
    op.drop_column("levelup_faltas_retardos_registro", "observaciones")
