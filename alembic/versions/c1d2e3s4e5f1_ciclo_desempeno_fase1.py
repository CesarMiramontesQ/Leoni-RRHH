"""ciclo desempeno fase 1

Crea el esquema del modulo Ciclo de Desempeno (orquestador): ciclo con
pesos metas/competencias y umbrales de banda, enlaces opcionales a
`levelup_meta_ciclo` / `levelup_eval360_campana`, y snapshot de resultado
por empleado (cumplimiento de metas, calificacion 360, calificacion de
desempeno, potencial y segmento 9-Box).

Revision ID: c1d2e3s4e5f1
Revises: m1e2t3a4s5f1
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c1d2e3s4e5f1"
down_revision: Union[str, None] = "m1e2t3a4s5f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Ciclo de desempeno ───────────────────────────────────────────────────
    op.create_table(
        "levelup_ciclo_desempeno",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=True),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="borrador"),
        sa.Column("meta_ciclo_id", sa.Integer(), nullable=True),
        sa.Column("eval360_campana_id", sa.Integer(), nullable=True),
        sa.Column("peso_metas", sa.Numeric(5, 2), nullable=False, server_default="60"),
        sa.Column("peso_competencias", sa.Numeric(5, 2), nullable=False, server_default="40"),
        sa.Column("umbral_medio", sa.Numeric(5, 2), nullable=False, server_default="50"),
        sa.Column("umbral_alto", sa.Numeric(5, 2), nullable=False, server_default="75"),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("creado_por_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["meta_ciclo_id"], ["levelup_meta_ciclo.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["eval360_campana_id"], ["levelup_eval360_campana.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["creado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Resultado por empleado (snapshot) ───────────────────────────────────
    op.create_table(
        "levelup_ciclo_desempeno_resultado",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ciclo_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("cumplimiento_metas", sa.Numeric(6, 2), nullable=True),
        sa.Column("calificacion_360_raw", sa.Numeric(6, 2), nullable=True),
        sa.Column("calificacion_360_norm", sa.Numeric(6, 2), nullable=True),
        sa.Column("escala_min", sa.Numeric(6, 2), nullable=True),
        sa.Column("escala_max", sa.Numeric(6, 2), nullable=True),
        sa.Column("calificacion_desempeno", sa.Numeric(6, 2), nullable=True),
        sa.Column("peso_metas_efectivo", sa.Numeric(5, 2), nullable=True),
        sa.Column("peso_competencias_efectivo", sa.Numeric(5, 2), nullable=True),
        sa.Column("potencial", sa.Numeric(6, 2), nullable=True),
        sa.Column("banda_desempeno", sa.String(length=10), nullable=True),
        sa.Column("banda_potencial", sa.String(length=10), nullable=True),
        sa.Column("segmento_9box", sa.String(length=20), nullable=True),
        sa.Column("potencial_capturado_por_id", sa.Integer(), nullable=True),
        sa.Column("potencial_capturado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ciclo_id"], ["levelup_ciclo_desempeno.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["potencial_capturado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ciclo_id", "empleado_id", name="uq_levelup_ciclo_desempeno_resultado",
        ),
    )
    op.create_index(
        "ix_levelup_ciclo_desempeno_resultado_ciclo",
        "levelup_ciclo_desempeno_resultado",
        ["ciclo_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_levelup_ciclo_desempeno_resultado_ciclo",
        table_name="levelup_ciclo_desempeno_resultado",
    )
    op.drop_table("levelup_ciclo_desempeno_resultado")
    op.drop_table("levelup_ciclo_desempeno")
