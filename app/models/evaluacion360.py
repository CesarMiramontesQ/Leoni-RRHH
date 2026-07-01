# app/models/evaluacion360.py
"""
Modelos SQLAlchemy para el modulo de Evaluacion 360 (Level Up).

Objetivo: campanas donde varios evaluadores (auto, jefe, pares, subordinados,
clientes) califican competencias/comportamientos de un colaborador. Reutiliza el
catalogo de competencias existente (`levelup_competencias`) y la estructura
organizacional (`empleados.lider_id`, `area_id`) sin duplicar catalogos.

Entidades:
  - Eval360Config: configuracion global (singleton) del modulo
  - Eval360Escala: escalas Likert configurables reutilizables (ej. 1-5)
  - Eval360Pregunta: banco de items conductuales por competencia
  - Eval360Campana: campana de evaluacion
  - Eval360CampanaCompetencia: competencias incluidas en una campana (peso/nivel)
  - Eval360CampanaEvaluadorTipo: tipos de evaluador activos + peso por campana
  - Eval360Participante: empleados evaluados en una campana
  - Eval360Evaluacion: hoja evaluador -> evaluado
  - Eval360Respuesta: respuesta a cada pregunta
  - Eval360Comentario: comentarios (fortaleza/oportunidad/general)
  - Eval360Resultado: cache de resultados calculados por evaluado/competencia

Convenciones (como el resto del proyecto):
  - Enums modelados como String(20) para compatibilidad con SQLite en tests.
  - Soft delete via `activo`; auditoria via created_at/updated_at/created_by.
  - Campos flexibles en JSONB.
  - Escala Likert propia; para comparar contra el nivel esperado del perfil
    (0-4) se normaliza en el service.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado  # noqa: F401
    from app.models.talento import Competencia  # noqa: F401


# ── Tipos de evaluador soportados (valores de columna `tipo`) ──────────────────
EVAL360_TIPOS_EVALUADOR = (
    "autoevaluacion",
    "jefe",
    "par",
    "subordinado",
    "cliente_interno",
    "cliente_externo",
)

# Estados de campana / evaluacion (columnas String)
EVAL360_CAMPANA_ESTADOS = (
    "borrador",
    "activa",
    "en_progreso",
    "finalizada",
    "cerrada",
    "cancelada",
)
EVAL360_EVALUACION_ESTADOS = ("pendiente", "en_progreso", "completada", "vencida")


class Eval360Config(Base):
    """Configuracion global del modulo (singleton, normalmente id=1)."""

    __tablename__ = "levelup_eval360_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    escala_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_eval360_escala.id"), nullable=True
    )
    comentarios_obligatorios: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    autoevaluacion_habilitada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    guardar_borradores: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    evaluacion_anonima: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    nivel_minimo_esperado: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3,
        comment="Nivel esperado por defecto (escala 0-4 de competencias)",
    )
    # {"jefe": 40, "autoevaluacion": 10, "par": 20, "subordinado": 20, "cliente_interno": 5, "cliente_externo": 5}
    pesos_evaluadores: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    frecuencia_sugerida: Mapped[str] = mapped_column(
        String(20), nullable=False, default="anual",
        comment="mensual|trimestral|semestral|anual|manual",
    )
    # {"dias_antes": [3, 1, 0]}
    recordatorios: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    escala: Mapped[Optional["Eval360Escala"]] = relationship("Eval360Escala")

    def __repr__(self) -> str:
        return f"<Eval360Config id={self.id}>"


class Eval360Escala(Base):
    """Escala Likert configurable reutilizable (ej. 1-5 Nunca..Siempre)."""

    __tablename__ = "levelup_eval360_escala"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    valor_min: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    valor_max: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    # {"1": "Nunca", "2": "Rara vez", ...}
    etiquetas: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Eval360Escala id={self.id} nombre={self.nombre} {self.valor_min}-{self.valor_max}>"


class Eval360Pregunta(Base):
    """Banco de items conductuales asociados a una competencia existente."""

    __tablename__ = "levelup_eval360_pregunta"
    __table_args__ = (
        Index("ix_levelup_eval360_pregunta_competencia", "competencia_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id", ondelete="CASCADE"), nullable=False
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    orden: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Eval360Pregunta id={self.id} competencia_id={self.competencia_id}>"


class Eval360Campana(Base):
    """Campana de evaluacion 360 (o, a futuro, desempeno / objetivos)."""

    __tablename__ = "levelup_eval360_campana"
    __table_args__ = (
        Index("ix_levelup_eval360_campana_estado", "estado"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objetivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_cierre: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="borrador",
        comment="borrador|activa|en_progreso|finalizada|cerrada|cancelada",
    )
    tipo: Mapped[str] = mapped_column(
        String(30), nullable=False, default="evaluacion_360",
        comment="evaluacion_360|desempeno|objetivos (extensible)",
    )
    escala_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_eval360_escala.id"), nullable=True
    )
    plantilla_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # {"anonima": bool, "comentarios_obligatorios": bool, "permitir_borradores": bool,
    #  "mostrar_progreso": bool, "fecha_limite": "ISO", "recordatorios": {...}}
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    escala: Mapped[Optional["Eval360Escala"]] = relationship("Eval360Escala")
    competencias: Mapped[List["Eval360CampanaCompetencia"]] = relationship(
        "Eval360CampanaCompetencia",
        back_populates="campana",
        cascade="all, delete-orphan",
    )
    evaluador_tipos: Mapped[List["Eval360CampanaEvaluadorTipo"]] = relationship(
        "Eval360CampanaEvaluadorTipo",
        back_populates="campana",
        cascade="all, delete-orphan",
    )
    participantes: Mapped[List["Eval360Participante"]] = relationship(
        "Eval360Participante",
        back_populates="campana",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Eval360Campana id={self.id} nombre={self.nombre} estado={self.estado}>"


class Eval360CampanaCompetencia(Base):
    """Competencia incluida en una campana con su configuracion."""

    __tablename__ = "levelup_eval360_campana_competencia"
    __table_args__ = (
        UniqueConstraint(
            "campana_id", "competencia_id",
            name="uq_levelup_eval360_campana_competencia",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    campana_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_campana.id", ondelete="CASCADE"), nullable=False
    )
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id"), nullable=False
    )
    peso: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False, default=0,
        comment="Peso relativo de la competencia dentro de la campana (%)",
    )
    num_preguntas: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    nivel_esperado: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3,
        comment="Nivel esperado (escala 0-4 de competencias)",
    )
    obligatoria: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    orden: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    campana: Mapped["Eval360Campana"] = relationship(
        "Eval360Campana", back_populates="competencias"
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360CampanaCompetencia campana_id={self.campana_id} "
            f"competencia_id={self.competencia_id}>"
        )


class Eval360CampanaEvaluadorTipo(Base):
    """Tipo de evaluador activo en la campana y su peso (deben sumar 100%)."""

    __tablename__ = "levelup_eval360_campana_evaluador_tipo"
    __table_args__ = (
        UniqueConstraint(
            "campana_id", "tipo",
            name="uq_levelup_eval360_campana_evaluador_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    campana_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_campana.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="autoevaluacion|jefe|par|subordinado|cliente_interno|cliente_externo",
    )
    peso: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    campana: Mapped["Eval360Campana"] = relationship(
        "Eval360Campana", back_populates="evaluador_tipos"
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360CampanaEvaluadorTipo campana_id={self.campana_id} "
            f"tipo={self.tipo} peso={self.peso}>"
        )


class Eval360Participante(Base):
    """Empleado evaluado dentro de una campana."""

    __tablename__ = "levelup_eval360_participante"
    __table_args__ = (
        UniqueConstraint(
            "campana_id", "empleado_id",
            name="uq_levelup_eval360_participante",
        ),
        Index("ix_levelup_eval360_participante_empleado", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    campana_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_campana.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    puesto_perfil_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id"), nullable=True
    )
    grado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pendiente",
        comment="pendiente|en_progreso|completada",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    campana: Mapped["Eval360Campana"] = relationship(
        "Eval360Campana", back_populates="participantes"
    )
    empleado: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )
    evaluaciones: Mapped[List["Eval360Evaluacion"]] = relationship(
        "Eval360Evaluacion",
        back_populates="participante",
        cascade="all, delete-orphan",
    )
    resultados: Mapped[List["Eval360Resultado"]] = relationship(
        "Eval360Resultado",
        back_populates="participante",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360Participante id={self.id} campana_id={self.campana_id} "
            f"empleado_id={self.empleado_id}>"
        )


class Eval360Evaluacion(Base):
    """Hoja de evaluacion: un evaluador califica a un participante (evaluado)."""

    __tablename__ = "levelup_eval360_evaluacion"
    __table_args__ = (
        Index("ix_levelup_eval360_evaluacion_evaluador", "evaluador_empleado_id"),
        Index("ix_levelup_eval360_evaluacion_participante", "participante_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    campana_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_campana.id", ondelete="CASCADE"), nullable=False
    )
    participante_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_participante.id", ondelete="CASCADE"), nullable=False
    )
    evaluador_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True,
        comment="Nullable para clientes externos (usar evaluador_nombre)",
    )
    evaluador_nombre: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tipo_evaluador: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="autoevaluacion|jefe|par|subordinado|cliente_interno|cliente_externo",
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pendiente",
        comment="pendiente|en_progreso|completada|vencida",
    )
    es_anonima: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_asignacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    fecha_limite: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_completada: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    participante: Mapped["Eval360Participante"] = relationship(
        "Eval360Participante", back_populates="evaluaciones"
    )
    evaluador: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[evaluador_empleado_id]
    )
    respuestas: Mapped[List["Eval360Respuesta"]] = relationship(
        "Eval360Respuesta",
        back_populates="evaluacion",
        cascade="all, delete-orphan",
    )
    comentarios: Mapped[List["Eval360Comentario"]] = relationship(
        "Eval360Comentario",
        back_populates="evaluacion",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360Evaluacion id={self.id} participante_id={self.participante_id} "
            f"tipo={self.tipo_evaluador} estado={self.estado}>"
        )


class Eval360Respuesta(Base):
    """Respuesta a una pregunta dentro de una hoja de evaluacion."""

    __tablename__ = "levelup_eval360_respuesta"
    __table_args__ = (
        UniqueConstraint(
            "evaluacion_id", "pregunta_id",
            name="uq_levelup_eval360_respuesta",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    evaluacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_evaluacion.id", ondelete="CASCADE"), nullable=False
    )
    pregunta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_pregunta.id"), nullable=False
    )
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id"), nullable=False,
        comment="Denormalizado para agregacion rapida",
    )
    valor: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False,
        comment="Valor en la escala Likert de la campana",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    evaluacion: Mapped["Eval360Evaluacion"] = relationship(
        "Eval360Evaluacion", back_populates="respuestas"
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360Respuesta evaluacion_id={self.evaluacion_id} "
            f"pregunta_id={self.pregunta_id} valor={self.valor}>"
        )


class Eval360Comentario(Base):
    """Comentario cualitativo dentro de una hoja de evaluacion."""

    __tablename__ = "levelup_eval360_comentario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    evaluacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_evaluacion.id", ondelete="CASCADE"), nullable=False
    )
    competencia_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_competencias.id"), nullable=True,
        comment="Nullable = comentario general",
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(
        String(20), nullable=False, default="general",
        comment="fortaleza|oportunidad|general",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    evaluacion: Mapped["Eval360Evaluacion"] = relationship(
        "Eval360Evaluacion", back_populates="comentarios"
    )

    def __repr__(self) -> str:
        return f"<Eval360Comentario id={self.id} evaluacion_id={self.evaluacion_id}>"


class Eval360Resultado(Base):
    """Cache de resultados calculados por evaluado (y por competencia).

    competencia_id NULL => fila de resumen global del participante.
    Los campos desempeno/potencial quedan reservados para la matriz 9-Box.
    """

    __tablename__ = "levelup_eval360_resultado"
    __table_args__ = (
        UniqueConstraint(
            "participante_id", "competencia_id",
            name="uq_levelup_eval360_resultado",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    participante_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_eval360_participante.id", ondelete="CASCADE"), nullable=False
    )
    competencia_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_competencias.id"), nullable=True
    )
    promedio_general: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    # {"jefe": 4.1, "par": 3.8, "subordinado": 4.0, "cliente_interno": 3.9}
    promedio_por_tipo: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    autoevaluacion: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    nivel_esperado: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    brecha: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    estado_brecha: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="cumple|riesgo|brecha",
    )
    calificacion_general: Mapped[Optional[float]] = mapped_column(
        Numeric(6, 2), nullable=True,
        comment="Solo en la fila resumen (competencia_id NULL)",
    )
    # Reservados para 9-Box / deteccion de talento (fases futuras)
    desempeno: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    potencial: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    calculado_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    participante: Mapped["Eval360Participante"] = relationship(
        "Eval360Participante", back_populates="resultados"
    )

    def __repr__(self) -> str:
        return (
            f"<Eval360Resultado participante_id={self.participante_id} "
            f"competencia_id={self.competencia_id} promedio={self.promedio_general}>"
        )
