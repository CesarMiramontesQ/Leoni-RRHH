"""unificar competencias: eliminar perfil_competencias_requeridas

Revision ID: b3c4d5e6f7g8
Revises: a7b8c9d0e1f2
Create Date: 2026-05-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7g8'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add orden column to competencia_requisitos
    op.add_column('competencia_requisitos', sa.Column('orden', sa.SmallInteger(), nullable=True))

    # 2. Add competencia_requisito_id column to perfil_funciones_competencia
    op.add_column('perfil_funciones_competencia', sa.Column('competencia_requisito_id', sa.Integer(), nullable=True))

    # 3. Migrate data: perfil_competencias_requeridas → competencia_requisitos
    # Use DISTINCT ON to avoid duplicate rows for same (competencia_id, puesto_perfil_id)
    op.execute("""
        INSERT INTO competencia_requisitos (competencia_id, puesto_perfil_id, nivel_requerido, orden)
        SELECT DISTINCT ON (pcr.competencia_id, pcr.puesto_perfil_id)
            pcr.competencia_id, pcr.puesto_perfil_id, 0, pcr.orden
        FROM perfil_competencias_requeridas pcr
        WHERE pcr.competencia_id IS NOT NULL
        ORDER BY pcr.competencia_id, pcr.puesto_perfil_id, pcr.orden
        ON CONFLICT (competencia_id, puesto_perfil_id) DO UPDATE SET orden = EXCLUDED.orden
    """)

    # 4. Update perfil_funciones_competencia to point to competencia_requisitos
    op.execute("""
        UPDATE perfil_funciones_competencia pfc
        SET competencia_requisito_id = cr.id
        FROM perfil_competencias_requeridas pcr
        JOIN competencia_requisitos cr ON cr.competencia_id = pcr.competencia_id
            AND cr.puesto_perfil_id = pcr.puesto_perfil_id
        WHERE pfc.competencia_requerida_id = pcr.id
    """)

    # 5. Drop old FK and column from perfil_funciones_competencia
    op.drop_constraint('perfil_funciones_competencia_competencia_requerida_id_fkey', 'perfil_funciones_competencia', type_='foreignkey')
    op.drop_column('perfil_funciones_competencia', 'competencia_requerida_id')

    # 6. Add FK constraint for new column
    op.create_foreign_key(
        'fk_pfc_competencia_requisito',
        'perfil_funciones_competencia', 'competencia_requisitos',
        ['competencia_requisito_id'], ['id'],
        ondelete='CASCADE'
    )

    # 7. Drop the old table
    op.drop_table('perfil_competencias_requeridas')


def downgrade() -> None:
    # Recreate perfil_competencias_requeridas
    op.create_table(
        'perfil_competencias_requeridas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('puesto_perfil_id', sa.Integer(), nullable=False),
        sa.Column('competencia_id', sa.Integer(), nullable=True),
        sa.Column('categoria', sa.String(50), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=False),
        sa.Column('orden', sa.SmallInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['puesto_perfil_id'], ['puestos_perfil.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['competencia_id'], ['competencias.id'], ondelete='SET NULL'),
    )

    # Restore competencia_requerida_id on perfil_funciones_competencia
    op.drop_constraint('fk_pfc_competencia_requisito', 'perfil_funciones_competencia', type_='foreignkey')
    op.add_column('perfil_funciones_competencia', sa.Column('competencia_requerida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'perfil_funciones_competencia_competencia_requerida_id_fkey',
        'perfil_funciones_competencia', 'perfil_competencias_requeridas',
        ['competencia_requerida_id'], ['id']
    )
    op.drop_column('perfil_funciones_competencia', 'competencia_requisito_id')

    # Drop orden from competencia_requisitos
    op.drop_column('competencia_requisitos', 'orden')
