"""add costo to curso_sesion

Revision ID: 7a2b3c4d5e6f
Revises: 6df1ab7d328a
Create Date: 2026-06-12 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7a2b3c4d5e6f'
down_revision: Union[str, None] = '6df1ab7d328a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('curso_sesion', sa.Column('costo', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('curso_sesion', 'costo')
