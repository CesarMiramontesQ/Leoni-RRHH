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
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.catalogos import Area
    from app.models.clasificacion_puesto import (
        CareerPath,
        CategoriaTarea,
        DisciplinaPuesto,
        FuncionPuesto,
        PuestoPerfilClasificacionHistorial,
    )
    from app.models.empleados import Empleado
    from app.models.level_up import Curso


class PuestoPerfil(Base):
    __tablename__ = "levelup_puestos_perfil"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('administrativo', 'operativo')",
            name="ck_levelup_puestos_perfil_tipo",
        ),
        CheckConstraint(
            "estado IN ('activo', 'inactivo', 'en_revision')",
            name="ck_levelup_puestos_perfil_estado",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(
        String(50), nullable=False, default="administrativo", server_default="administrativo"
    )
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # ── Clasificacion del puesto (Willis Towers Watson) ────────────────────────
    # Nullable en BD a proposito: los perfiles creados antes de la metodologia WTW
    # quedan sin clasificar y se marcan como "clasificacion pendiente" en la UI.
    # El schema de alta si los exige; el de edicion no, para no bloquear a RH.
    career_path_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_career_paths.id"), nullable=True
    )
    funcion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_funciones_puesto.id"), nullable=True
    )
    disciplina_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_disciplinas_puesto.id"), nullable=True
    )
    # `activo` sigue siendo el soft-delete; el servicio mantiene la invariante
    # activo == (estado != 'inactivo') para no romper los filtros existentes.
    estado: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="activo",
        server_default="activo",
        comment="activo|inactivo|en_revision",
    )
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
    career_path: Mapped[Optional["CareerPath"]] = relationship(
        "CareerPath", foreign_keys=[career_path_id]
    )
    funcion: Mapped[Optional["FuncionPuesto"]] = relationship(
        "FuncionPuesto", foreign_keys=[funcion_id]
    )
    disciplina: Mapped[Optional["DisciplinaPuesto"]] = relationship(
        "DisciplinaPuesto", foreign_keys=[disciplina_id]
    )
    clasificacion_historial: Mapped[List["PuestoPerfilClasificacionHistorial"]] = relationship(
        "PuestoPerfilClasificacionHistorial",
        back_populates="puesto_perfil",
        cascade="all, delete-orphan",
    )
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
    grados_config: Mapped[List["PuestoPerfilGrado"]] = relationship(
        "PuestoPerfilGrado", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PuestoPerfil id={self.id} codigo={self.codigo} nombre={self.nombre}>"


class GrupoCompetencia(Base):
    """
    Categoria de competencia (Tecnicas, Conductuales, Liderazgo, Digitales).

    `codigo` es la fuente de verdad de `Competencia.categoria`. Antes la categoria se
    adivinaba desde el nombre del grupo (`categoria_desde_grupo_nombre`), que caia
    siempre a "blanda" para cualquier nombre nuevo.
    """

    __tablename__ = "levelup_grupos_competencia"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tipos: Mapped[List["TipoCompetencia"]] = relationship(
        "TipoCompetencia", back_populates="grupo_competencia"
    )

    def __repr__(self) -> str:
        return f"<GrupoCompetencia id={self.id} nombre={self.nombre}>"


class TipoCompetencia(Base):
    """Catalogo de tipos de competencia (ej. Informatica, Idiomas, Profesional)."""

    __tablename__ = "levelup_tipos_competencia"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    grupo_competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_grupos_competencia.id"), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    grupo_competencia: Mapped["GrupoCompetencia"] = relationship(
        "GrupoCompetencia", back_populates="tipos"
    )
    competencias: Mapped[List["Competencia"]] = relationship(
        "Competencia", back_populates="tipo_competencia"
    )

    def __repr__(self) -> str:
        return f"<TipoCompetencia id={self.id} nombre={self.nombre} grupo_id={self.grupo_competencia_id}>"


