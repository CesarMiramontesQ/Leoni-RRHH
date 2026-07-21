"""encuestas rh fase 1

Crea el esquema del modulo Encuestas RH (tablas levelup_encuesta_*) y siembra
2 plantillas predefinidas ("Clima laboral" y "Pulso"). Todas las FKs apuntan a
`empleados.empleado_id` o a tablas `levelup_*` (consistente con la baseline
levelup_; no acopla a catalogos Bono).

Revision ID: e1n2c3u4e5s6
Revises: g1o2c3e4f5r6
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e1n2c3u4e5s6"
down_revision: Union[str, None] = "g1o2c3e4f5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Seeds de plantillas predefinidas ────────────────────────────────────────

_CLIMA_LIKERT = [
    "El ambiente de trabajo en mi área es agradable y respetuoso.",
    "La comunicación entre mi equipo y mis superiores es clara y oportuna.",
    "Mi jefe directo demuestra un liderazgo efectivo y me brinda apoyo cuando lo necesito.",
    "Mi trabajo y mis logros son reconocidos adecuadamente.",
    "La carga de trabajo que tengo asignada es razonable y manejable.",
    "Cuento con las herramientas y los recursos necesarios para realizar mi trabajo.",
    "Me siento seguro física y emocionalmente en mi lugar de trabajo.",
    "Tengo oportunidades claras de desarrollo y crecimiento profesional.",
    "Existe compañerismo y colaboración entre los miembros de mi equipo.",
    "Me siento orgulloso de pertenecer a esta empresa.",
    "Puedo mantener un buen equilibrio entre mi vida personal y mi trabajo.",
    "Confío en las decisiones que toma la dirección de la empresa.",
]

_CLIMA_TEXTO = [
    "¿Qué es lo mejor de trabajar aquí?",
    "¿Qué mejorarías?",
]

_PULSO_LIKERT = [
    "Actualmente me siento motivado en mi trabajo.",
    "Considero que la carga de trabajo de esta semana ha sido adecuada.",
    "He recibido el apoyo que necesito de mi equipo o jefe esta semana.",
    "Recomendaría esta empresa como un buen lugar para trabajar.",
]

_PULSO_TEXTO = [
    "¿Hay algo que quieras compartir sobre tu experiencia esta semana?",
]


def _preguntas_likert(textos: list[str], orden_inicial: int = 1) -> list[dict]:
    return [
        {
            "orden": orden_inicial + i,
            "tipo": "likert",
            "texto": texto,
            "requerida": True,
            "seleccion_multiple": False,
            "opciones": [],
        }
        for i, texto in enumerate(textos)
    ]


def _preguntas_texto(textos: list[str], orden_inicial: int) -> list[dict]:
    return [
        {
            "orden": orden_inicial + i,
            "tipo": "texto",
            "texto": texto,
            "requerida": False,
            "seleccion_multiple": False,
            "opciones": [],
        }
        for i, texto in enumerate(textos)
    ]


_DEFINICION_CLIMA = _preguntas_likert(_CLIMA_LIKERT, 1) + _preguntas_texto(
    _CLIMA_TEXTO, len(_CLIMA_LIKERT) + 1
)
_DEFINICION_PULSO = _preguntas_likert(_PULSO_LIKERT, 1) + _preguntas_texto(
    _PULSO_TEXTO, len(_PULSO_LIKERT) + 1
)


def upgrade() -> None:
    # ── Encuesta ───────────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="otra"),
        sa.Column("es_anonima", sa.Boolean(), nullable=False),
        sa.Column("umbral_minimo_respuestas", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="borrador"),
        sa.Column("fecha_publicacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fecha_cierre_programada", sa.Date(), nullable=True),
        sa.Column("fecha_cierre_real", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audiencia_criterios", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("recordatorio_cada_dias", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("creado_por_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Preguntas ──────────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_pregunta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("encuesta_id", sa.Integer(), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("requerida", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("seleccion_multiple", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["encuesta_id"], ["levelup_encuesta.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_encuesta_pregunta_encuesta_orden",
        "levelup_encuesta_pregunta",
        ["encuesta_id", "orden"],
    )

    # ── Opciones ───────────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_opcion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pregunta_id", sa.Integer(), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=True),
        sa.Column("texto", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["pregunta_id"], ["levelup_encuesta_pregunta.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Participantes ──────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_participante",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("encuesta_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("fecha_respuesta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notificado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultimo_recordatorio_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recordatorios_enviados", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["encuesta_id"], ["levelup_encuesta.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("encuesta_id", "empleado_id", name="uq_levelup_encuesta_participante"),
    )
    op.create_index(
        "ix_levelup_encuesta_participante_estado",
        "levelup_encuesta_participante",
        ["encuesta_id", "estado"],
    )

    # ── Grupo de respuesta (UUID; empleado_id NULL si es anonima) ─────────
    op.create_table(
        "levelup_encuesta_respuesta_grupo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("encuesta_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=True),
        sa.Column("segmento_area", sa.String(length=255), nullable=True),
        sa.Column("segmento_turno", sa.String(length=50), nullable=True),
        sa.Column("segmento_clasificacion", sa.String(length=100), nullable=True),
        sa.Column("fecha_dia", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["encuesta_id"], ["levelup_encuesta.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_encuesta_respuesta_grupo_area",
        "levelup_encuesta_respuesta_grupo",
        ["encuesta_id", "segmento_area"],
    )
    op.create_index(
        "ix_levelup_encuesta_respuesta_grupo_turno",
        "levelup_encuesta_respuesta_grupo",
        ["encuesta_id", "segmento_turno"],
    )

    # ── Respuestas ─────────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_respuesta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("grupo_id", sa.Uuid(), nullable=False),
        sa.Column("pregunta_id", sa.Integer(), nullable=False),
        sa.Column("valor_likert", sa.Integer(), nullable=True),
        sa.Column("texto", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["grupo_id"], ["levelup_encuesta_respuesta_grupo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pregunta_id"], ["levelup_encuesta_pregunta.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("grupo_id", "pregunta_id", name="uq_levelup_encuesta_respuesta"),
    )
    op.create_index(
        "ix_levelup_encuesta_respuesta_pregunta",
        "levelup_encuesta_respuesta",
        ["pregunta_id"],
    )

    # ── Opciones seleccionadas ────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_respuesta_opcion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("respuesta_id", sa.Integer(), nullable=False),
        sa.Column("opcion_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["respuesta_id"], ["levelup_encuesta_respuesta.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opcion_id"], ["levelup_encuesta_opcion.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("respuesta_id", "opcion_id", name="uq_levelup_encuesta_respuesta_opcion"),
    )

    # ── Plantillas ─────────────────────────────────────────────────────────
    op.create_table(
        "levelup_encuesta_plantilla",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=True),
        sa.Column("es_predefinida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("definicion", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    plantilla_table = sa.table(
        "levelup_encuesta_plantilla",
        sa.column("nombre", sa.String),
        sa.column("descripcion", sa.Text),
        sa.column("tipo", sa.String),
        sa.column("es_predefinida", sa.Boolean),
        sa.column("definicion", postgresql.JSONB),
    )
    op.bulk_insert(
        plantilla_table,
        [
            {
                "nombre": "Clima laboral",
                "descripcion": (
                    "Plantilla predefinida de encuesta de clima laboral "
                    "(12 preguntas Likert + 2 preguntas abiertas)."
                ),
                "tipo": "clima",
                "es_predefinida": True,
                "definicion": _DEFINICION_CLIMA,
            },
            {
                "nombre": "Pulso",
                "descripcion": (
                    "Plantilla predefinida de encuesta de pulso rápido "
                    "(4 preguntas Likert + 1 pregunta abierta)."
                ),
                "tipo": "pulso",
                "es_predefinida": True,
                "definicion": _DEFINICION_PULSO,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("levelup_encuesta_plantilla")
    op.drop_table("levelup_encuesta_respuesta_opcion")
    op.drop_index("ix_levelup_encuesta_respuesta_pregunta", table_name="levelup_encuesta_respuesta")
    op.drop_table("levelup_encuesta_respuesta")
    op.drop_index("ix_levelup_encuesta_respuesta_grupo_turno", table_name="levelup_encuesta_respuesta_grupo")
    op.drop_index("ix_levelup_encuesta_respuesta_grupo_area", table_name="levelup_encuesta_respuesta_grupo")
    op.drop_table("levelup_encuesta_respuesta_grupo")
    op.drop_index("ix_levelup_encuesta_participante_estado", table_name="levelup_encuesta_participante")
    op.drop_table("levelup_encuesta_participante")
    op.drop_table("levelup_encuesta_opcion")
    op.drop_index("ix_levelup_encuesta_pregunta_encuesta_orden", table_name="levelup_encuesta_pregunta")
    op.drop_table("levelup_encuesta_pregunta")
    op.drop_table("levelup_encuesta")
