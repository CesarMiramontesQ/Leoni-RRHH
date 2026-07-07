"""proveedores externos

Crea el esquema del modulo de Capacitacion de Personal Externo (tablas
levelup_proveedores, levelup_proveedor_personas, levelup_cursos_externos y
levelup_proveedor_persona_curso). Las FKs de auditoria apuntan a
`empleados.empleado_id` (catalogo legacy Bono, read-only); el resto a tablas
`levelup_*`. No toca catalogos Bono.

Revision ID: p1r2o3v4e5x6
Revises: j1u2n3t4a5s6
Create Date: 2026-07-06 09:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "p1r2o3v4e5x6"
down_revision: Union[str, None] = "j1u2n3t4a5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Proveedores (padre) ───────────────────────────────────────────────────
    op.create_table(
        "levelup_proveedores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("rfc", sa.String(length=20), nullable=True),
        sa.Column("contacto", sa.String(length=255), nullable=True),
        sa.Column("telefono", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("direccion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_levelup_proveedores_nombre"),
    )

    # ── Personas (hijo de proveedor) ──────────────────────────────────────────
    op.create_table(
        "levelup_proveedor_personas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("proveedor_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("identificacion", sa.String(length=100), nullable=True),
        sa.Column("puesto", sa.String(length=150), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["proveedor_id"], ["levelup_proveedores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("proveedor_id", "identificacion", name="uq_levelup_proveedor_persona_ident"),
    )
    op.create_index(
        "ix_levelup_proveedor_personas_proveedor",
        "levelup_proveedor_personas",
        ["proveedor_id"],
    )

    # ── Cursos externos (catalogo) ────────────────────────────────────────────
    op.create_table(
        "levelup_cursos_externos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("vigencia_meses", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_levelup_cursos_externos_nombre"),
    )

    # ── Registro de curso por persona ─────────────────────────────────────────
    op.create_table(
        "levelup_proveedor_persona_curso",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("persona_id", sa.Integer(), nullable=False),
        sa.Column("curso_externo_id", sa.Integer(), nullable=False),
        sa.Column("fecha_realizado", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["persona_id"], ["levelup_proveedor_personas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["curso_externo_id"], ["levelup_cursos_externos.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_levelup_ppc_persona", "levelup_proveedor_persona_curso", ["persona_id"])
    op.create_index("ix_levelup_ppc_curso", "levelup_proveedor_persona_curso", ["curso_externo_id"])
    op.create_index("ix_levelup_ppc_fecha_venc", "levelup_proveedor_persona_curso", ["fecha_vencimiento"])


def downgrade() -> None:
    op.drop_index("ix_levelup_ppc_fecha_venc", table_name="levelup_proveedor_persona_curso")
    op.drop_index("ix_levelup_ppc_curso", table_name="levelup_proveedor_persona_curso")
    op.drop_index("ix_levelup_ppc_persona", table_name="levelup_proveedor_persona_curso")
    op.drop_table("levelup_proveedor_persona_curso")
    op.drop_table("levelup_cursos_externos")
    op.drop_index("ix_levelup_proveedor_personas_proveedor", table_name="levelup_proveedor_personas")
    op.drop_table("levelup_proveedor_personas")
    op.drop_table("levelup_proveedores")
