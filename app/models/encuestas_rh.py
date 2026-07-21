# app/models/encuestas_rh.py
"""
Modelos SQLAlchemy para el modulo de Encuestas RH (Level Up).

Objetivo: encuestas de clima laboral / pulso dirigidas a segmentos de
empleados, con soporte para anonimato (grupo de respuesta sin `empleado_id`
cuando la encuesta es anonima) y umbral minimo de respuestas antes de mostrar
resultados agregados por segmento.

Entidades:
  - Encuesta: definicion de la encuesta (titulo, tipo, audiencia, estado)
  - EncuestaPregunta: preguntas de la encuesta (likert/opcion_multiple/texto)
  - EncuestaOpcion: opciones de una pregunta de opcion_multiple
  - EncuestaParticipante: empleados convocados a responder
  - EncuestaRespuestaGrupo: "sobre" de respuestas de un participante (una fila
    por respuesta completa); UUID para poder desasociar identidad en
    encuestas anonimas sin perder agregacion por segmento
  - EncuestaRespuesta: respuesta a una pregunta dentro de un grupo
  - EncuestaRespuestaOpcion: opciones seleccionadas en una respuesta de
    opcion_multiple (soporta seleccion multiple)
  - EncuestaPlantilla: plantillas reutilizables (predefinidas o propias)

Convenciones (como el resto del proyecto, ver evaluacion360.py):
  - Enums modelados como String para compatibilidad con SQLite en tests.
  - Campos flexibles en JSONB.
  - Timestamps via server_default=func.now(), salvo donde el brief indica lo
    contrario (EncuestaRespuestaGrupo.created_at: nullable, sin server_default,
    lo llena el service solo en encuestas no anonimas).
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado  # noqa: F401


# ── Valores de columnas (String) usados por el modulo ──────────────────────
ENCUESTA_TIPOS = ("clima", "pulso", "otra")
ENCUESTA_ESTADOS = ("borrador", "publicada", "cerrada")
ENCUESTA_PREGUNTA_TIPOS = ("likert", "opcion_multiple", "texto")
ENCUESTA_PARTICIPANTE_ESTADOS = ("pendiente", "respondida")


class Encuesta(Base):
    """Definicion de una encuesta de clima/pulso dirigida a un segmento."""

    __tablename__ = "levelup_encuesta"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo: Mapped[str] = mapped_column(
        String(20), nullable=False, default="otra",
        comment="clima|pulso|otra",
    )
    es_anonima: Mapped[bool] = mapped_column(Boolean, nullable=False)
    umbral_minimo_respuestas: Mapped[int] = mapped_column(
        Integer, nullable=False, default=5,
        comment="Minimo de respuestas por segmento para mostrar resultados agregados",
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="borrador",
        comment="borrador|publicada|cerrada",
    )
    fecha_publicacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_cierre_programada: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_cierre_real: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # {"areas": [...], "turnos": [...], "clasificaciones": [...], ...}
    audiencia_criterios: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    recordatorio_cada_dias: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3
    )
    creado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    preguntas: Mapped[List["EncuestaPregunta"]] = relationship(
        "EncuestaPregunta",
        back_populates="encuesta",
        order_by="EncuestaPregunta.orden",
        cascade="all, delete-orphan",
    )
    participantes: Mapped[List["EncuestaParticipante"]] = relationship(
        "EncuestaParticipante",
        back_populates="encuesta",
        cascade="all, delete-orphan",
    )
    grupos_respuesta: Mapped[List["EncuestaRespuestaGrupo"]] = relationship(
        "EncuestaRespuestaGrupo",
        back_populates="encuesta",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Encuesta id={self.id} titulo={self.titulo!r} estado={self.estado}>"


class EncuestaPregunta(Base):
    """Pregunta de una encuesta (likert / opcion_multiple / texto)."""

    __tablename__ = "levelup_encuesta_pregunta"
    __table_args__ = (
        Index("ix_levelup_encuesta_pregunta_encuesta_orden", "encuesta_id", "orden"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    encuesta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta.id", ondelete="CASCADE"), nullable=False
    )
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="likert|opcion_multiple|texto"
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    requerida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    seleccion_multiple: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Solo aplica a tipo=opcion_multiple",
    )

    encuesta: Mapped["Encuesta"] = relationship(
        "Encuesta", back_populates="preguntas"
    )
    opciones: Mapped[List["EncuestaOpcion"]] = relationship(
        "EncuestaOpcion",
        back_populates="pregunta",
        order_by="EncuestaOpcion.orden",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<EncuestaPregunta id={self.id} encuesta_id={self.encuesta_id} "
            f"orden={self.orden} tipo={self.tipo}>"
        )


class EncuestaOpcion(Base):
    """Opcion de respuesta para una pregunta de opcion_multiple."""

    __tablename__ = "levelup_encuesta_opcion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pregunta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta_pregunta.id", ondelete="CASCADE"), nullable=False
    )
    orden: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    texto: Mapped[str] = mapped_column(String(255), nullable=False)

    pregunta: Mapped["EncuestaPregunta"] = relationship(
        "EncuestaPregunta", back_populates="opciones"
    )

    def __repr__(self) -> str:
        return f"<EncuestaOpcion id={self.id} pregunta_id={self.pregunta_id}>"


class EncuestaParticipante(Base):
    """Empleado convocado a responder una encuesta."""

    __tablename__ = "levelup_encuesta_participante"
    __table_args__ = (
        UniqueConstraint(
            "encuesta_id", "empleado_id",
            name="uq_levelup_encuesta_participante",
        ),
        Index("ix_levelup_encuesta_participante_estado", "encuesta_id", "estado"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    encuesta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pendiente",
        comment="pendiente|respondida",
    )
    fecha_respuesta: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notificado_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ultimo_recordatorio_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recordatorios_enviados: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    encuesta: Mapped["Encuesta"] = relationship(
        "Encuesta", back_populates="participantes"
    )
    empleado: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )

    def __repr__(self) -> str:
        return (
            f"<EncuestaParticipante id={self.id} encuesta_id={self.encuesta_id} "
            f"empleado_id={self.empleado_id} estado={self.estado}>"
        )


class EncuestaRespuestaGrupo(Base):
    """"Sobre" de respuestas de un participante a una encuesta.

    `id` es UUID generado en Python (no server-side) para que el service
    pueda desasociar identidad (empleado_id NULL) en encuestas anonimas sin
    perder la capacidad de segmentar resultados por area/turno/clasificacion.
    """

    __tablename__ = "levelup_encuesta_respuesta_grupo"
    __table_args__ = (
        Index(
            "ix_levelup_encuesta_respuesta_grupo_area",
            "encuesta_id", "segmento_area",
        ),
        Index(
            "ix_levelup_encuesta_respuesta_grupo_turno",
            "encuesta_id", "segmento_turno",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True, default=uuid4)
    encuesta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True,
        comment="NULL cuando la encuesta es anonima",
    )
    segmento_area: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    segmento_turno: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    segmento_clasificacion: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    fecha_dia: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Sin server_default: el service solo lo llena en encuestas no anonimas",
    )

    encuesta: Mapped["Encuesta"] = relationship(
        "Encuesta", back_populates="grupos_respuesta"
    )
    empleado: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )
    respuestas: Mapped[List["EncuestaRespuesta"]] = relationship(
        "EncuestaRespuesta",
        back_populates="grupo",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<EncuestaRespuestaGrupo id={self.id} encuesta_id={self.encuesta_id} "
            f"empleado_id={self.empleado_id}>"
        )


class EncuestaRespuesta(Base):
    """Respuesta a una pregunta dentro de un grupo de respuesta."""

    __tablename__ = "levelup_encuesta_respuesta"
    __table_args__ = (
        UniqueConstraint(
            "grupo_id", "pregunta_id",
            name="uq_levelup_encuesta_respuesta",
        ),
        Index("ix_levelup_encuesta_respuesta_pregunta", "pregunta_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    grupo_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("levelup_encuesta_respuesta_grupo.id", ondelete="CASCADE"),
        nullable=False,
    )
    pregunta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta_pregunta.id"), nullable=False
    )
    valor_likert: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    texto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    grupo: Mapped["EncuestaRespuestaGrupo"] = relationship(
        "EncuestaRespuestaGrupo", back_populates="respuestas"
    )
    opciones_seleccionadas: Mapped[List["EncuestaRespuestaOpcion"]] = relationship(
        "EncuestaRespuestaOpcion",
        back_populates="respuesta",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<EncuestaRespuesta id={self.id} grupo_id={self.grupo_id} "
            f"pregunta_id={self.pregunta_id}>"
        )


class EncuestaRespuestaOpcion(Base):
    """Opcion seleccionada dentro de una respuesta de opcion_multiple."""

    __tablename__ = "levelup_encuesta_respuesta_opcion"
    __table_args__ = (
        UniqueConstraint(
            "respuesta_id", "opcion_id",
            name="uq_levelup_encuesta_respuesta_opcion",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    respuesta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta_respuesta.id", ondelete="CASCADE"), nullable=False
    )
    opcion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_encuesta_opcion.id"), nullable=False
    )

    respuesta: Mapped["EncuestaRespuesta"] = relationship(
        "EncuestaRespuesta", back_populates="opciones_seleccionadas"
    )

    def __repr__(self) -> str:
        return (
            f"<EncuestaRespuestaOpcion id={self.id} respuesta_id={self.respuesta_id} "
            f"opcion_id={self.opcion_id}>"
        )


class EncuestaPlantilla(Base):
    """Plantilla reutilizable de encuesta (predefinida o propia).

    `definicion` (JSONB) es una lista de preguntas:
    [{orden, tipo, texto, requerida, seleccion_multiple, opciones: [texto,...]}, ...]
    """

    __tablename__ = "levelup_encuesta_plantilla"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="clima|pulso|otra"
    )
    es_predefinida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    definicion: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<EncuestaPlantilla id={self.id} nombre={self.nombre!r}>"
