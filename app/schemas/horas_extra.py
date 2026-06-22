"""Schemas para la vista RH de Horas Extra (solicitudes reales)."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.horas_extra_aprobacion import HorasExtraEstadoConsolidado

HorasExtraEstadoSolicitudVista = Literal[
    "borrador", "pendiente", "aprobado", "rechazado", "cancelado"
]
HorasExtraTabFiltro = Literal["todos", "pendientes", "aprobados", "rechazados"]


class HorasExtraLiderResponse(BaseModel):
    empleado_id: int
    nombre: str


class HorasExtraEmpleadoResponse(BaseModel):
    id: int
    empleado_id: int
    no_empleado: Optional[int] = None
    nombre: str
    puesto_nombre: Optional[str] = None
    centrocosto_id: Optional[int] = None
    lider: Optional[HorasExtraLiderResponse] = None


class HorasExtraSolicitudInfoResponse(BaseModel):
    """Datos reales de la solicitud asociados a la fila empleado-solicitud."""

    solicitud_id: int
    semana: int
    semana_inicio: date
    fecha_solicitud: date
    tipo: Literal["planeado", "espontaneo"]
    area_descripcion: Optional[str] = None
    centrocosto_id: int
    centrocosto_descripcion: Optional[str] = None
    motivo: Optional[str] = None
    estado: HorasExtraEstadoSolicitudVista
    estado_consolidado: HorasExtraEstadoConsolidado
    total_horas: float
    registrado_por_nombre: Optional[str] = None
    aprobador_nombre: Optional[str] = None
    fecha_aprobacion: Optional[date] = None


class HorasExtraFilaResponse(BaseModel):
    empleado: HorasExtraEmpleadoResponse
    solicitud: HorasExtraSolicitudInfoResponse


class HorasExtraResumenResponse(BaseModel):
    total_horas_extra: float
    colaboradores_con_registro: int
    empleados_con_horas_extra: int
    empleados_activos_planta: int
    solicitudes_total: int
    solicitudes_pendientes: int
    solicitudes_aprobadas: int
    solicitudes_rechazadas: int
    porcentaje_aprobacion: float


class HorasExtraCentroCostoOption(BaseModel):
    id: int
    label: str


class HorasExtraFilterOptionsResponse(BaseModel):
    centros_costo: list[HorasExtraCentroCostoOption]


class HorasExtraListResponse(BaseModel):
    semana_actual: int
    resumen: HorasExtraResumenResponse
    tabs: dict[str, int] = Field(
        description="Conteos por pestaña: todos, pendientes, aprobados, rechazados"
    )
    filter_options: HorasExtraFilterOptionsResponse
    items: list[HorasExtraFilaResponse]
    total: int
    page: int
    page_size: int
