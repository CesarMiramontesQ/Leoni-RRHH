"""cursos_migrate_enums_to_fk

Revision ID: cc02_cursos_fk_swap
Revises: cc01_cursos_cat_tbl
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cc02_cursos_fk_swap"
down_revision: Union[str, None] = "cc01_cursos_cat_tbl"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Add FK columns to cursos ────────────────────────────────────────────
    op.add_column("cursos", sa.Column("categoria_id", sa.Integer(), nullable=True))
    op.add_column("cursos", sa.Column("tipo_id", sa.Integer(), nullable=True))
    op.add_column("cursos", sa.Column("clasificacion_id", sa.Integer(), nullable=True))
    op.add_column("cursos", sa.Column("proveedor_id", sa.Integer(), nullable=True))
    op.add_column("cursos", sa.Column("instructor_tipo", sa.String(10), nullable=True))
    op.add_column("cursos", sa.Column("instructor_empleado_id", sa.Integer(), nullable=True))
    op.add_column("cursos", sa.Column("instructor_externo_id", sa.Integer(), nullable=True))

    op.create_foreign_key("fk_cursos_categoria_id", "cursos", "curso_categoria", ["categoria_id"], ["id"])
    op.create_foreign_key("fk_cursos_tipo_id", "cursos", "curso_tipo", ["tipo_id"], ["id"])
    op.create_foreign_key("fk_cursos_clasificacion_id", "cursos", "curso_clasificacion", ["clasificacion_id"], ["id"])
    op.create_foreign_key("fk_cursos_proveedor_id", "cursos", "curso_proveedor", ["proveedor_id"], ["id"])
    op.create_foreign_key("fk_cursos_instructor_empleado_id", "cursos", "empleados", ["instructor_empleado_id"], ["id"])
    op.create_foreign_key("fk_cursos_instructor_externo_id", "cursos", "curso_instructor_externo", ["instructor_externo_id"], ["id"])

    # ── Populate FK columns from old data ───────────────────────────────────
    op.execute("""
        UPDATE cursos SET categoria_id = cc.id
        FROM curso_categoria cc
        WHERE cursos.categoria IS NOT NULL AND cc.nombre = cursos.categoria::text
    """)
    op.execute("""
        UPDATE cursos SET tipo_id = ct.id
        FROM curso_tipo ct
        WHERE cursos.tipo IS NOT NULL AND ct.nombre = cursos.tipo::text
    """)
    op.execute("""
        UPDATE cursos SET clasificacion_id = ccl.id
        FROM curso_clasificacion ccl
        WHERE cursos.clasificacion IS NOT NULL AND ccl.nombre = cursos.clasificacion::text
    """)
    op.execute("""
        UPDATE cursos SET proveedor_id = cp.id
        FROM curso_proveedor cp
        WHERE cursos.proveedor IS NOT NULL AND cp.nombre = cursos.proveedor
    """)
    # All existing instructors treated as external (no FK to empleados existed before)
    op.execute("""
        UPDATE cursos SET instructor_tipo = 'externo', instructor_externo_id = cie.id
        FROM curso_instructor_externo cie
        WHERE cursos.instructor IS NOT NULL AND cie.nombre = cursos.instructor
    """)

    # ── Drop old columns from cursos ────────────────────────────────────────
    op.drop_column("cursos", "categoria")
    op.drop_column("cursos", "tipo")
    op.drop_column("cursos", "clasificacion")
    op.drop_column("cursos", "instructor")
    op.drop_column("cursos", "proveedor")

    # ── Add FK columns to curso_sesion ──────────────────────────────────────
    op.add_column("curso_sesion", sa.Column("instructor_tipo", sa.String(10), nullable=True))
    op.add_column("curso_sesion", sa.Column("instructor_empleado_id", sa.Integer(), nullable=True))
    op.add_column("curso_sesion", sa.Column("instructor_externo_id", sa.Integer(), nullable=True))

    op.create_foreign_key("fk_curso_sesion_instructor_empleado_id", "curso_sesion", "empleados", ["instructor_empleado_id"], ["id"])
    op.create_foreign_key("fk_curso_sesion_instructor_externo_id", "curso_sesion", "curso_instructor_externo", ["instructor_externo_id"], ["id"])

    # Populate from existing varchar
    op.execute("""
        UPDATE curso_sesion SET instructor_tipo = 'externo', instructor_externo_id = cie.id
        FROM curso_instructor_externo cie
        WHERE curso_sesion.instructor IS NOT NULL AND cie.nombre = curso_sesion.instructor
    """)

    op.drop_column("curso_sesion", "instructor")

    # ── Drop unused enum types ──────────────────────────────────────────────
    op.execute("DROP TYPE IF EXISTS categoria_curso_enum")
    op.execute("DROP TYPE IF EXISTS tipo_curso_enum")
    op.execute("DROP TYPE IF EXISTS clasificacion_curso_enum")


def downgrade() -> None:
    # Re-create enum types
    op.execute("CREATE TYPE categoria_curso_enum AS ENUM ('tecnico','calidad','seguridad','operativo','blanda')")
    op.execute("CREATE TYPE tipo_curso_enum AS ENUM ('interno','externo')")
    op.execute("CREATE TYPE clasificacion_curso_enum AS ENUM ('adicional','contemplado')")

    # Re-add old columns to curso_sesion
    op.add_column("curso_sesion", sa.Column("instructor", sa.String(255), nullable=True))
    op.execute("""
        UPDATE curso_sesion SET instructor = cie.nombre
        FROM curso_instructor_externo cie
        WHERE curso_sesion.instructor_externo_id = cie.id
    """)
    op.drop_constraint("fk_curso_sesion_instructor_externo_id", "curso_sesion", type_="foreignkey")
    op.drop_constraint("fk_curso_sesion_instructor_empleado_id", "curso_sesion", type_="foreignkey")
    op.drop_column("curso_sesion", "instructor_externo_id")
    op.drop_column("curso_sesion", "instructor_empleado_id")
    op.drop_column("curso_sesion", "instructor_tipo")

    # Re-add old columns to cursos
    op.add_column("cursos", sa.Column("categoria", sa.Enum("tecnico", "calidad", "seguridad", "operativo", "blanda", name="categoria_curso_enum"), nullable=True))
    op.add_column("cursos", sa.Column("tipo", sa.Enum("interno", "externo", name="tipo_curso_enum"), nullable=True))
    op.add_column("cursos", sa.Column("clasificacion", sa.Enum("adicional", "contemplado", name="clasificacion_curso_enum"), nullable=True))
    op.add_column("cursos", sa.Column("instructor", sa.String(255), nullable=True))
    op.add_column("cursos", sa.Column("proveedor", sa.String(255), nullable=True))

    # Populate from FK
    op.execute("""
        UPDATE cursos SET categoria = cc.nombre::categoria_curso_enum
        FROM curso_categoria cc WHERE cursos.categoria_id = cc.id
    """)
    op.execute("""
        UPDATE cursos SET tipo = ct.nombre::tipo_curso_enum
        FROM curso_tipo ct WHERE cursos.tipo_id = ct.id
    """)
    op.execute("""
        UPDATE cursos SET clasificacion = ccl.nombre::clasificacion_curso_enum
        FROM curso_clasificacion ccl WHERE cursos.clasificacion_id = ccl.id
    """)
    op.execute("""
        UPDATE cursos SET proveedor = cp.nombre
        FROM curso_proveedor cp WHERE cursos.proveedor_id = cp.id
    """)
    op.execute("""
        UPDATE cursos SET instructor = cie.nombre
        FROM curso_instructor_externo cie WHERE cursos.instructor_externo_id = cie.id
    """)

    op.drop_constraint("fk_cursos_instructor_externo_id", "cursos", type_="foreignkey")
    op.drop_constraint("fk_cursos_instructor_empleado_id", "cursos", type_="foreignkey")
    op.drop_constraint("fk_cursos_proveedor_id", "cursos", type_="foreignkey")
    op.drop_constraint("fk_cursos_clasificacion_id", "cursos", type_="foreignkey")
    op.drop_constraint("fk_cursos_tipo_id", "cursos", type_="foreignkey")
    op.drop_constraint("fk_cursos_categoria_id", "cursos", type_="foreignkey")
    op.drop_column("cursos", "instructor_externo_id")
    op.drop_column("cursos", "instructor_empleado_id")
    op.drop_column("cursos", "instructor_tipo")
    op.drop_column("cursos", "proveedor_id")
    op.drop_column("cursos", "clasificacion_id")
    op.drop_column("cursos", "tipo_id")
    op.drop_column("cursos", "categoria_id")
