"""add comedor_codigos_externos

Revision ID: 0b237ebcdd8b
Revises: m4n5o6p7q8r9
Create Date: 2026-04-28 14:29:11.326706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0b237ebcdd8b'
down_revision: Union[str, None] = 'm4n5o6p7q8r9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tipo_comida_enum = postgresql.ENUM(
        "casera",
        "saludable",
        name="comedor_tipo_comida_enum",
        create_type=False,
    )
    op.create_table('comedor_codigos_externos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('comedor_id', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('fecha_inicio', sa.Date(), nullable=False),
    sa.Column('fecha_fin', sa.Date(), nullable=False),
    sa.Column('cantidad_personas', sa.Integer(), nullable=False),
    sa.Column('tipo_comida', tipo_comida_enum, nullable=False),
    sa.Column('codigo_acceso', sa.String(length=80), nullable=False),
    sa.Column('password_temporal', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['comedor_id'], ['comedores.id'], ),
    sa.ForeignKeyConstraint(['created_by'], ['empleados.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_comedor_codigos_externos_codigo', 'comedor_codigos_externos', ['codigo_acceso'], unique=False)
    op.create_index('ix_comedor_codigos_externos_fecha_fin', 'comedor_codigos_externos', ['fecha_fin'], unique=False)
    op.create_index('ix_comedor_codigos_externos_fecha_inicio', 'comedor_codigos_externos', ['fecha_inicio'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_comedor_codigos_externos_fecha_inicio', table_name='comedor_codigos_externos')
    op.drop_index('ix_comedor_codigos_externos_fecha_fin', table_name='comedor_codigos_externos')
    op.drop_index('ix_comedor_codigos_externos_codigo', table_name='comedor_codigos_externos')
    op.drop_table('comedor_codigos_externos')
