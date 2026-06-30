import enum
from datetime import date, datetime, time
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado
    from app.models.talento import Capacitacion, PuestoPerfil


# ── Enums ────────────────────────────────────────────────────────────────────


class CategoriaCapacidad(str, enum.Enum):
    tecnica = "tecnica"
    operativa = "operativa"
    seguridad = "seguridad"
    calidad = "calidad"


class TipoHabilidad(str, enum.Enum):
    tecnica = "tecnica"
    blanda = "blanda"
    operativa = "operativa"
    critica = "critica"


class CategoriaCurso(str, enum.Enum):
    tecnico = "tecnico"
    calidad = "calidad"
    seguridad = "seguridad"
    operativo = "operativo"
    blanda = "blanda"


class TipoCurso(str, enum.Enum):
    interno = "interno"
    externo = "externo"


class ClasificacionCurso(str, enum.Enum):
    adicional = "adicional"
    contemplado = "contemplado"


class EstadoAprobacionOPL(str, enum.Enum):
    borrador = "borrador"
    revision = "revision"
    aprobada = "aprobada"


class TipoEvidencia(str, enum.Enum):
    foto = "foto"
    documento = "documento"
    video = "video"
    firma = "firma"


class EstadoEvidencia(str, enum.Enum):
    pendiente = "pendiente"
    validada = "validada"
    devuelta = "devuelta"


class EstadoFirma(str, enum.Enum):
    pendiente = "pendiente"
    firmada = "firmada"
    rechazada = "rechazada"


class EstadoSugerencia(str, enum.Enum):
    activa = "activa"
    aprobada = "aprobada"
    pospuesta = "pospuesta"
    descartada = "descartada"


class EstadoPlanDesarrollo(str, enum.Enum):
    activo = "activo"
    completado = "completado"
    cancelado = "cancelado"


class TipoPlanEtapa(str, enum.Enum):
    curso = "curso"
    opl = "opl"
    evaluacion = "evaluacion"
    proyecto = "proyecto"


class EstadoPlanEtapa(str, enum.Enum):
    pendiente = "pendiente"
    en_curso = "en_curso"
    completada = "completada"


class EstadoSesion(str, enum.Enum):
    programada = "programada"
    en_curso = "en_curso"
    completada = "completada"
    cancelada = "cancelada"


class EstadoEncuesta(str, enum.Enum):
    activa = "activa"
    cerrada = "cerrada"


# ── Modelos ──────────────────────────────────────────────────────────────────


class Capacidad(Base):
    __tablename__ = "levelup_capacidades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[CategoriaCapacidad] = mapped_column(
        Enum(CategoriaCapacidad, name="categoria_capacidad_enum"), nullable=False
    )
    nivel_max: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    puestos_perfil: Mapped[List["CapacidadPuestoPerfil"]] = relationship(
        "CapacidadPuestoPerfil", back_populates="capacidad", cascade="all, delete-orphan"
    )
    evaluaciones: Mapped[List["EvaluacionCapacidad"]] = relationship(
        "EvaluacionCapacidad", back_populates="capacidad"
    )


class CapacidadPuestoPerfil(Base):
    __tablename__ = "levelup_capacidad_puesto_perfil"
    __table_args__ = (
        UniqueConstraint("capacidad_id", "puesto_perfil_id", name="uq_levelup_capacidad_puesto"),
        CheckConstraint(
            "nivel_requerido >= 1 AND nivel_requerido <= 5",
            name="ck_levelup_cap_puesto_nivel_rango",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    capacidad_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_capacidades.id", ondelete="CASCADE"), nullable=False
    )
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    nivel_requerido: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    capacidad: Mapped["Capacidad"] = relationship("Capacidad", back_populates="puestos_perfil")
    puesto_perfil: Mapped["PuestoPerfil"] = relationship("PuestoPerfil")


class Habilidad(Base):
    __tablename__ = "levelup_habilidades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo: Mapped[TipoHabilidad] = mapped_column(
        Enum(TipoHabilidad, name="tipo_habilidad_enum"), nullable=False
    )
    nivel_max: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    evaluaciones: Mapped[List["EvaluacionHabilidad"]] = relationship(
        "EvaluacionHabilidad", back_populates="habilidad"
    )


