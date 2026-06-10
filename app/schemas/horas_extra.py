"""Schemas para la vista de Horas Extra (empleados reales + campos simulados)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

HorasExtraEstadoAprobacion = Literal["pendiente", "aprobado", "rechazado"]
HorasExtraTabFiltro = Literal["todos", "pendientes", "aprobados", "rechazados"]


class HorasExtraLiderResponse(BaseModel):
    empleado_id: int
    nombre: str


class HorasExtraEmpleadoResponse(BaseModel):
    id: int
    empleado_id: int
    no_empleado: str
    nombre: str
    puesto_nombre: Optional[str] = None
    centrocosto_id: int
    lider: Optional[HorasExtraLiderResponse] = None


class HorasExtraSimuladoResponse(BaseModel):
    semana: int
    horas_dobles: float
    horas_descanso_trabajado: float
    total_horas_extra: float
    dif_caseta: float
    estado_aprobacion: HorasExtraEstadoAprobacion


class HorasExtraFilaResponse(BaseModel):
    empleado: HorasExtraEmpleadoResponse
    simulado: HorasExtraSimuladoResponse


class HorasExtraResumenResponse(BaseModel):
    total_horas_extra: float
    colaboradores_con_registro: int
    empleados_con_horas_extra: int
    empleados_activos_planta: int
    solicitudes_pendientes: int
    solicitudes_aprobadas: int
    solicitudes_rechazadas: int
    solicitudes_con_dif_caseta: int
    porcentaje_aprobacion: float


class HorasExtraListResponse(BaseModel):
    semana_actual: int
    resumen: HorasExtraResumenResponse
    tabs: dict[str, int] = Field(
        description="Conteos por pestaña: todos, pendientes, aprobados, rechazados"
    )
    items: list[HorasExtraFilaResponse]
    total: int
    page: int
    page_size: int
