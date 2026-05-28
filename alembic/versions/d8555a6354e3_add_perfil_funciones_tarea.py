"""add perfil_funciones_tarea

Revision ID: d8555a6354e3
Revises: 04548db06678
Create Date: 2026-05-27 20:31:57.295292

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.migration_helpers import table_exists

# revision identifiers, used by Alembic.
revision: str = 'd8555a6354e3'
down_revision: Union[str, None] = '04548db06678'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("perfil_funciones_tarea"):
        return
    op.create_table('perfil_funciones_tarea',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('perfil_funciones_id', sa.Integer(), nullable=False),
    sa.Column('tarea_catalogo_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['perfil_funciones_id'], ['perfil_funciones.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tarea_catalogo_id'], ['tareas_catalogo.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('perfil_funciones_id', 'tarea_catalogo_id', name='uq_perfil_funciones_tarea_pair')
    )


def downgrade() -> None:
    op.drop_table('perfil_funciones_tarea')
