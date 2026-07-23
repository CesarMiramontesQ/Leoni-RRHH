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

InstructorTipoLiteral = Literal["interno", "externo"]


class CursoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=300)
    duracion_horas: Optional[float] = Field(None, gt=0)
    cupo_max: Optional[int] = Field(None, ge=1)
    categoria_id: Optional[int] = None
    tipo_id: Optional[int] = None
    clasificacion_id: Optional[int] = None
    instructor_tipo: Optional[InstructorTipoLiteral] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    modalidad: Optional[str] = Field(None, max_length=50)
    sesiones_anio: Optional[int] = Field(None, ge=1)
    obligatorio: bool = False
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None


class CursoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=300)
    duracion_horas: Optional[float] = Field(None, gt=0)
    cupo_max: Optional[int] = Field(None, ge=1)
    categoria_id: Optional[int] = None
    tipo_id: Optional[int] = None
    clasificacion_id: Optional[int] = None
    instructor_tipo: Optional[InstructorTipoLiteral] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    modalidad: Optional[str] = Field(None, max_length=50)
    sesiones_anio: Optional[int] = Field(None, ge=1)
    obligatorio: Optional[bool] = None
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None
    activo: Optional[bool] = None


class CursoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    duracion_horas: Optional[float] = None
    cupo_max: Optional[int] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    tipo_id: Optional[int] = None
    tipo_nombre: Optional[str] = None
    clasificacion_id: Optional[int] = None
    clasificacion_nombre: Optional[str] = None
    instructor_tipo: Optional[str] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    instructor_nombre: Optional[str] = None
    modalidad: Optional[str] = None
    sesiones_anio: Optional[int] = None
    obligatorio: bool
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None
    centro_costos: Optional[int] = None
    activo: bool
    calificacion_promedio: Optional[float] = None
    total_evaluaciones: int = 0
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
    tipo: Optional[str] = Field(None, max_length=20)
    ubicacion: Optional[str] = Field(None, max_length=255)
    instructor_tipo: Optional[InstructorTipoLiteral] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    costo: Optional[float] = Field(None, ge=0)
    notas: Optional[str] = None


class CursoSesionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    tipo: Optional[str] = Field(None, max_length=20)
    ubicacion: Optional[str] = Field(None, max_length=255)
    instructor_tipo: Optional[InstructorTipoLiteral] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    costo: Optional[float] = Field(None, ge=0)
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
    tipo: Optional[str] = None
    ubicacion: Optional[str] = None
    instructor_tipo: Optional[str] = None
    instructor_empleado_id: Optional[int] = None
    instructor_externo_id: Optional[int] = None
    instructor_nombre: Optional[str] = None
    proveedor_id: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    costo: Optional[float] = None
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
    # `estado` es derivado de las firmas: el service lo descarta al actualizar.
    estado: Optional[Literal["pendiente", "validada", "devuelta"]] = None
    archivo_url: Optional[str] = Field(None, min_length=1, max_length=500)
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


class EvidenciaFirmaItem(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    firmante_id: int
    firmante_nombre: Optional[str] = None
    rol_firma: str
    estado: str
    fecha_firma: Optional[datetime] = None
    comentario: Optional[str] = None


class EvidenciaConFirmasResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    archivo_url: str
    capacitacion_id: Optional[int] = None
    capacitacion_nombre: Optional[str] = None
    empleado_id: int
    empleado_nombre: Optional[str] = None
    estado: str
    fecha_subida: datetime
    notas: Optional[str] = None
    firmas: list[EvidenciaFirmaItem] = Field(default_factory=list)
    firmas_total: int = 0
    firmas_firmadas: int = 0


class FirmanteAsignar(BaseModel):
    model_config = {"str_strip_whitespace": True}
    firmante_id: int
    rol_firma: str = Field(..., min_length=1, max_length=100)


class EvidenciaCrearRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    tipo: Literal["foto", "documento", "video", "firma"]
    archivo_url: str = Field(..., min_length=1, max_length=500)
    capacitacion_id: Optional[int] = None
    empleado_id: int
    notas: Optional[str] = None
    firmantes: list[FirmanteAsignar] = Field(default_factory=list)


class FirmarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    estado: Literal["firmada", "rechazada"]
    comentario: Optional[str] = None


# ── EncuestaPostCurso ────────────────────────────────────────────────────────
# Los schemas del flujo de encuestas post curso viven en
# app/schemas/level_up_encuestas.py (habilitación por sesión + respuestas).


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
    curso_id: Optional[int] = None
    prioridad: int = Field(default=3, ge=1, le=5)


class SugerenciaCapacitacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    titulo: Optional[str] = Field(None, min_length=2, max_length=255)
    justificacion: Optional[str] = None
    curso_id: Optional[int] = None
    prioridad: Optional[int] = Field(None, ge=1, le=5)
    estado: Optional[Literal["activa", "aprobada", "pospuesta", "descartada"]] = None
    brecha_pct: Optional[float] = Field(None, ge=0, le=100)
    adopcion_sector_pct: Optional[float] = Field(None, ge=0, le=100)
    capacidades_afectadas: Optional[list] = None
    areas_afectadas: Optional[list] = None
    personas_alcanzables: Optional[int] = Field(None, ge=0)
    duracion_sugerida: Optional[str] = None
    inversion_estimada: Optional[float] = Field(None, ge=0)
    proveedor_sugerido: Optional[str] = None


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
    curso_id: Optional[int] = None
    curso_nombre: Optional[str] = None
    prioridad: int
    estado: str
    created_at: datetime
    updated_at: datetime


class GenerarDesdeBrechasRequest(BaseModel):
    area_id: int
    umbral_brecha: float = Field(default=0, ge=0, le=100)


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
