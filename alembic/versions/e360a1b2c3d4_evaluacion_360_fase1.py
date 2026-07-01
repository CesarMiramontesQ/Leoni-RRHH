"""evaluacion 360 fase 1

Crea el esquema del modulo Evaluacion 360 (tablas levelup_eval360_*).
Todas las FKs apuntan a `empleados.empleado_id` o a tablas `levelup_*`
(consistente con la baseline levelup_; no acopla a catalogos Bono).

Revision ID: e360a1b2c3d4
Revises: e9n0c1u2e3s4
Create Date: 2026-07-01 16:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e360a1b2c3d4"
down_revision: Union[str, None] = "e9n0c1u2e3s4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Escala Likert configurable ────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_escala",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("valor_min", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("valor_max", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("etiquetas", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Configuracion global (singleton) ──────────────────────────────────────
    op.create_table(
        "levelup_eval360_config",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("escala_id", sa.Integer(), nullable=True),
        sa.Column("comentarios_obligatorios", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("autoevaluacion_habilitada", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("guardar_borradores", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("evaluacion_anonima", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("nivel_minimo_esperado", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("pesos_evaluadores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("frecuencia_sugerida", sa.String(length=20), nullable=False, server_default="anual"),
        sa.Column("recordatorios", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["escala_id"], ["levelup_eval360_escala.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Banco de preguntas por competencia ────────────────────────────────────
    op.create_table(
        "levelup_eval360_pregunta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_levelup_eval360_pregunta_competencia", "levelup_eval360_pregunta", ["competencia_id"])

    # ── Campana ───────────────────────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_campana",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("objetivo", sa.Text(), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=True),
        sa.Column("fecha_cierre", sa.Date(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="borrador"),
        sa.Column("tipo", sa.String(length=30), nullable=False, server_default="evaluacion_360"),
        sa.Column("escala_id", sa.Integer(), nullable=True),
        sa.Column("plantilla_id", sa.Integer(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["escala_id"], ["levelup_eval360_escala.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_levelup_eval360_campana_estado", "levelup_eval360_campana", ["estado"])

    # ── Competencias de la campana ────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_campana_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campana_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("peso", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("num_preguntas", sa.SmallInteger(), nullable=True),
        sa.Column("nivel_esperado", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("obligatoria", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("orden", sa.SmallInteger(), nullable=True),
        sa.ForeignKeyConstraint(["campana_id"], ["levelup_eval360_campana.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campana_id", "competencia_id", name="uq_levelup_eval360_campana_competencia"),
    )

    # ── Tipos de evaluador de la campana (pesos suman 100%) ────────────────────
    op.create_table(
        "levelup_eval360_campana_evaluador_tipo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campana_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("peso", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["campana_id"], ["levelup_eval360_campana.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campana_id", "tipo", name="uq_levelup_eval360_campana_evaluador_tipo"),
    )

    # ── Participantes (evaluados) ─────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_participante",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campana_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=True),
        sa.Column("grado_id", sa.Integer(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campana_id"], ["levelup_eval360_campana.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["puesto_perfil_id"], ["levelup_puestos_perfil.id"]),
        sa.ForeignKeyConstraint(["grado_id"], ["levelup_grados_puesto.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campana_id", "empleado_id", name="uq_levelup_eval360_participante"),
    )
    op.create_index("ix_levelup_eval360_participante_empleado", "levelup_eval360_participante", ["empleado_id"])

    # ── Evaluaciones (hoja evaluador -> evaluado) ─────────────────────────────
    op.create_table(
        "levelup_eval360_evaluacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campana_id", sa.Integer(), nullable=False),
        sa.Column("participante_id", sa.Integer(), nullable=False),
        sa.Column("evaluador_empleado_id", sa.Integer(), nullable=True),
        sa.Column("evaluador_nombre", sa.String(length=255), nullable=True),
        sa.Column("tipo_evaluador", sa.String(length=20), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("es_anonima", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fecha_asignacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("fecha_limite", sa.Date(), nullable=True),
        sa.Column("fecha_completada", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campana_id"], ["levelup_eval360_campana.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["participante_id"], ["levelup_eval360_participante.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evaluador_empleado_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_levelup_eval360_evaluacion_evaluador", "levelup_eval360_evaluacion", ["evaluador_empleado_id"])
    op.create_index("ix_levelup_eval360_evaluacion_participante", "levelup_eval360_evaluacion", ["participante_id"])

    # ── Respuestas ────────────────────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_respuesta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evaluacion_id", sa.Integer(), nullable=False),
        sa.Column("pregunta_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("valor", sa.Numeric(6, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["evaluacion_id"], ["levelup_eval360_evaluacion.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pregunta_id"], ["levelup_eval360_pregunta.id"]),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evaluacion_id", "pregunta_id", name="uq_levelup_eval360_respuesta"),
    )

    # ── Comentarios ───────────────────────────────────────────────────────────
    op.create_table(
        "levelup_eval360_comentario",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evaluacion_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="general"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["evaluacion_id"], ["levelup_eval360_evaluacion.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Resultados (cache de calculo) ─────────────────────────────────────────
    op.create_table(
        "levelup_eval360_resultado",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("participante_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=True),
        sa.Column("promedio_general", sa.Numeric(6, 2), nullable=True),
        sa.Column("promedio_por_tipo", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("autoevaluacion", sa.Numeric(6, 2), nullable=True),
        sa.Column("nivel_esperado", sa.Numeric(6, 2), nullable=True),
        sa.Column("brecha", sa.Numeric(6, 2), nullable=True),
        sa.Column("estado_brecha", sa.String(length=20), nullable=True),
        sa.Column("calificacion_general", sa.Numeric(6, 2), nullable=True),
        sa.Column("desempeno", sa.Numeric(6, 2), nullable=True),
        sa.Column("potencial", sa.Numeric(6, 2), nullable=True),
        sa.Column("calculado_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["participante_id"], ["levelup_eval360_participante.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("participante_id", "competencia_id", name="uq_levelup_eval360_resultado"),
    )


def downgrade() -> None:
    op.drop_table("levelup_eval360_resultado")
    op.drop_table("levelup_eval360_comentario")
    op.drop_table("levelup_eval360_respuesta")
    op.drop_index("ix_levelup_eval360_evaluacion_participante", table_name="levelup_eval360_evaluacion")
    op.drop_index("ix_levelup_eval360_evaluacion_evaluador", table_name="levelup_eval360_evaluacion")
    op.drop_table("levelup_eval360_evaluacion")
    op.drop_index("ix_levelup_eval360_participante_empleado", table_name="levelup_eval360_participante")
    op.drop_table("levelup_eval360_participante")
    op.drop_table("levelup_eval360_campana_evaluador_tipo")
    op.drop_table("levelup_eval360_campana_competencia")
    op.drop_index("ix_levelup_eval360_campana_estado", table_name="levelup_eval360_campana")
    op.drop_table("levelup_eval360_campana")
    op.drop_index("ix_levelup_eval360_pregunta_competencia", table_name="levelup_eval360_pregunta")
    op.drop_table("levelup_eval360_pregunta")
    op.drop_table("levelup_eval360_config")
    op.drop_table("levelup_eval360_escala")