class EvaluacionCapacidad(Base):
    __tablename__ = "levelup_evaluaciones_capacidad"
    __table_args__ = (
        UniqueConstraint("empleado_id", "capacidad_id", name="uq_levelup_eval_capacidad_vigente"),
        CheckConstraint("nivel_actual >= 1 AND nivel_actual <= 5", name="ck_levelup_eval_cap_nivel_actual"),
        CheckConstraint("nivel_requerido >= 1 AND nivel_requerido <= 5", name="ck_levelup_eval_cap_nivel_req"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    capacidad_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_capacidades.id", ondelete="CASCADE"), nullable=False
    )
    nivel_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    nivel_requerido: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_evaluacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    evaluador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    capacidad: Mapped["Capacidad"] = relationship("Capacidad", back_populates="evaluaciones")
    evaluador: Mapped[Optional["Empleado"]] = relationship("Empleado", foreign_keys=[evaluador_id])


class EvaluacionHabilidad(Base):
    __tablename__ = "levelup_evaluaciones_habilidad"
    __table_args__ = (
        UniqueConstraint("empleado_id", "habilidad_id", name="uq_levelup_eval_habilidad_vigente"),
        CheckConstraint("nivel_actual >= 1 AND nivel_actual <= 4", name="ck_levelup_eval_hab_nivel_actual"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    habilidad_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_habilidades.id", ondelete="CASCADE"), nullable=False
    )
    nivel_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_evaluacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    evaluador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    habilidad: Mapped["Habilidad"] = relationship("Habilidad", back_populates="evaluaciones")
    evaluador: Mapped[Optional["Empleado"]] = relationship("Empleado", foreign_keys=[evaluador_id])


class Curso(Base):
    __tablename__ = "levelup_cursos"
    __table_args__ = (UniqueConstraint("nombre", name="uq_levelup_cursos_nombre"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(300), nullable=False)
    duracion_horas: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cupo_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    categoria_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_categoria.id"), nullable=True
    )
    tipo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_tipo.id"), nullable=True
    )
    clasificacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_clasificacion.id"), nullable=True
    )
    proveedor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_proveedor.id"), nullable=True
    )
    instructor_tipo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    instructor_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    instructor_externo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_instructor_externo.id"), nullable=True
    )
    modalidad: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sesiones_anio: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    obligatorio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requisitos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    centro_costos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    categoria_rel = relationship("CursoCategoria", foreign_keys=[categoria_id], lazy="joined")
    tipo_rel = relationship("CursoTipo", foreign_keys=[tipo_id], lazy="joined")
    clasificacion_rel = relationship("CursoClasificacion", foreign_keys=[clasificacion_id], lazy="joined")
    proveedor_rel = relationship("CursoProveedor", foreign_keys=[proveedor_id], lazy="joined")
    instructor_externo_rel = relationship("CursoInstructorExterno", foreign_keys=[instructor_externo_id], lazy="joined")
    instructor_empleado_rel = relationship("Empleado", foreign_keys=[instructor_empleado_id], lazy="joined")

    capacitaciones: Mapped[List["Capacitacion"]] = relationship(
        "Capacitacion", back_populates="curso"
    )
    sesiones: Mapped[List["CursoSesion"]] = relationship(
        "CursoSesion", back_populates="curso", cascade="all, delete-orphan"
    )
    puestos: Mapped[List["CursoPuesto"]] = relationship(
        "CursoPuesto", back_populates="curso", cascade="all, delete-orphan"
    )
    empleados: Mapped[List["CursoEmpleado"]] = relationship(
        "CursoEmpleado", back_populates="curso", cascade="all, delete-orphan"
    )
    grupos: Mapped[List["CursoGrupo"]] = relationship(
        "CursoGrupo", back_populates="curso", cascade="all, delete-orphan"
    )


class CursoSesion(Base):
    __tablename__ = "levelup_curso_sesion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hora_inicio: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    hora_fin: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    tipo: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instructor_tipo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    instructor_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    instructor_externo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_instructor_externo.id"), nullable=True
    )
    costo: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cupo_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[EstadoSesion] = mapped_column(
        Enum(EstadoSesion, name="estado_sesion_enum"),
        nullable=False,
        default=EstadoSesion.programada,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    curso: Mapped["Curso"] = relationship("Curso", back_populates="sesiones")
    instructor_externo_rel = relationship("CursoInstructorExterno", foreign_keys=[instructor_externo_id], lazy="joined")
    instructor_empleado_rel = relationship("Empleado", foreign_keys=[instructor_empleado_id], lazy="joined")
    puestos: Mapped[List["CursoPuesto"]] = relationship(
        "CursoPuesto", back_populates="sesion"
    )
    empleados: Mapped[List["CursoEmpleado"]] = relationship(
        "CursoEmpleado", back_populates="sesion"
    )


class CursoPuesto(Base):
    __tablename__ = "levelup_curso_puesto"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    sesion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_sesion.id", ondelete="SET NULL"), nullable=True
    )
    obligatorio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    curso: Mapped["Curso"] = relationship("Curso", back_populates="puestos")
    puesto_perfil: Mapped["PuestoPerfil"] = relationship("PuestoPerfil")
    sesion: Mapped[Optional["CursoSesion"]] = relationship("CursoSesion", back_populates="puestos")


