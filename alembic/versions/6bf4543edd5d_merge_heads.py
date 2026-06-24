"""merge heads

Revision ID: 6bf4543edd5d
Revises: g7h8i9j0k1l2, v1l2u3p0base
Create Date: 2026-06-24 17:12:26.738310

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6bf4543edd5d'
down_revision: Union[str, None] = ('g7h8i9j0k1l2', 'v1l2u3p0base')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
