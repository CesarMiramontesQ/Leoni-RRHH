"""cualificaciones_anios

Revision ID: e9f0a1b2c3d4
Revises: d8555a6354e3
Create Date: 2026-05-27 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e9f0a1b2c3d4'
down_revision: Union[str, None] = 'd8555a6354e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('perfil_cualificaciones', sa.Column('anios_minimos', sa.Integer(), nullable=True))
    op.add_column('perfil_funciones_cualificacion', sa.Column('anios_actuales', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('perfil_funciones_cualificacion', 'anios_actuales')
    op.drop_column('perfil_cualificaciones', 'anios_minimos')
