"""cursos_catalogo_tipo_clasificacion_stubs

Revision ID: add9d264f36d
Revises: f36fc5feb45e
Create Date: 2026-06-05 02:46:09.725301

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add9d264f36d'
down_revision: Union[str, None] = 'f36fc5feb45e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- create enums first --
    tipo_curso_enum = sa.Enum('interno', 'externo', name='tipo_curso_enum')
    tipo_curso_enum.create(op.get_bind(), checkfirst=True)
    clasificacion_curso_enum = sa.Enum('adicional', 'contemplado', name='clasificacion_curso_enum')
    clasificacion_curso_enum.create(op.get_bind(), checkfirst=True)

    # -- cursos: new columns --
    op.add_column('cursos', sa.Column('tipo', tipo_curso_enum, nullable=True))
    op.add_column('cursos', sa.Column('clasificacion', clasificacion_curso_enum, nullable=True))
    op.add_column('cursos', sa.Column('obligatorio', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('cursos', sa.Column('descripcion', sa.Text(), nullable=True))
    op.alter_column('cursos', 'nombre',
               existing_type=sa.VARCHAR(length=255),
               type_=sa.String(length=300),
               existing_nullable=False)
    op.alter_column('cursos', 'duracion_horas',
               existing_type=sa.INTEGER(),
               type_=sa.Float(),
               nullable=True)
    op.alter_column('cursos', 'categoria',
               existing_type=sa.Enum('tecnico', 'calidad', 'seguridad', 'operativo', 'blanda', name='categoria_curso_enum'),
               nullable=True)
    op.alter_column('cursos', 'modalidad',
               existing_type=sa.VARCHAR(length=50),
               nullable=True)
    op.create_unique_constraint('uq_cursos_nombre', 'cursos', ['nombre'])

    # -- curso_empleado --
    op.create_table('curso_empleado',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('curso_id', sa.Integer(), nullable=False),
    sa.Column('empleado_id', sa.Integer(), nullable=False),
    sa.Column('fecha', sa.Date(), nullable=True),
    sa.Column('horas', sa.Float(), nullable=True),
    sa.Column('centro_costo', sa.Integer(), nullable=True),
    sa.Column('tipo', sa.String(length=20), nullable=True),
    sa.Column('clasificacion', sa.String(length=20), nullable=True),
    sa.Column('obligatorio', sa.Boolean(), nullable=True),
    sa.Column('puesto_al_momento', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['empleado_id'], ['empleados.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_curso_empleado_curso_id', 'curso_empleado', ['curso_id'], unique=False)
    op.create_index('ix_curso_empleado_empleado_id', 'curso_empleado', ['empleado_id'], unique=False)

    # -- curso_puesto --
    op.create_table('curso_puesto',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('curso_id', sa.Integer(), nullable=False),
    sa.Column('puesto_perfil_id', sa.Integer(), nullable=False),
    sa.Column('obligatorio', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['puesto_perfil_id'], ['puestos_perfil.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('curso_id', 'puesto_perfil_id', name='uq_curso_puesto')
    )


def downgrade() -> None:
    op.drop_table('curso_puesto')
    op.drop_index('ix_curso_empleado_empleado_id', table_name='curso_empleado')
    op.drop_index('ix_curso_empleado_curso_id', table_name='curso_empleado')
    op.drop_table('curso_empleado')
    op.drop_constraint('uq_cursos_nombre', 'cursos', type_='unique')
    op.alter_column('cursos', 'modalidad',
               existing_type=sa.VARCHAR(length=50),
               nullable=False)
    op.alter_column('cursos', 'categoria',
               existing_type=sa.Enum('tecnico', 'calidad', 'seguridad', 'operativo', 'blanda', name='categoria_curso_enum'),
               nullable=False)
    op.alter_column('cursos', 'duracion_horas',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               nullable=False)
    op.alter_column('cursos', 'nombre',
               existing_type=sa.String(length=300),
               type_=sa.VARCHAR(length=255),
               existing_nullable=False)
    op.drop_column('cursos', 'descripcion')
    op.drop_column('cursos', 'obligatorio')
    op.drop_column('cursos', 'clasificacion')
    op.drop_column('cursos', 'tipo')
