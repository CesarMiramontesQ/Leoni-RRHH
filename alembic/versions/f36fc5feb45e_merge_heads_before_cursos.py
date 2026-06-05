"""merge_heads_before_cursos

Revision ID: f36fc5feb45e
Revises: m1n2o3p4q5r6, q2r3s4t5u6v7
Create Date: 2026-06-05 02:46:00.800773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f36fc5feb45e'
down_revision: Union[str, None] = ('m1n2o3p4q5r6', 'q2r3s4t5u6v7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
