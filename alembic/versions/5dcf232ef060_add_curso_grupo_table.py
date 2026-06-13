"""add curso_grupo table

Revision ID: 5dcf232ef060
Revises: 9da74a4d3527
Create Date: 2026-06-12 20:12:46.694691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5dcf232ef060'
down_revision: Union[str, None] = '9da74a4d3527'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('curso_grupo',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('curso_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.Enum('area', 'subarea', 'puesto', name='tipo_grupo_curso_enum'), nullable=False),
    sa.Column('referencia_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('curso_id', 'tipo', 'referencia_id', name='uq_curso_grupo')
    )
    op.create_index('ix_curso_grupo_curso_id', 'curso_grupo', ['curso_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_curso_grupo_curso_id', table_name='curso_grupo')
    op.drop_table('curso_grupo')
    op.execute("DROP TYPE IF EXISTS tipo_grupo_curso_enum")
