"""merge multiple heads

Revision ID: c5d968704019
Revises: 92b8f9f2627c, a1b2c3d4e5f6, y1z2a3b4c5d6
Create Date: 2026-05-25 19:36:51.532825

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d968704019'
down_revision: Union[str, None] = ("92b8f9f2627c", "a1b2c3d4e5f6", "y1z2a3b4c5d6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