class Competencia(Base):
    __tablename__ = "levelup_competencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # codigo del grupo de competencia: 'tecnica' | 'blanda' | 'liderazgo' | 'digital' | ...
    tipo_competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_tipos_competencia.id"), nullable=False
    )
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
    tipo_competencia: Mapped["TipoCompetencia"] = relationship(
        "TipoCompetencia", back_populates="competencias"
    )
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="competencia", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Competencia id={self.id} nombre={self.nombre} categoria={self.categoria}>"


class CompetenciaRequisito(Base):
    __tablename__ = "levelup_competencia_requisitos"
    __table_args__ = (
        UniqueConstraint(
            "competencia_id", "puesto_perfil_id", "grado_id",
            name="uq_levelup_competencia_puesto_grado",
        ),
        CheckConstraint(
            "nivel_requerido >= 0",
            name="ck_levelup_nivel_requerido_nonneg",
        ),
        Index(
            "uq_levelup_competencia_puesto_general",
            "competencia_id", "puesto_perfil_id",
            unique=True,
            postgresql_where=text("grado_id IS NULL"),
            sqlite_where=text("grado_id IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id", ondelete="CASCADE"), nullable=False
    )
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    grado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    nivel_requerido: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="0=N/A, 1=Planeado, 2=En entrenamiento, 3=Certificado, 4=Experto",
    )
    evidencia: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Evidencia opcional que acredita el nivel requerido en este puesto",
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
    grado: Mapped[Optional["GradoPuesto"]] = relationship("GradoPuesto", back_populates="requisitos")

    def __repr__(self) -> str:
        return (
            f"<CompetenciaRequisito competencia_id={self.competencia_id} "
            f"puesto_perfil_id={self.puesto_perfil_id} grado_id={self.grado_id} "
            f"nivel={self.nivel_requerido}>"
        )


class EvaluacionCompetencia(Base):
    __tablename__ = "levelup_evaluaciones_competencia"
    __table_args__ = (
        UniqueConstraint(
            "empleado_id", "competencia_id", name="uq_levelup_evaluacion_vigente"
        ),
        CheckConstraint(
            "nivel_actual >= 0",
            name="ck_levelup_nivel_actual_nonneg",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id", ondelete="CASCADE"), nullable=False
    )
    nivel_actual: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="0=N/A, 1=Planeado, 2=En entrenamiento, 3=Certificado, 4=Experto",
    )
    evaluador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="cerrado", default="borrador"
    )
    comentario_devolucion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    __tablename__ = "levelup_capacitaciones"
    __table_args__ = (
        Index("ix_levelup_capacitaciones_activo_estado", "activo", "estado"),
        Index("ix_levelup_capacitaciones_area_id", "area_id"),
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
        ForeignKey("levelup_cursos.id"), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="activa"
    )  # 'activa' | 'cancelada' | 'finalizada'
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
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
    __tablename__ = "levelup_inscripciones_capacitacion"
    __table_args__ = (
        UniqueConstraint(
            "capacitacion_id", "empleado_id", name="uq_levelup_inscripcion_cap_emp"
        ),
        Index("ix_levelup_inscripciones_empleado_id", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    capacitacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_capacitaciones.id"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
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
# Catálogo de Cualificaciones — Modelos
# ═══════════════════════════════════════════════════════════════════════════════


class TipoCualificacionCatalogo(Base):
    """Catálogo de tipos de cualificación (configurable por RH)."""

    __tablename__ = "levelup_tipos_cualificacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    cualificaciones: Mapped[List["CualificacionCatalogo"]] = relationship(
        "CualificacionCatalogo", back_populates="tipo_cualificacion"
    )

    def __repr__(self) -> str:
        return f"<TipoCualificacionCatalogo id={self.id} nombre={self.nombre}>"


class MetodoCalificacion(Base):
    """Método o regla de calificación para evaluar cualificaciones."""

    __tablename__ = "levelup_metodos_calificacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    opciones: Mapped[List["OpcionCalificacion"]] = relationship(
        "OpcionCalificacion", back_populates="metodo_calificacion", cascade="all, delete-orphan"
    )
    cualificaciones: Mapped[List["CualificacionCatalogo"]] = relationship(
        "CualificacionCatalogo", back_populates="metodo_calificacion"
    )

    def __repr__(self) -> str:
        return f"<MetodoCalificacion id={self.id} nombre={self.nombre} tipo={self.tipo}>"


