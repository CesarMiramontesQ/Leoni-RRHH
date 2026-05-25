"""add habilidades table

Revision ID: 92b8f9f2627c
Revises: v5w6x7y8z9a0
Create Date: 2026-05-20 00:33:27.873744

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '92b8f9f2627c'
down_revision: Union[str, None] = 'v5w6x7y8z9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('habilidades', sa.Column('niveles_descripcion', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.alter_column('habilidades', 'tipo',
               existing_type=postgresql.ENUM('tecnica', 'blanda', 'operativa', 'critica', name='tipo_habilidad_enum'),
               type_=sa.String(length=30),
               existing_nullable=False,
               postgresql_using='tipo::text')
    op.drop_column('habilidades', 'nivel_max')


def downgrade() -> None:
    op.add_column('habilidades', sa.Column('nivel_max', sa.INTEGER(), autoincrement=False, nullable=False, server_default=sa.text('4')))
    op.alter_column('habilidades', 'tipo',
               existing_type=sa.String(length=30),
               type_=postgresql.ENUM('tecnica', 'blanda', 'operativa', 'critica', name='tipo_habilidad_enum', create_type=False),
               existing_nullable=False,
               postgresql_using='tipo::tipo_habilidad_enum')
    op.drop_column('habilidades', 'niveles_descripcion')
