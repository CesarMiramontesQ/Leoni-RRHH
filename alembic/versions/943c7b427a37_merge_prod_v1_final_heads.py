"""Unifica heads prod v1 (competencias + vacaciones/bono).

Revision ID: 943c7b427a37
Revises: b3c4d5e6f7g8, h9i0j1k2l3m4
Create Date: 2026-05-28

Permite `alembic upgrade head` en producción (entrypoint-prod.sh).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '943c7b427a37'
down_revision: Union[str, None] = ('b3c4d5e6f7g8', 'h9i0j1k2l3m4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