class CursoEmpleado(Base):
    __tablename__ = "levelup_curso_empleado"
    __table_args__ = (
        Index("ix_levelup_curso_empleado_empleado_id", "empleado_id"),
        Index("ix_levelup_curso_empleado_curso_id", "curso_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), nullable=False
    )
    sesion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_curso_sesion.id", ondelete="SET NULL"), nullable=True
    )
    fecha: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    horas: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    centro_costo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tipo: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    clasificacion: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    obligatorio: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    puesto_al_momento: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    asistio: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    curso: Mapped["Curso"] = relationship("Curso", back_populates="empleados")
    empleado: Mapped["Empleado"] = relationship("Empleado")
    sesion: Mapped[Optional["CursoSesion"]] = relationship("CursoSesion", back_populates="empleados")


class TipoGrupoCurso(str, enum.Enum):
    area = "area"
    subarea = "subarea"
    puesto = "puesto"


class CursoGrupo(Base):
    __tablename__ = "levelup_curso_grupo"
    __table_args__ = (
        UniqueConstraint("curso_id", "tipo", "referencia_id", name="uq_levelup_curso_grupo"),
        Index("ix_levelup_curso_grupo_curso_id", "curso_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[TipoGrupoCurso] = mapped_column(
        Enum(TipoGrupoCurso, name="tipo_grupo_curso_enum"), nullable=False
    )
    referencia_id: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    curso: Mapped["Curso"] = relationship("Curso", back_populates="grupos")


class OPL(Base):
    __tablename__ = "levelup_opls"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    proceso: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    maquina: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    aprobador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    estado_aprobacion: Mapped[EstadoAprobacionOPL] = mapped_column(
        Enum(EstadoAprobacionOPL, name="estado_aprobacion_opl_enum"),
        nullable=False,
        default=EstadoAprobacionOPL.borrador,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    aprobador: Mapped[Optional["Empleado"]] = relationship("Empleado", foreign_keys=[aprobador_id])
    versiones: Mapped[List["OPLVersion"]] = relationship(
        "OPLVersion", back_populates="opl", cascade="all, delete-orphan"
    )


class OPLVersion(Base):
    __tablename__ = "levelup_opl_versiones"
    __table_args__ = (
        UniqueConstraint("opl_id", "version_num", name="uq_levelup_opl_version"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    opl_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_opls.id", ondelete="CASCADE"), nullable=False
    )
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    archivo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    cambios_descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    creado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    opl: Mapped["OPL"] = relationship("OPL", back_populates="versiones")
    creado_por: Mapped[Optional["Empleado"]] = relationship("Empleado", foreign_keys=[creado_por_id])


class EvidenciaCapacitacion(Base):
    __tablename__ = "levelup_evidencias_capacitacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tipo: Mapped[TipoEvidencia] = mapped_column(
        Enum(TipoEvidencia, name="tipo_evidencia_cap_enum"), nullable=False
    )
    archivo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    capacitacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_capacitaciones.id"), nullable=True
    )
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    estado: Mapped[EstadoEvidencia] = mapped_column(
        Enum(EstadoEvidencia, name="estado_evidencia_cap_enum"),
        nullable=False,
        default=EstadoEvidencia.pendiente,
    )
    fecha_subida: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    capacitacion: Mapped[Optional["Capacitacion"]] = relationship("Capacitacion")
    firmas: Mapped[List["EvidenciaFirma"]] = relationship(
        "EvidenciaFirma", back_populates="evidencia", cascade="all, delete-orphan"
    )


class EvidenciaFirma(Base):
    __tablename__ = "levelup_evidencia_firmas"
    __table_args__ = (
        UniqueConstraint("evidencia_id", "firmante_id", "rol_firma", name="uq_levelup_firma_evidencia_rol"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    evidencia_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_evidencias_capacitacion.id", ondelete="CASCADE"), nullable=False
    )
    firmante_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    rol_firma: Mapped[str] = mapped_column(String(100), nullable=False)
    estado: Mapped[EstadoFirma] = mapped_column(
        Enum(EstadoFirma, name="estado_firma_enum"),
        nullable=False,
        default=EstadoFirma.pendiente,
    )
    fecha_firma: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    evidencia: Mapped["EvidenciaCapacitacion"] = relationship(
        "EvidenciaCapacitacion", back_populates="firmas"
    )
    firmante: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[firmante_id])


class CursoEncuesta(Base):
    """Encuesta post curso habilitada por RH desde una sesión finalizada.

    La valoración pertenece al curso; la sesión solo define quién puede responder.
    "No habilitada" se representa con la ausencia de fila para la sesión.
    """

    __tablename__ = "levelup_curso_encuesta"
    __table_args__ = (
        UniqueConstraint("sesion_id", name="uq_levelup_curso_encuesta_sesion"),
        Index("ix_levelup_curso_encuesta_curso_id", "curso_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    sesion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_curso_sesion.id", ondelete="CASCADE"), nullable=False
    )
    estado: Mapped[EstadoEncuesta] = mapped_column(
        Enum(EstadoEncuesta, name="estado_encuesta_enum"),
        nullable=False,
        default=EstadoEncuesta.activa,
    )
    fecha_limite: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    habilitada_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    curso: Mapped["Curso"] = relationship("Curso")
    sesion: Mapped["CursoSesion"] = relationship("CursoSesion")
    respuestas: Mapped[List["EncuestaPostCurso"]] = relationship(
        "EncuestaPostCurso", back_populates="encuesta", cascade="all, delete-orphan"
    )


class EncuestaPostCurso(Base):
    """Respuesta individual de un asistente a la encuesta post curso de una sesión.

    Vinculada a encuesta + curso + sesión + empleado. Una respuesta por (sesión, empleado).
    Todas las respuestas de todas las sesiones alimentan el promedio del curso.
    """

    __tablename__ = "levelup_encuestas_post_curso"
    __table_args__ = (
        UniqueConstraint("sesion_id", "empleado_id", name="uq_levelup_encuesta_sesion_emp"),
        CheckConstraint("score_general >= 1 AND score_general <= 5", name="ck_levelup_enc_score_gen"),
        CheckConstraint("score_instructor >= 1 AND score_instructor <= 5", name="ck_levelup_enc_score_inst"),
        CheckConstraint("score_contenido >= 1 AND score_contenido <= 5", name="ck_levelup_enc_score_cont"),
        CheckConstraint("score_aplicabilidad >= 1 AND score_aplicabilidad <= 5", name="ck_levelup_enc_score_aplic"),
        Index("ix_levelup_encuestas_post_curso_curso_id", "curso_id"),
        Index("ix_levelup_encuestas_post_curso_encuesta_id", "encuesta_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    encuesta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_curso_encuesta.id", ondelete="CASCADE"), nullable=False
    )
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="CASCADE"), nullable=False
    )
    sesion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_curso_sesion.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    score_general: Mapped[int] = mapped_column(Integer, nullable=False)
    score_instructor: Mapped[int] = mapped_column(Integer, nullable=False)
    score_contenido: Mapped[int] = mapped_column(Integer, nullable=False)
    score_aplicabilidad: Mapped[int] = mapped_column(Integer, nullable=False)
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    encuesta: Mapped["CursoEncuesta"] = relationship("CursoEncuesta", back_populates="respuestas")