class OpcionCalificacion(Base):
    """Opción de calificación asociada a un método (cuando aplica)."""

    __tablename__ = "levelup_opciones_calificacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    metodo_calificacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_metodos_calificacion.id", ondelete="CASCADE"), nullable=False
    )
    etiqueta: Mapped[str] = mapped_column(String(200), nullable=False)
    valor: Mapped[str] = mapped_column(String(100), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    peso: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    metodo_calificacion: Mapped["MetodoCalificacion"] = relationship(
        "MetodoCalificacion", back_populates="opciones"
    )

    def __repr__(self) -> str:
        return f"<OpcionCalificacion id={self.id} valor={self.valor}>"


class CualificacionCatalogo(Base):
    """Catálogo maestro de cualificaciones reutilizables en perfiles."""

    __tablename__ = "levelup_cualificaciones_catalogo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tipo_cualificacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_tipos_cualificacion.id"), nullable=False
    )
    metodo_calificacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_metodos_calificacion.id"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    obligatorio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    legacy_tipo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tipo_cualificacion: Mapped["TipoCualificacionCatalogo"] = relationship(
        "TipoCualificacionCatalogo", back_populates="cualificaciones"
    )
    metodo_calificacion: Mapped["MetodoCalificacion"] = relationship(
        "MetodoCalificacion", back_populates="cualificaciones"
    )
    requisitos_perfil: Mapped[List["PerfilCualificacion"]] = relationship(
        "PerfilCualificacion", back_populates="cualificacion_catalogo"
    )

    def __repr__(self) -> str:
        return f"<CualificacionCatalogo id={self.id} nombre={self.nombre}>"


# ═══════════════════════════════════════════════════════════════════════════════
# Perfil de Funciones — Modelos
# ═══════════════════════════════════════════════════════════════════════════════


