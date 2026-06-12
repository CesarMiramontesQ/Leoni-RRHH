"""merge_migration_heads

Revision ID: c9b8194509ba
Revises: 7a2b3c4d5e6f, e7f8g9h0i1j2
Create Date: 2026-06-12 22:28:34.504163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9b8194509ba'
down_revision: Union[str, None] = ('7a2b3c4d5e6f', 'e7f8g9h0i1j2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
