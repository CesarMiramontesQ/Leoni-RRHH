"""Schemas Pydantic para Plan de Desarrollo Individual (PDI)."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, model_validator


class PDICreate(BaseModel):
    competencia_id: int
    accion: str
    tipo: str
    duracion_horas: Optional[int] = None
    fecha_inicio: date
    fecha_fin: date
    responsable: str
    prioridad: Literal["baja", "media", "alta"] = "media"
    recursos: Optional[str] = None

    @model_validator(mode="after")
    def check_fechas(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"from_attributes": True}


class PDIUpdate(BaseModel):
    accion: Optional[str] = None
    tipo: Optional[str] = None
    duracion_horas: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    responsable: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[Literal["baja", "media", "alta"]] = None
    recursos: Optional[str] = None

    @model_validator(mode="after")
    def check_fechas(self):
        if self.fecha_inicio and self.fecha_fin:
            if self.fecha_fin < self.fecha_inicio:
                raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"from_attributes": True}


class PDIResponse(BaseModel):
    id: int
    empleado_id: int
    competencia_id: int
    competencia_nombre: str
    accion: str
    tipo: str
    duracion_horas: Optional[int] = None
    fecha_inicio: date
    fecha_fin: date
    responsable: str
    estado: str
    prioridad: str = "media"
    recursos: Optional[str] = None
    creado_por: Optional[int] = None
    creado_por_nombre: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PDIListResponse(BaseModel):
    items: list[PDIResponse]
    total: int


class PDIGestionItem(BaseModel):
    id: int
    empleado_id: int
    empleado_nombre: str
    area_nombre: str | None = None
    puesto_nombre: str | None = None
    competencia_id: int
    competencia_nombre: str
    accion: str
    tipo: str
    duracion_horas: int | None = None
    fecha_inicio: date
    fecha_fin: date
    responsable: str
    estado: str
    prioridad: str = "media"
    recursos: str | None = None
    vencida: bool = False
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PDIGestionListResponse(BaseModel):
    items: list[PDIGestionItem]
    total: int
    page: int
    page_size: int


class PDIResumenResponse(BaseModel):
    total_acciones: int
    completadas: int
    en_proceso: int
    pendientes: int
    vencidas: int


class PDIEstadoPatch(BaseModel):
    estado: str


class PDIProgresoEmpleadoItem(BaseModel):
    empleado_id: int
    empleado_nombre: str
    area_nombre: str | None = None
    total: int
    completadas: int
    en_proceso: int
    pendientes: int
    vencidas: int
    progreso_pct: float


class PDIProgresoEquipoResponse(BaseModel):
    items: list[PDIProgresoEmpleadoItem]
    total: int


class EquipoResumenBrechaItem(BaseModel):
    competencia_id: int
    competencia_nombre: str
    gap: float


class EquipoResumenEmpleadoItem(BaseModel):
    empleado_id: int
    nombre: str
    no_empleado: int
    puesto_nombre: str | None = None
    area_nombre: str | None = None
    estatus_pdi: str
    brechas_criticas: list[EquipoResumenBrechaItem]
    ultima_actualizacion: str | None = None
    score_competencias: str
    evaluacion_general_prom: float
    pdi_total: int
    pdi_completadas: int
    progreso_pct: float


class EquipoResumenResponse(BaseModel):
    items: list[EquipoResumenEmpleadoItem]
    total: int


class HeatmapCompetencia(BaseModel):
    competencia_id: int
    competencia_nombre: str
    categoria: str


class HeatmapEmpleado(BaseModel):
    empleado_id: int
    nombre: str
    no_empleado: int


class HeatmapCell(BaseModel):
    nivel_requerido: int
    nivel_actual: int
    gap: float


class HeatmapResponse(BaseModel):
    competencias: list[HeatmapCompetencia]
    empleados: list[HeatmapEmpleado]
    matriz: dict[str, dict[str, HeatmapCell]]


class TimelineEvent(BaseModel):
    id: int
    empleado_id: int
    empleado_nombre: str
    competencia_nombre: str
    accion: str
    fecha_inicio: str
    fecha_fin: str
    estado: str
    vencida: bool
    dias_restantes: int | None = None


class TimelineResponse(BaseModel):
    eventos: list[TimelineEvent]
    total: int


class PDIKpisAvanzadosResponse(BaseModel):
    cumplimiento_plan_pct: float
    horas_training_promedio: float
    promedio_skill_gap: float
    inversion_horas_total: int


class PDIRecomendacionItem(BaseModel):
    accion: str
    tipo: str
    justificacion: str
    prioridad: str


class PDIRecomendacionesResponse(BaseModel):
    empleado_id: int
    recomendaciones: list[PDIRecomendacionItem]


class PDINotificarEquipoResponse(BaseModel):
    notificaciones_creadas: int
    empleados_notificados: int


class PDIFilterOption(BaseModel):
    id: str
    label: str


class PDIFilterOptionsResponse(BaseModel):
    puestos_perfil: list[PDIFilterOption] = []
