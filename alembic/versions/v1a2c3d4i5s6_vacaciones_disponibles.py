"""levelup_vacaciones_disponibles — saldo por no_empleado

Revision ID: v1a2c3d4i5s6
Revises: p2d3i4p5r6i7
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "v1a2c3d4i5s6"
down_revision: Union[str, None] = "p2d3i4p5r6i7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_vacaciones_disponibles"):
        return

    op.create_table(
        "levelup_vacaciones_disponibles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("dias", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("no_empleado", name="uq_levelup_vacaciones_disponibles_no_empleado"),
    )


def downgrade() -> None:
    if not table_exists("levelup_vacaciones_disponibles"):
        return
    op.drop_table("levelup_vacaciones_disponibles")
