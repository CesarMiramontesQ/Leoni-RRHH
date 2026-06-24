"""acciones recomendadas catalog

Revision ID: r7s8t9u0v1w2
Revises: g7h8i9j0k1l2
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "r7s8t9u0v1w2"
down_revision: Union[str, Sequence[str], None] = "6bf4543edd5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "levelup_acciones_recomendadas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("brecha_min", sa.SmallInteger(), nullable=False),
        sa.Column("brecha_max", sa.SmallInteger(), nullable=False),
        sa.Column("etiqueta", sa.String(100), nullable=False),
        sa.Column("color", sa.String(20), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("levelup_acciones_recomendadas")
