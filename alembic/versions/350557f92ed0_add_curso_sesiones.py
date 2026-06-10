"""add_curso_sesiones

Revision ID: 350557f92ed0
Revises: 2316721bbe51
Create Date: 2026-06-05 04:44:01.432196

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '350557f92ed0'
down_revision: Union[str, None] = '2316721bbe51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create estado_sesion_enum type
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE estado_sesion_enum AS ENUM ('programada', 'en_curso', 'completada', 'cancelada'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    )

    # Create curso_sesion table
    op.create_table('curso_sesion',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('curso_id', sa.Integer(), nullable=False),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_fin', sa.Date(), nullable=True),
        sa.Column('hora_inicio', sa.Time(), nullable=True),
        sa.Column('hora_fin', sa.Time(), nullable=True),
        sa.Column('ubicacion', sa.String(length=255), nullable=True),
        sa.Column('instructor', sa.String(length=255), nullable=True),
        sa.Column('cupo_max', sa.Integer(), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('estado', postgresql.ENUM('programada', 'en_curso', 'completada', 'cancelada', name='estado_sesion_enum', create_type=False), nullable=False, server_default='programada'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add sesion_id to curso_puesto
    op.add_column('curso_puesto', sa.Column('sesion_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_curso_puesto_sesion_id', 'curso_puesto', 'curso_sesion',
        ['sesion_id'], ['id'], ondelete='SET NULL'
    )

    # Add sesion_id and asistio to curso_empleado
    op.add_column('curso_empleado', sa.Column('sesion_id', sa.Integer(), nullable=True))
    op.add_column('curso_empleado', sa.Column('asistio', sa.Boolean(), nullable=True))
    op.create_foreign_key(
        'fk_curso_empleado_sesion_id', 'curso_empleado', 'curso_sesion',
        ['sesion_id'], ['id'], ondelete='SET NULL'
    )

    # Replace unique constraint on curso_puesto with partial indexes
    op.drop_constraint('uq_curso_puesto', 'curso_puesto', type_='unique')
    op.execute(
        "CREATE UNIQUE INDEX uq_curso_puesto_sesion "
        "ON curso_puesto(curso_id, puesto_perfil_id, sesion_id) "
        "WHERE sesion_id IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_curso_puesto_legacy "
        "ON curso_puesto(curso_id, puesto_perfil_id) "
        "WHERE sesion_id IS NULL"
    )


def downgrade() -> None:
    # Remove partial indexes and restore original unique constraint
    op.execute("DROP INDEX IF EXISTS uq_curso_puesto_sesion")
    op.execute("DROP INDEX IF EXISTS uq_curso_puesto_legacy")
    op.create_unique_constraint('uq_curso_puesto', 'curso_puesto', ['curso_id', 'puesto_perfil_id'])

    # Remove columns from curso_empleado
    op.drop_constraint('fk_curso_empleado_sesion_id', 'curso_empleado', type_='foreignkey')
    op.drop_column('curso_empleado', 'asistio')
    op.drop_column('curso_empleado', 'sesion_id')

    # Remove column from curso_puesto
    op.drop_constraint('fk_curso_puesto_sesion_id', 'curso_puesto', type_='foreignkey')
    op.drop_column('curso_puesto', 'sesion_id')

    # Drop curso_sesion table
    op.drop_table('curso_sesion')

    # Drop enum
    sa.Enum(name='estado_sesion_enum').drop(op.get_bind(), checkfirst=True)