class GradoPuesto(Base):
    """
    Global Level de la metodologia Willis Towers Watson (P1..Pn / M1..Mn).

    Cada nivel pertenece a un Career Path, asi que `codigo` y `orden` son unicos
    *dentro* del career path, no globalmente: P1 y M1 coexisten. La tabla conserva
    el nombre `levelup_grados_puesto` porque cuatro tablas la referencian por FK
    (`competencia_requisitos`, `perfil_tareas`, `perfil_funciones`,
    `puesto_perfil_grados`); renombrarla seria riesgo sin beneficio.
    """

    __tablename__ = "levelup_grados_puesto"
    __table_args__ = (
        UniqueConstraint(
            "career_path_id", "codigo", name="uq_levelup_grados_puesto_path_codigo"
        ),
        UniqueConstraint(
            "career_path_id", "orden", name="uq_levelup_grados_puesto_path_orden"
        ),
        UniqueConstraint(
            "career_path_id", "nombre", name="uq_levelup_grados_puesto_path_nombre"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    career_path_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_career_paths.id"), nullable=False
    )
    codigo: Mapped[str] = mapped_column(String(10), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    career_path: Mapped["CareerPath"] = relationship(
        "CareerPath", back_populates="grados"
    )
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="grado"
    )
    asignaciones_funciones: Mapped[List["PerfilFunciones"]] = relationship(
        "PerfilFunciones", back_populates="grado"
    )

    def __repr__(self) -> str:
        return (
            f"<GradoPuesto id={self.id} codigo={self.codigo} "
            f"career_path_id={self.career_path_id} orden={self.orden}>"
        )


class PuestoPerfilGrado(Base):
    """Grados de progresion configurados para un perfil (rango consecutivo por orden)."""
    __tablename__ = "levelup_puesto_perfil_grados"
    __table_args__ = (
        UniqueConstraint("puesto_perfil_id", "grado_id", name="uq_levelup_puesto_perfil_grado"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    grado_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    puesto_perfil: Mapped["PuestoPerfil"] = relationship("PuestoPerfil", back_populates="grados_config")
    grado: Mapped["GradoPuesto"] = relationship("GradoPuesto")

    def __repr__(self) -> str:
        return (
            f"<PuestoPerfilGrado puesto_perfil_id={self.puesto_perfil_id} "
            f"grado_id={self.grado_id}>"
        )


class MetodoCalificacionCompetencia(Base):
    """Catalogo configurable de metodos de calificacion para competencias."""

    __tablename__ = "levelup_metodos_calificacion_competencia"
    __table_args__ = (
        CheckConstraint(
            "valor >= 1",
            name="ck_levelup_metodo_calificacion_competencia_valor_pos",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    valor: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<MetodoCalificacionCompetencia id={self.id} valor={self.valor} "
            f"nombre={self.nombre} orden={self.orden}>"
        )


class TareaCatalogo(Base):
    """Catalogo centralizado de tareas reutilizables."""

    __tablename__ = "levelup_tareas_catalogo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria_tarea_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_categorias_tarea.id"), nullable=True
    )
    # Texto libre legacy: se conserva de solo lectura mientras se migra a la FK.
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
    categoria_tarea: Mapped[Optional["CategoriaTarea"]] = relationship(
        "CategoriaTarea", back_populates="tareas_catalogo"
    )
    perfil_tareas: Mapped[List["PerfilTarea"]] = relationship(
        "PerfilTarea", back_populates="tarea_catalogo"
    )

    def __repr__(self) -> str:
        return f"<TareaCatalogo id={self.id} nombre={self.nombre}>"


class PerfilTarea(Base):
    """
    Responsabilidades del puesto (1:N), vinculadas al catalogo de tareas.

    `porcentaje_dedicacion` alimenta el analisis del puesto: la suma por perfil
    (o por grado, si la tarea esta acotada a uno) deberia acercarse a 100%, pero no
    se valida de forma bloqueante — la UI solo avisa.
    """

    __tablename__ = "levelup_perfil_tareas"
    __table_args__ = (
        CheckConstraint(
            "porcentaje_dedicacion IS NULL "
            "OR (porcentaje_dedicacion >= 0 AND porcentaje_dedicacion <= 100)",
            name="ck_levelup_perfil_tareas_porcentaje",
        ),
        CheckConstraint(
            "prioridad IS NULL OR prioridad IN ('alta', 'media', 'baja')",
            name="ck_levelup_perfil_tareas_prioridad",
        ),
        CheckConstraint(
            "frecuencia IS NULL OR frecuencia IN "
            "('diaria', 'semanal', 'mensual', 'trimestral', 'anual', 'eventual')",
            name="ck_levelup_perfil_tareas_frecuencia",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    tarea_catalogo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_tareas_catalogo.id", ondelete="SET NULL"), nullable=True
    )
    grado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    orden: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    es_complemento: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    categoria_tarea_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_categorias_tarea.id"), nullable=True
    )
    prioridad: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, comment="alta|media|baja"
    )
    frecuencia: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="diaria|semanal|mensual|trimestral|anual|eventual",
    )
    porcentaje_dedicacion: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True
    )
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
    categoria_tarea: Mapped[Optional["CategoriaTarea"]] = relationship(
        "CategoriaTarea", back_populates="perfil_tareas"
    )
    grado: Mapped[Optional["GradoPuesto"]] = relationship("GradoPuesto")

    def __repr__(self) -> str:
        return f"<PerfilTarea id={self.id} orden={self.orden} puesto_perfil_id={self.puesto_perfil_id}>"


