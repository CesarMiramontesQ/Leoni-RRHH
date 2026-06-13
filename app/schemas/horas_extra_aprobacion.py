"""Schemas para el ciclo de aprobación de horas extra (gerente regional / director)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_serializer, field_validator

# Tipos de firma reales del modelo `horas_extra_aprobaciones`.
HorasExtraTipoFirma = Literal["gerente_area", "gerente_regional", "director_planta"]
HorasExtraFirmaEstado = Literal["pendiente", "aprobado", "rechazado"]

# Estado consolidado que ve RH (calculado a partir de las firmas).
HorasExtraEstadoConsolidado = Literal[
    "pendiente", "aprobado_parcial", "aprobado", "rechazado"
]

TIPO_FIRMA_LABELS: dict[str, str] = {
    "gerente_area": "Gerente de área",
    "gerente_regional": "Gerente regional",
    "director_planta": "Director",
}

ESTADO_CONSOLIDADO_LABELS: dict[str, str] = {
    "pendiente": "Pendiente de aprobación",
    "aprobado_parcial": "Aprobación parcial",
    "aprobado": "Aprobado",
    "rechazado": "Rechazado",
}


class HorasExtraAprobarRequest(BaseModel):
    comentario: Optional[str] = Field(default=None, max_length=500)

    @field_validator("comentario")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None


class HorasExtraRechazarRequest(BaseModel):
    comentario: str = Field(min_length=1, max_length=500)

    @field_validator("comentario")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El comentario es obligatorio al rechazar.")
        return v


class HorasExtraFirmaResponse(BaseModel):
    tipo_firma: HorasExtraTipoFirma
    tipo_firma_label: str
    estado: HorasExtraFirmaEstado
    aprobador_id: Optional[int] = None
    aprobador_nombre: Optional[str] = None
    rol_aprobador_nombre: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    comentario: Optional[str] = None


class HorasExtraPendienteItem(BaseModel):
    solicitud_id: int
    semana: int
    semana_inicio: date
    fecha_solicitud: date
    tipo: str
    area_descripcion: Optional[str] = None
    subarea_descripcion: Optional[str] = None
    centrocosto_id: Optional[int] = None
    centrocosto_descripcion: Optional[str] = None
    motivo: Optional[str] = None
    total_horas: float
    total_empleados: int
    empleado_resumen: Optional[str] = None
    puesto_descripcion: Optional[str] = None
    registrado_por_nombre: Optional[str] = None
    mi_tipo_firma: HorasExtraTipoFirma
    mi_tipo_firma_label: str
    estado_consolidado: HorasExtraEstadoConsolidado
    aprobado_parcial: bool
    created_at: datetime


class HorasExtraPendientesListResponse(BaseModel):
    items: list[HorasExtraPendienteItem]
    total: int
    page: int
    page_size: int


class HorasExtraEstadoConsolidadoResponse(BaseModel):
    solicitud_id: int
    estado: HorasExtraEstadoConsolidado
    estado_label: str
    aprobado_parcial: bool
    listo_para_nomina: bool
    firmas: list[HorasExtraFirmaResponse]
    faltantes: list[str]
    rechazado_por: Optional[str] = None
    comentario_rechazo: Optional[str] = None


class HorasExtraHistorialResponse(BaseModel):
    solicitud_id: int
    estado: HorasExtraEstadoConsolidado
    estado_label: str
    firmas: list[HorasExtraFirmaResponse]
    eventos: list["HorasExtraHistorialEvento"] = []


class HorasExtraHistorialEvento(BaseModel):
    usuario_nombre: str
    rol: Optional[str] = None
    accion: str
    comentario: Optional[str] = None
    fecha_hora: datetime


class HorasExtraAprobadorAsignadoItem(BaseModel):
    nombre: str
    email: Optional[str] = None


class HorasExtraDetalleEmpleadoItem(BaseModel):
    empleado_id: int
    no_empleado: str
    nombre: str
    puesto_descripcion: Optional[str] = None
    departamento_descripcion: Optional[str] = None
    centrocosto_descripcion: Optional[str] = None
    subarea_descripcion: Optional[str] = None
    jefe_nombre: Optional[str] = None
    total_horas: float
    lunes: float
    martes: float
    miercoles: float
    jueves: float
    viernes: float
    sabado: float
    domingo: float


class HorasExtraAprobacionDetalleResponse(BaseModel):
    solicitud_id: int
    fecha_solicitud: date
    semana: int
    semana_inicio: date
    tipo: str
    motivo: Optional[str] = None
    comentarios: Optional[str] = None
    total_horas: float
    total_empleados: int
    created_at: datetime
    registrado_por_nombre: Optional[str] = None
    area_descripcion: Optional[str] = None
    subarea_descripcion: Optional[str] = None
    centrocosto_descripcion: Optional[str] = None
    estado_consolidado: HorasExtraEstadoConsolidado
    estado_label: str
    empleados: list[HorasExtraDetalleEmpleadoItem]
    gerentes_regionales: list[HorasExtraAprobadorAsignadoItem]
    director_asignado: Optional[HorasExtraAprobadorAsignadoItem] = None
    firmas: list[HorasExtraFirmaResponse]
    historial: list[HorasExtraHistorialEvento]
    mi_tipo_firma: Optional[HorasExtraTipoFirma] = None
    mi_tipo_firma_label: Optional[str] = None
    puede_aprobar: bool = False
    puede_rechazar: bool = False
