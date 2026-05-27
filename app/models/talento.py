# app/models/talento.py
"""
Modelos SQLAlchemy para el modulo de Talento.

Entidades:
  - PuestoPerfil: perfil de puesto con competencias tecnicas/blandas en JSONB
  - Competencia: catalogo de competencias (tecnicas y blandas)
  - CompetenciaRequisito: relacion puesto-competencia con nivel requerido (0-4)
  - TareaCatalogo: catalogo centralizado de tareas reutilizables
  - PerfilTarea: tareas asociadas a un puesto perfil (vinculadas al catalogo)
  - PerfilCualificacion: cualificaciones requeridas por puesto
  - CompetenciaRequisito: competencias requeridas por puesto (unificado perfil + matriz)
  - PerfilFunciones: asignacion individual empleado-puesto
  - PerfilFuncionesCualificacion: evaluacion individual de cualificacion
  - PerfilFuncionesCompetencia: evaluacion individual de competencia
  - PerfilFuncionesTarea: tarea extra individual asignada a un empleado
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
    from app.models.catalogos import Area
    from app.models.empleados import Empleado
    from app.models.level_up import Curso


class PuestoPerfil(Base):
    __tablename__ = "puestos_perfil"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    nivel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Perfil de Funciones columns ────────────────────────────────────────────
    division: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )  # 'holding' | 'wsd' | 'wcs'
    centro_leoni: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    form_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    reporta_a: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ordenes_funcional_de: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    responsable_de: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sustituye_a: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sustituido_por: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    obligaciones_empresariales: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False
    )
    obligacion_confidencialidad: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False
    )
    poderes_legales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    complemento_poderes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )
    tareas: Mapped[List["PerfilTarea"]] = relationship(
        "PerfilTarea", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )
    cualificaciones: Mapped[List["PerfilCualificacion"]] = relationship(
        "PerfilCualificacion", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )
    asignaciones_funciones: Mapped[List["PerfilFunciones"]] = relationship(
        "PerfilFunciones", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PuestoPerfil id={self.id} codigo={self.codigo} nombre={self.nombre}>"


class Competencia(Base):
    __tablename__ = "competencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'tecnica' | 'blanda'
    subcategoria: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="competencia", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Competencia id={self.id} nombre={self.nombre} categoria={self.categoria}>"


class CompetenciaRequisito(Base):
    __tablename__ = "competencia_requisitos"
    __table_args__ = (
        UniqueConstraint(
            "competencia_id", "puesto_perfil_id", name="uq_competencia_puesto_perfil"
        ),
        CheckConstraint(
            "nivel_requerido >= 0 AND nivel_requerido <= 4",
            name="ck_nivel_requerido_rango",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("competencias.id", ondelete="CASCADE"), nullable=False
    )
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    nivel_requerido: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto",
    )
    orden: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    competencia: Mapped["Competencia"] = relationship(
        "Competencia", back_populates="requisitos"
    )
    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="requisitos"
    )

    def __repr__(self) -> str:
        return (
            f"<CompetenciaRequisito competencia_id={self.competencia_id} "
            f"puesto_perfil_id={self.puesto_perfil_id} nivel={self.nivel_requerido}>"
        )


class EvaluacionCompetencia(Base):
    __tablename__ = "evaluaciones_competencia"
    __table_args__ = (
        UniqueConstraint(
            "empleado_id", "competencia_id", name="uq_evaluacion_vigente"
        ),
        CheckConstraint(
            "nivel_actual >= 0 AND nivel_actual <= 4",
            name="ck_nivel_actual_rango",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.id"), nullable=False
    )
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("competencias.id", ondelete="CASCADE"), nullable=False
    )
    nivel_actual: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto",
    )
    evaluador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_evaluacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    empleado: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )
    competencia: Mapped["Competencia"] = relationship("Competencia")
    evaluador: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[evaluador_id]
    )

    def __repr__(self) -> str:
        return (
            f"<EvaluacionCompetencia empleado_id={self.empleado_id} "
            f"competencia_id={self.competencia_id} nivel={self.nivel_actual}>"
        )


class Capacitacion(Base):
    __tablename__ = "capacitaciones"
    __table_args__ = (
        Index("ix_capacitaciones_activo_estado", "activo", "estado"),
        Index("ix_capacitaciones_area_id", "area_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duracion_horas: Mapped[int] = mapped_column(Integer, nullable=False)
    modalidad: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'presencial' | 'online' | 'mixta'
    instructor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_inicio: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_fin: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cupo_maximo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    competencias_asociadas: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, default=list
    )
    curso_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cursos.id"), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="activa"
    )  # 'activa' | 'cancelada' | 'finalizada'
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    curso: Mapped[Optional["Curso"]] = relationship("Curso", back_populates="capacitaciones")
    inscripciones: Mapped[List["Inscripcion"]] = relationship(
        "Inscripcion", back_populates="capacitacion", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Capacitacion id={self.id} nombre={self.nombre} estado={self.estado}>"


class Inscripcion(Base):
    __tablename__ = "inscripciones_capacitacion"
    __table_args__ = (
        UniqueConstraint(
            "capacitacion_id", "empleado_id", name="uq_inscripcion_cap_emp"
        ),
        Index("ix_inscripciones_empleado_id", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    capacitacion_id: Mapped[int] = mapped_column(
        ForeignKey("capacitaciones.id"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.id"), nullable=False
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="inscrito"
    )  # 'inscrito' | 'en_curso' | 'completado' | 'cancelado'
    calificacion: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_inscripcion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    fecha_completado: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    capacitacion: Mapped["Capacitacion"] = relationship(
        "Capacitacion", back_populates="inscripciones"
    )
    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])

    def __repr__(self) -> str:
        return (
            f"<Inscripcion id={self.id} capacitacion_id={self.capacitacion_id} "
            f"empleado_id={self.empleado_id} estado={self.estado}>"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Perfil de Funciones — Modelos
# ═══════════════════════════════════════════════════════════════════════════════


class TareaCatalogo(Base):
    """Catalogo centralizado de tareas reutilizables."""

    __tablename__ = "tareas_catalogo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    categoria: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    es_complemento: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    perfil_tareas: Mapped[List["PerfilTarea"]] = relationship(
        "PerfilTarea", back_populates="tarea_catalogo"
    )

    def __repr__(self) -> str:
        return f"<TareaCatalogo id={self.id} nombre={self.nombre}>"


class PerfilTarea(Base):
    """Tareas asociadas a un puesto perfil (1:N), vinculadas al catalogo."""

    __tablename__ = "perfil_tareas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    tarea_catalogo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tareas_catalogo.id", ondelete="SET NULL"), nullable=True
    )
    orden: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    es_complemento: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="tareas"
    )
    tarea_catalogo: Mapped[Optional["TareaCatalogo"]] = relationship(
        "TareaCatalogo", back_populates="perfil_tareas"
    )

    def __repr__(self) -> str:
        return f"<PerfilTarea id={self.id} orden={self.orden} puesto_perfil_id={self.puesto_perfil_id}>"


class PerfilCualificacion(Base):
    """Cualificaciones requeridas por puesto (1:N)."""

    __tablename__ = "perfil_cualificaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # estudios_finalizados | formacion_profesional | ampliacion_formacion | estudios_universitarios | experiencia_profesional | experiencia_direccion | complementos
    situacion_deseada: Mapped[str] = mapped_column(Text, nullable=False)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="cualificaciones"
    )
    evaluaciones: Mapped[List["PerfilFuncionesCualificacion"]] = relationship(
        "PerfilFuncionesCualificacion", back_populates="cualificacion", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PerfilCualificacion id={self.id} tipo={self.tipo} puesto_perfil_id={self.puesto_perfil_id}>"


class PerfilFunciones(Base):
    """Asignacion individual empleado-puesto (perfil de funciones firmado)."""

    __tablename__ = "perfil_funciones"
    __table_args__ = (
        UniqueConstraint(
            "puesto_perfil_id", "empleado_id",
            name="uq_perfil_funciones_puesto_empleado_activo",
        ),
        Index("ix_perfil_funciones_empleado_id", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("puestos_perfil.id"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.id"), nullable=False
    )
    departamento: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    fecha_firma_superior: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_firma_empleado: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    firma_superior_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    firma_empleado_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="asignaciones_funciones"
    )
    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    evaluaciones_cualificacion: Mapped[List["PerfilFuncionesCualificacion"]] = relationship(
        "PerfilFuncionesCualificacion", back_populates="perfil_funciones", cascade="all, delete-orphan"
    )
    evaluaciones_competencia: Mapped[List["PerfilFuncionesCompetencia"]] = relationship(
        "PerfilFuncionesCompetencia", back_populates="perfil_funciones", cascade="all, delete-orphan"
    )
    tareas_extra: Mapped[List["PerfilFuncionesTarea"]] = relationship(
        "PerfilFuncionesTarea", back_populates="perfil_funciones", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<PerfilFunciones id={self.id} puesto_perfil_id={self.puesto_perfil_id} "
            f"empleado_id={self.empleado_id} activo={self.activo}>"
        )


class PerfilFuncionesCualificacion(Base):
    """Evaluacion individual de cualificacion para un perfil de funciones."""

    __tablename__ = "perfil_funciones_cualificacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    cualificacion_id: Mapped[int] = mapped_column(
        ForeignKey("perfil_cualificaciones.id"), nullable=False
    )
    situacion_actual: Mapped[str] = mapped_column(Text, nullable=False)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    perfil_funciones: Mapped["PerfilFunciones"] = relationship(
        "PerfilFunciones", back_populates="evaluaciones_cualificacion"
    )
    cualificacion: Mapped["PerfilCualificacion"] = relationship(
        "PerfilCualificacion", back_populates="evaluaciones"
    )

    def __repr__(self) -> str:
        return (
            f"<PerfilFuncionesCualificacion id={self.id} "
            f"perfil_funciones_id={self.perfil_funciones_id} cualificacion_id={self.cualificacion_id}>"
        )


class PerfilFuncionesCompetencia(Base):
    """Evaluacion individual de competencia para un perfil de funciones."""

    __tablename__ = "perfil_funciones_competencia"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    competencia_requisito_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competencia_requisitos.id", ondelete="CASCADE"), nullable=True
    )
    situacion_actual: Mapped[str] = mapped_column(Text, nullable=False)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    perfil_funciones: Mapped["PerfilFunciones"] = relationship(
        "PerfilFunciones", back_populates="evaluaciones_competencia"
    )
    competencia_requisito: Mapped[Optional["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito"
    )

    def __repr__(self) -> str:
        return (
            f"<PerfilFuncionesCompetencia id={self.id} "
            f"perfil_funciones_id={self.perfil_funciones_id} competencia_requisito_id={self.competencia_requisito_id}>"
        )


class PerfilFuncionesTarea(Base):
    """Tarea extra asignada individualmente a un empleado (perfil_funciones)."""

    __tablename__ = "perfil_funciones_tarea"
    __table_args__ = (
        UniqueConstraint(
            "perfil_funciones_id", "tarea_catalogo_id",
            name="uq_perfil_funciones_tarea_pair",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    tarea_catalogo_id: Mapped[int] = mapped_column(
        ForeignKey("tareas_catalogo.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    perfil_funciones: Mapped["PerfilFunciones"] = relationship(
        "PerfilFunciones", back_populates="tareas_extra"
    )
    tarea_catalogo: Mapped["TareaCatalogo"] = relationship("TareaCatalogo")

    def __repr__(self) -> str:
        return (
            f"<PerfilFuncionesTarea id={self.id} "
            f"perfil_funciones_id={self.perfil_funciones_id} tarea_catalogo_id={self.tarea_catalogo_id}>"
        )
