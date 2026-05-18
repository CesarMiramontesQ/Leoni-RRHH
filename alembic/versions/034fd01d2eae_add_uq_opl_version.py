"""add_uq_opl_version

Revision ID: 034fd01d2eae
Revises: 242b98b667ff
Create Date: 2026-05-18 11:34:44.768247

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '034fd01d2eae'
down_revision: Union[str, None] = '242b98b667ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_opl_version', 'opl_versiones', ['opl_id', 'version_num'])


def downgrade() -> None:
    op.drop_constraint('uq_opl_version', 'opl_versiones', type_='unique')
