"""plan desarrollo individual

Revision ID: s9t0u1v2w3x4
Revises: r7s8t9u0v1w2
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa

revision = "s9t0u1v2w3x4"
down_revision = "r7s8t9u0v1w2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "levelup_plan_desarrollo_individual",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("accion", sa.String(300), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("duracion_horas", sa.SmallInteger(), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("responsable", sa.String(200), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("creado_por", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.CheckConstraint("fecha_fin >= fecha_inicio", name="ck_levelup_pdi_fechas"),
    )
    op.create_index("ix_levelup_pdi_empleado_id", "levelup_plan_desarrollo_individual", ["empleado_id"])
    op.create_index("ix_levelup_pdi_competencia_id", "levelup_plan_desarrollo_individual", ["competencia_id"])


def downgrade() -> None:
    op.drop_index("ix_levelup_pdi_competencia_id", table_name="levelup_plan_desarrollo_individual")
    op.drop_index("ix_levelup_pdi_empleado_id", table_name="levelup_plan_desarrollo_individual")
    op.drop_table("levelup_plan_desarrollo_individual")
