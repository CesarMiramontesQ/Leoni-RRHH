"""add tipo to curso_sesion

Revision ID: 6df1ab7d328a
Revises: 5dcf232ef060
Create Date: 2026-06-12 21:34:11.699747

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6df1ab7d328a'
down_revision: Union[str, None] = '5dcf232ef060'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('curso_sesion', sa.Column('tipo', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('curso_sesion', 'tipo')
