"""add_centro_costos_to_cursos

Revision ID: e12d9114fab6
Revises: 350557f92ed0
Create Date: 2026-06-05 05:56:55.987057

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e12d9114fab6'
down_revision: Union[str, None] = '350557f92ed0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cursos', sa.Column('centro_costos', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('cursos', 'centro_costos')
