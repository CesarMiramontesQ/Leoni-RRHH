"""merge workflow y pdi heads

Revision ID: 81681181fd1d
Revises: e1v2a3l4w5f6, s9t0u1v2w3x4
Create Date: 2026-06-26 01:04:29.808758

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '81681181fd1d'
down_revision: Union[str, None] = ('e1v2a3l4w5f6', 's9t0u1v2w3x4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