class SugerenciaCapacitacion(Base):
    __tablename__ = "levelup_sugerencias_capacitacion"
    __table_args__ = (
        CheckConstraint("prioridad >= 1 AND prioridad <= 5", name="ck_levelup_sug_prioridad"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    justificacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brecha_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    adopcion_sector_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    capacidades_afectadas: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    areas_afectadas: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    personas_alcanzables: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duracion_sugerida: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    inversion_estimada: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    proveedor_sugerido: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    prioridad: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    estado: Mapped[EstadoSugerencia] = mapped_column(
        Enum(EstadoSugerencia, name="estado_sugerencia_enum"),
        nullable=False,
        default=EstadoSugerencia.activa,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PlanDesarrollo(Base):
    __tablename__ = "levelup_planes_desarrollo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_inicio: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_fin_estimada: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    estado: Mapped[EstadoPlanDesarrollo] = mapped_column(
        Enum(EstadoPlanDesarrollo, name="estado_plan_desarrollo_enum"),
        nullable=False,
        default=EstadoPlanDesarrollo.activo,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    etapas: Mapped[List["PlanEtapa"]] = relationship(
        "PlanEtapa", back_populates="plan", cascade="all, delete-orphan"
    )


class PlanEtapa(Base):
    __tablename__ = "levelup_plan_etapas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_planes_desarrollo.id", ondelete="CASCADE"), nullable=False
    )
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo: Mapped[TipoPlanEtapa] = mapped_column(
        Enum(TipoPlanEtapa, name="tipo_plan_etapa_enum"), nullable=False
    )
    recurso_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estado: Mapped[EstadoPlanEtapa] = mapped_column(
        Enum(EstadoPlanEtapa, name="estado_plan_etapa_enum"),
        nullable=False,
        default=EstadoPlanEtapa.pendiente,
    )
    fecha_inicio: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_completado: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    plan: Mapped["PlanDesarrollo"] = relationship("PlanDesarrollo", back_populates="etapas")
