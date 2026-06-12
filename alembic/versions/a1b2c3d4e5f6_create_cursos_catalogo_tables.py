"""create_cursos_catalogo_tables

Revision ID: a1b2c3d4e5f6
Revises: c9b8194509ba
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c9b8194509ba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "curso_categoria",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_curso_categoria_nombre"),
    )

    op.create_table(
        "curso_tipo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_curso_tipo_nombre"),
    )

    op.create_table(
        "curso_clasificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_curso_clasificacion_nombre"),
    )

    op.create_table(
        "curso_instructor_externo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("especialidad", sa.String(255), nullable=True),
        sa.Column("empresa", sa.String(255), nullable=True),
        sa.Column("contacto", sa.String(255), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "curso_proveedor",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("contacto", sa.String(255), nullable=True),
        sa.Column("telefono", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("direccion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_curso_proveedor_nombre"),
    )

    # Seed categorías from existing enum values
    op.execute("""
        INSERT INTO curso_categoria (nombre) VALUES
        ('tecnico'), ('calidad'), ('seguridad'), ('operativo'), ('blanda')
    """)

    # Seed tipos from existing enum values
    op.execute("""
        INSERT INTO curso_tipo (nombre) VALUES
        ('interno'), ('externo')
    """)

    # Seed clasificaciones from existing enum values
    op.execute("""
        INSERT INTO curso_clasificacion (nombre) VALUES
        ('adicional'), ('contemplado')
    """)

    # Seed proveedores from existing data
    op.execute("""
        INSERT INTO curso_proveedor (nombre)
        SELECT DISTINCT proveedor FROM cursos
        WHERE proveedor IS NOT NULL AND TRIM(proveedor) != ''
        ON CONFLICT DO NOTHING
    """)

    # Seed instructores externos from existing data
    op.execute("""
        INSERT INTO curso_instructor_externo (nombre)
        SELECT DISTINCT instructor FROM cursos
        WHERE instructor IS NOT NULL AND TRIM(instructor) != ''
    """)

    # Also seed from curso_sesion.instructor
    op.execute("""
        INSERT INTO curso_instructor_externo (nombre)
        SELECT DISTINCT cs.instructor FROM curso_sesion cs
        WHERE cs.instructor IS NOT NULL AND TRIM(cs.instructor) != ''
        AND cs.instructor NOT IN (SELECT nombre FROM curso_instructor_externo)
    """)


def downgrade() -> None:
    op.drop_table("curso_proveedor")
    op.drop_table("curso_instructor_externo")
    op.drop_table("curso_clasificacion")
    op.drop_table("curso_tipo")
    op.drop_table("curso_categoria")
