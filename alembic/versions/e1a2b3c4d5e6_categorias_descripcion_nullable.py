"""categorias descripcion nullable

Revision ID: e1a2b3c4d5e6
Revises: d4f8a1c2e9b0
Create Date: 2026-04-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, None] = "d4f8a1c2e9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "categorias",
        "descripcion",
        existing_type=sa.String(length=150),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE categorias SET descripcion = '' WHERE descripcion IS NULL")
    )
    op.alter_column(
        "categorias",
        "descripcion",
        existing_type=sa.String(length=150),
        nullable=False,
    )
