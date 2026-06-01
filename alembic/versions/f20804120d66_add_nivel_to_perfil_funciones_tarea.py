"""add nivel to perfil_funciones_tarea

Revision ID: f20804120d66
Revises: e9f0a1b2c3d4
Create Date: 2026-06-01 16:47:53.483243

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f20804120d66'
down_revision: Union[str, None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'perfil_funciones_tarea',
        sa.Column('nivel', sa.Integer(), nullable=True, comment='1=Basico, 2=Medio, 3=Experto'),
    )
    op.create_check_constraint(
        'ck_perfil_funciones_tarea_nivel',
        'perfil_funciones_tarea',
        'nivel IS NULL OR (nivel >= 1 AND nivel <= 3)',
    )


def downgrade() -> None:
    op.drop_constraint('ck_perfil_funciones_tarea_nivel', 'perfil_funciones_tarea', type_='check')
    op.drop_column('perfil_funciones_tarea', 'nivel')
