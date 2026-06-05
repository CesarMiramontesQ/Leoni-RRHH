"""cursos_add_requisitos

Revision ID: 2316721bbe51
Revises: add9d264f36d
Create Date: 2026-06-05 02:59:13.558851

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2316721bbe51'
down_revision: Union[str, None] = 'add9d264f36d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cursos', sa.Column('requisitos', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('cursos', 'requisitos')
