"""pdi prioridad recursos

Revision ID: p2d3i4p5r6i7
Revises: 81681181fd1d
Create Date: 2026-06-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "p2d3i4p5r6i7"
down_revision: Union[str, None] = "81681181fd1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_plan_desarrollo_individual",
        sa.Column("prioridad", sa.String(10), nullable=True, server_default="media"),
    )
    op.add_column(
        "levelup_plan_desarrollo_individual",
        sa.Column("recursos", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("levelup_plan_desarrollo_individual", "recursos")
    op.drop_column("levelup_plan_desarrollo_individual", "prioridad")
