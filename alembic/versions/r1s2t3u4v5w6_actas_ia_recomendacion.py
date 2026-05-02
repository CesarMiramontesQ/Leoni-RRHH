"""add ia_recomendacion to actas

Revision ID: r1s2t3u4v5w6
Revises: 9a1b2c3d4e5f
Create Date: 2026-05-02 13:45:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "r1s2t3u4v5w6"
down_revision: Union[str, None] = "9a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "actas_administrativas",
        sa.Column("ia_recomendacion", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("actas_administrativas", "ia_recomendacion")
