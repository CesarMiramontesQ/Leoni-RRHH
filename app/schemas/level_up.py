from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, Field

TipoHabilidad = Literal["tecnica", "blanda", "operativa", "critica"]


# ── Capacidad ────────────────────────────────────────────────────────────────


class CapacidadCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    categoria: Literal["tecnica", "operativa", "seguridad", "calidad"]
    nivel_max: int = Field(default=5, ge=1, le=5)


class CapacidadUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    categoria: Optional[Literal["tecnica", "operativa", "seguridad", "calidad"]] = None
    activo: Optional[bool] = None


class CapacidadResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    descripcion: Optional[str] = None
    categoria: str
    nivel_max: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class CapacidadPuestoPerfilCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    capacidad_id: int
    puesto_perfil_id: int
    nivel_requerido: int = Field(..., ge=1, le=5)


class CapacidadPuestoPerfilResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    capacidad_id: int
    puesto_perfil_id: int
    nivel_requerido: int
    created_at: datetime


# ── Habilidad ────────────────────────────────────────────────────────────────


class HabilidadCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo: Literal["tecnica", "blanda", "operativa", "critica"]
    nivel_max: int = Field(default=4, ge=1, le=4)


class HabilidadUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo: Optional[Literal["tecnica", "blanda", "operativa", "critica"]] = None
    activo: Optional[bool] = None


class HabilidadResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    nivel_max: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class HabilidadListResponse(BaseModel):
    items: list[HabilidadResponse]
    total: int
    page: int
    page_size: int


# ── EvaluacionCapacidad ──────────────────────────────────────────────────────


class EvaluacionCapacidadCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    empleado_id: int
    capacidad_id: int
    nivel_actual: int = Field(..., ge=1, le=5)
    nivel_requerido: int = Field(..., ge=1, le=5)
    evaluador_id: Optional[int] = None


class EvaluacionCapacidadResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    empleado_id: int
    capacidad_id: int
    nivel_actual: int
    nivel_requerido: int
    fecha_evaluacion: datetime
    evaluador_id: Optional[int] = None
    created_at: datetime


# ── EvaluacionHabilidad ──────────────────────────────────────────────────────


class EvaluacionHabilidadCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    empleado_id: int
    habilidad_id: int
    nivel_actual: int = Field(..., ge=1, le=4)
    evaluador_id: Optional[int] = None


class EvaluacionHabilidadResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    empleado_id: int
    habilidad_id: int
    nivel_actual: int
    fecha_evaluacion: datetime
    evaluador_id: Optional[int] = None
    created_at: datetime


# ── Curso ────────────────────────────────────────────────────────────────────

CategoriaCursoLiteral = Literal["tecnico", "calidad", "seguridad", "operativo", "blanda"]
TipoCursoLiteral = Literal["interno", "externo"]
ClasificacionCursoLiteral = Literal["adicional", "contemplado"]


class CursoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=300)
    proveedor: Optional[str] = None
    duracion_horas: Optional[float] = Field(None, gt=0)
    cupo_max: Optional[int] = Field(None, ge=1)
    instructor: Optional[str] = None
    categoria: Optional[CategoriaCursoLiteral] = None
    modalidad: Optional[str] = Field(None, max_length=50)
    sesiones_anio: Optional[int] = Field(None, ge=1)
    tipo: Optional[TipoCursoLiteral] = None
    clasificacion: Optional[ClasificacionCursoLiteral] = None
    obligatorio: bool = False
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None


class CursoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=300)
    proveedor: Optional[str] = None
    duracion_horas: Optional[float] = Field(None, gt=0)
    cupo_max: Optional[int] = Field(None, ge=1)
    instructor: Optional[str] = None
    categoria: Optional[CategoriaCursoLiteral] = None
    modalidad: Optional[str] = Field(None, max_length=50)
    sesiones_anio: Optional[int] = Field(None, ge=1)
    tipo: Optional[TipoCursoLiteral] = None
    clasificacion: Optional[ClasificacionCursoLiteral] = None
    obligatorio: Optional[bool] = None
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None
    activo: Optional[bool] = None


class CursoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    proveedor: Optional[str] = None
    duracion_horas: Optional[float] = None
    cupo_max: Optional[int] = None
    instructor: Optional[str] = None
    categoria: Optional[str] = None
    modalidad: Optional[str] = None
    sesiones_anio: Optional[int] = None
    tipo: Optional[str] = None
    clasificacion: Optional[str] = None
    obligatorio: bool
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class CursoListResponse(BaseModel):
    items: list[CursoResponse]
    total: int
    page: int
    page_size: int


# ── CursoSesion ─────────────────────────────────────────────────────────────

EstadoSesionLiteral = Literal["programada", "en_curso", "completada", "cancelada"]


class CursoSesionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    ubicacion: Optional[str] = Field(None, max_length=255)
    instructor: Optional[str] = Field(None, max_length=255)
    cupo_max: Optional[int] = Field(None, ge=1)
    notas: Optional[str] = None


class CursoSesionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    ubicacion: Optional[str] = Field(None, max_length=255)
    instructor: Optional[str] = Field(None, max_length=255)
    cupo_max: Optional[int] = Field(None, ge=1)
    notas: Optional[str] = None
    estado: Optional[EstadoSesionLiteral] = None


class CursoSesionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    curso_id: int
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    ubicacion: Optional[str] = None
    instructor: Optional[str] = None
    cupo_max: Optional[int] = None
    notas: Optional[str] = None
    estado: str
    inscritos_count: int = 0
    created_at: datetime
    updated_at: datetime


class CursoSesionListResponse(BaseModel):
    items: list[CursoSesionResponse]
    total: int


# ── OPL ──────────────────────────────────────────────────────────────────────


class OPLCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    codigo: str = Field(..., min_length=1, max_length=50)
    titulo: str = Field(..., min_length=2, max_length=255)
    proceso: Optional[str] = None
    maquina: Optional[str] = None
    aprobador_id: Optional[int] = None


class OPLUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    titulo: Optional[str] = Field(None, min_length=2, max_length=255)
    proceso: Optional[str] = None
    maquina: Optional[str] = None
    aprobador_id: Optional[int] = None
    estado_aprobacion: Optional[Literal["borrador", "revision", "aprobada"]] = None


class OPLResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    codigo: str
    titulo: str
    proceso: Optional[str] = None
    maquina: Optional[str] = None
    aprobador_id: Optional[int] = None
    estado_aprobacion: str
    created_at: datetime


# ── OPLVersion ───────────────────────────────────────────────────────────────


class OPLVersionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    opl_id: int
    version_num: int = Field(..., ge=1)
    archivo_url: str = Field(..., min_length=1, max_length=500)
    cambios_descripcion: Optional[str] = None
    creado_por_id: Optional[int] = None


class OPLVersionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    opl_id: int
    version_num: int
    archivo_url: str
    cambios_descripcion: Optional[str] = None
    fecha: datetime
    creado_por_id: Optional[int] = None


# ── EvidenciaCapacitacion ────────────────────────────────────────────────────


class EvidenciaCapacitacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    tipo: Literal["foto", "documento", "video", "firma"]
    archivo_url: str = Field(..., min_length=1, max_length=500)
    capacitacion_id: Optional[int] = None
    empleado_id: int
    notas: Optional[str] = None


class EvidenciaCapacitacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    estado: Optional[Literal["pendiente", "validada", "devuelta"]] = None
    notas: Optional[str] = None


class EvidenciaCapacitacionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    archivo_url: str
    capacitacion_id: Optional[int] = None
    empleado_id: int
    estado: str
    fecha_subida: datetime
    notas: Optional[str] = None


# ── EvidenciaFirma ───────────────────────────────────────────────────────────


class EvidenciaFirmaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    evidencia_id: int
    firmante_id: int
    rol_firma: str = Field(..., min_length=1, max_length=100)


class EvidenciaFirmaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    estado: Optional[Literal["pendiente", "firmada", "rechazada"]] = None
    comentario: Optional[str] = None


class EvidenciaFirmaResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    evidencia_id: int
    firmante_id: int
    rol_firma: str
    estado: str
    fecha_firma: Optional[datetime] = None
    comentario: Optional[str] = None


# ── EncuestaPostCurso ────────────────────────────────────────────────────────


class EncuestaPostCursoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    capacitacion_id: int
    empleado_id: int
    score_general: int = Field(..., ge=1, le=5)
    score_instructor: int = Field(..., ge=1, le=5)
    score_contenido: int = Field(..., ge=1, le=5)
    score_aplicabilidad: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = None


class EncuestaPostCursoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    capacitacion_id: int
    empleado_id: int
    score_general: int
    score_instructor: int
    score_contenido: int
    score_aplicabilidad: int
    comentario: Optional[str] = None
    fecha: datetime


# ── SugerenciaCapacitacion ───────────────────────────────────────────────────


class SugerenciaCapacitacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    titulo: str = Field(..., min_length=2, max_length=255)
    justificacion: Optional[str] = None
    brecha_pct: Optional[float] = Field(None, ge=0, le=100)
    adopcion_sector_pct: Optional[float] = Field(None, ge=0, le=100)
    capacidades_afectadas: Optional[list] = None
    areas_afectadas: Optional[list] = None
    personas_alcanzables: Optional[int] = Field(None, ge=0)
    duracion_sugerida: Optional[str] = None
    inversion_estimada: Optional[float] = Field(None, ge=0)
    proveedor_sugerido: Optional[str] = None
    prioridad: int = Field(default=3, ge=1, le=5)


class SugerenciaCapacitacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    titulo: Optional[str] = Field(None, min_length=2, max_length=255)
    justificacion: Optional[str] = None
    prioridad: Optional[int] = Field(None, ge=1, le=5)
    estado: Optional[Literal["activa", "aprobada", "pospuesta", "descartada"]] = None


class SugerenciaCapacitacionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    titulo: str
    justificacion: Optional[str] = None
    brecha_pct: Optional[float] = None
    adopcion_sector_pct: Optional[float] = None
    capacidades_afectadas: Optional[list] = None
    areas_afectadas: Optional[list] = None
    personas_alcanzables: Optional[int] = None
    duracion_sugerida: Optional[str] = None
    inversion_estimada: Optional[float] = None
    proveedor_sugerido: Optional[str] = None
    prioridad: int
    estado: str
    created_at: datetime
    updated_at: datetime


# ── PlanDesarrollo ───────────────────────────────────────────────────────────


class PlanDesarrolloCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    empleado_id: int
    titulo: str = Field(..., min_length=2, max_length=255)
    fecha_inicio: Optional[datetime] = None
    fecha_fin_estimada: Optional[datetime] = None


class PlanDesarrolloUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    titulo: Optional[str] = Field(None, min_length=2, max_length=255)
    fecha_inicio: Optional[datetime] = None
    fecha_fin_estimada: Optional[datetime] = None
    estado: Optional[Literal["activo", "completado", "cancelado"]] = None


class PlanDesarrolloResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    empleado_id: int
    titulo: str
    fecha_inicio: Optional[datetime] = None
    fecha_fin_estimada: Optional[datetime] = None
    estado: str
    created_at: datetime


# ── PlanEtapa ────────────────────────────────────────────────────────────────


class PlanEtapaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    plan_id: int
    orden: int = Field(..., ge=1)
    titulo: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo: Literal["curso", "opl", "evaluacion", "proyecto"]
    recurso_id: Optional[int] = None


class PlanEtapaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    orden: Optional[int] = Field(None, ge=1)
    titulo: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    estado: Optional[Literal["pendiente", "en_curso", "completada"]] = None
    fecha_inicio: Optional[datetime] = None
    fecha_completado: Optional[datetime] = None


class PlanEtapaResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    plan_id: int
    orden: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    recurso_id: Optional[int] = None
    estado: str
    fecha_inicio: Optional[datetime] = None
    fecha_completado: Optional[datetime] = None