class PerfilCualificacion(Base):
    """Cualificaciones requeridas por puesto (1:N)."""

    __tablename__ = "levelup_perfil_cualificaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    cualificacion_catalogo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_cualificaciones_catalogo.id", ondelete="RESTRICT"), nullable=True
    )
    criterio_requerido: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    tipo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    situacion_deseada: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anios_minimos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
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
    cualificacion_catalogo: Mapped[Optional["CualificacionCatalogo"]] = relationship(
        "CualificacionCatalogo", back_populates="requisitos_perfil"
    )
    evaluaciones: Mapped[List["PerfilFuncionesCualificacion"]] = relationship(
        "PerfilFuncionesCualificacion", back_populates="cualificacion", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<PerfilCualificacion id={self.id} "
            f"cualificacion_catalogo_id={self.cualificacion_catalogo_id} "
            f"puesto_perfil_id={self.puesto_perfil_id}>"
        )


class AccionRecomendada(Base):
    """Catalogo de acciones recomendadas por rango de brecha."""

    __tablename__ = "levelup_acciones_recomendadas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    brecha_min: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    brecha_max: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    etiqueta: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    orden: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    def __repr__(self) -> str:
        return f"<AccionRecomendada id={self.id} etiqueta={self.etiqueta} [{self.brecha_min}-{self.brecha_max}%]>"


class PerfilFunciones(Base):
    """Asignacion individual empleado-puesto (perfil de funciones firmado)."""

    __tablename__ = "levelup_perfil_funciones"
    __table_args__ = (
        UniqueConstraint(
            "puesto_perfil_id", "empleado_id",
            name="uq_levelup_perfil_funciones_puesto_empleado_activo",
        ),
        Index("ix_levelup_perfil_funciones_empleado_id", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    grado_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=False
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
    grado: Mapped["GradoPuesto"] = relationship("GradoPuesto", back_populates="asignaciones_funciones")
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

    __tablename__ = "levelup_perfil_funciones_cualificacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    cualificacion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_perfil_cualificaciones.id"), nullable=False
    )
    valor_capturado: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    situacion_actual: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anios_actuales: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
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

    __tablename__ = "levelup_perfil_funciones_competencia"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    competencia_requisito_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_competencia_requisitos.id", ondelete="CASCADE"), nullable=True
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

    __tablename__ = "levelup_perfil_funciones_tarea"
    __table_args__ = (
        UniqueConstraint(
            "perfil_funciones_id", "tarea_catalogo_id",
            name="uq_levelup_perfil_funciones_tarea_pair",
        ),
        CheckConstraint(
            "nivel IS NULL OR (nivel >= 1 AND nivel <= 3)",
            name="ck_levelup_perfil_funciones_tarea_nivel",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perfil_funciones_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_perfil_funciones.id", ondelete="CASCADE"), nullable=False
    )
    tarea_catalogo_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_tareas_catalogo.id", ondelete="CASCADE"), nullable=False
    )
    nivel: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="1=Basico, 2=Medio, 3=Experto",
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


# ═══════════════════════════════════════════════════════════════════════════════
# Plan de Desarrollo Individual (PDI)
# ═══════════════════════════════════════════════════════════════════════════════


class PlanDesarrolloIndividual(Base):
    """Acción de desarrollo asignada a un empleado para cerrar brechas de competencia."""

    __tablename__ = "levelup_plan_desarrollo_individual"
    __table_args__ = (
        Index("ix_levelup_pdi_empleado_id", "empleado_id"),
        Index("ix_levelup_pdi_competencia_id", "competencia_id"),
        CheckConstraint("fecha_fin >= fecha_inicio", name="ck_levelup_pdi_fechas"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), nullable=False
    )
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_competencias.id", ondelete="CASCADE"), nullable=False
    )
    accion: Mapped[str] = mapped_column(String(300), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    duracion_horas: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    responsable: Mapped[str] = mapped_column(String(200), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    prioridad: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="media")
    recursos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_por: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    competencia: Mapped["Competencia"] = relationship("Competencia")
    creador: Mapped[Optional["Empleado"]] = relationship(
        "Empleado",
        foreign_keys=[creado_por],
        primaryjoin="foreign(PlanDesarrolloIndividual.creado_por) == Empleado.empleado_id",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<PDI id={self.id} empleado={self.empleado_id} competencia={self.competencia_id} estado={self.estado}>"
