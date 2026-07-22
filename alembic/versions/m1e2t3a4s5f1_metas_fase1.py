"""metas fase 1

Crea el esquema del modulo Metas (OKR ligero): ciclos configurables,
metas individuales/equipo con peso y estado, resultados clave medibles
por meta, y check-ins de avance. Todas las FKs apuntan a
`empleados.empleado_id` o a tablas `levelup_meta_*` (consistente con la
baseline levelup_; no acopla a catalogos Bono).

Revision ID: m1e2t3a4s5f1
Revises: e1n2c3u4e5s6
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "m1e2t3a4s5f1"
down_revision: Union[str, None] = "e1n2c3u4e5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Ciclo ──────────────────────────────────────────────────────────────
    op.create_table(
        "levelup_meta_ciclo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="borrador"),
        sa.Column("creado_por_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Meta ───────────────────────────────────────────────────────────────
    op.create_table(
        "levelup_meta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ciclo_id", sa.Integer(), nullable=False),
        sa.Column("nivel", sa.String(length=20), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("lider_id", sa.Integer(), nullable=True),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("peso", sa.Numeric(6, 2), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="asignada"),
        sa.Column("meta_padre_id", sa.Integer(), nullable=True),
        sa.Column("asignada_por_id", sa.Integer(), nullable=False),
        sa.Column("calificacion_cierre", sa.Numeric(6, 2), nullable=True),
        sa.Column("comentario_cierre", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ciclo_id"], ["levelup_meta_ciclo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["lider_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["asignada_por_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["meta_padre_id"], ["levelup_meta.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_meta_ciclo_empleado", "levelup_meta", ["ciclo_id", "empleado_id"],
    )
    op.create_index(
        "ix_levelup_meta_ciclo_nivel", "levelup_meta", ["ciclo_id", "nivel"],
    )
    op.create_index(
        "ix_levelup_meta_padre", "levelup_meta", ["meta_padre_id"],
    )

    # ── Resultado clave ────────────────────────────────────────────────────
    op.create_table(
        "levelup_meta_resultado_clave",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("meta_id", sa.Integer(), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("tipo_metrica", sa.String(length=20), nullable=False),
        sa.Column("unidad", sa.String(length=50), nullable=True),
        sa.Column("direccion", sa.String(length=10), nullable=False),
        sa.Column("valor_inicial", sa.Numeric(14, 2), nullable=False),
        sa.Column("valor_objetivo", sa.Numeric(14, 2), nullable=False),
        sa.Column("valor_actual", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["meta_id"], ["levelup_meta.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Check-in ───────────────────────────────────────────────────────────
    op.create_table(
        "levelup_meta_checkin",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("resultado_clave_id", sa.Integer(), nullable=False),
        sa.Column("autor_id", sa.Integer(), nullable=False),
        sa.Column("valor_registrado", sa.Numeric(14, 2), nullable=False),
        sa.Column("nota", sa.Text(), nullable=True),
        sa.Column("es_ajuste_jefe", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["resultado_clave_id"], ["levelup_meta_resultado_clave.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["autor_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_meta_checkin_resultado_clave", "levelup_meta_checkin", ["resultado_clave_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_levelup_meta_checkin_resultado_clave", table_name="levelup_meta_checkin")
    op.drop_table("levelup_meta_checkin")
    op.drop_table("levelup_meta_resultado_clave")
    op.drop_index("ix_levelup_meta_padre", table_name="levelup_meta")
    op.drop_index("ix_levelup_meta_ciclo_nivel", table_name="levelup_meta")
    op.drop_index("ix_levelup_meta_ciclo_empleado", table_name="levelup_meta")
    op.drop_table("levelup_meta")
    op.drop_table("levelup_meta_ciclo")
