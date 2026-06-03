# app/schemas/usuarios.py
"""
Schemas Pydantic v2 para el dominio usuarios/empleados.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.empleados import (
    AreaResponse,
    CategoriaResponse,
    ClasificacionEmpleadoResponse,
    EstadoEmpleadoResponse,
    PuestoResponse,
    SubareaResponse,
)


class UsuarioAsignacionUpdate(BaseModel):
    """Solo RH puede usar este schema. Permite cambiar lider_id, rol_id y comedor en turnos."""

    model_config = {"str_strip_whitespace": True}
    lider_id: Optional[int] = None
    rol_id: Optional[int] = None
    comedor_id: Optional[int] = None


class RolBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str


class UsuarioResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    no_empleado: str
    nombre: str
    email: Optional[str] = None
    rol_id: int
    rol: Optional[RolBrief] = None
    estado: Optional[EstadoEmpleadoResponse] = None
    area: Optional[AreaResponse] = None
    subarea: Optional[SubareaResponse] = None
    puesto: Optional[PuestoResponse] = None
    categoria: Optional[CategoriaResponse] = None
    clasificacion: Optional[ClasificacionEmpleadoResponse] = None
    lider_id: Optional[int] = None
    foto: Optional[str] = None
    registro: Optional[date] = None
    created_at: datetime


class UsuarioListItem(UsuarioResponse):
    """Fila de listado RH con nombre del líder resuelto."""

    lider_nombre: Optional[str] = None


class UsuarioPageResponse(BaseModel):
    items: list[UsuarioListItem]
    total: int
    page: int
    page_size: int


class EmpleadoDistribucionItem(BaseModel):
    """Conteo agrupado para gráficas del dashboard RH (resumen de plantilla)."""

    label: str
    total: int


class EmpleadosPorClasificacionAreaSerie(BaseModel):
    """Activos por área para una clasificación (catálogo `clasificacion_empleado`)."""

    tipo: str
    clasificacion_id: int | None = None
    clasificacion_descripcion: str
    por_area: list[EmpleadoDistribucionItem] = []


class UsuarioResumenResponse(BaseModel):
    total_plantilla: int
    activos: int
    inactivos: int
    sin_lider_asignado: int
    sin_email_administrativo: int = 0
    practicantes: int
    porcentaje_operatividad: float
    colaboradores_total: int
    contratos_por_vencer: int
    empleados_por_clasificacion_y_area: list[EmpleadosPorClasificacionAreaSerie] = []


class CatalogoFiltrosResponse(BaseModel):
    areas: list[AreaResponse]
    puestos: list[PuestoResponse]


class SolicitudBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    estado: str
    fecha_inicio: date
    fecha_fin: date
    created_at: datetime


class IncidenciaBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    estatus_id: Optional[int] = None
    created_at: datetime


class ActaBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    estado: str
    created_at: datetime


class Vista360TurnoEmpleado(BaseModel):
    """Filas de `turnos_empleados` (comedor numérico + turno). Solo se envía cuando el solicitante es RH."""

    comedor: Optional[str] = None
    turno: Optional[str] = None


class UsuarioVista360Response(BaseModel):
    model_config = {"from_attributes": True}
    usuario: UsuarioResponse
    solicitudes_recientes: list[SolicitudBrief]
    incidencias_activas: list[IncidenciaBrief]
    actas_firmadas: list[ActaBrief]
    saldo_vacaciones: int
    turno_empleado: Optional[Vista360TurnoEmpleado] = None


class MetricasUsuarioResponse(BaseModel):
    solicitudes_por_estado: dict[str, int]
    incidencias_por_tipo: dict[str, int]
    dias_antiguedad: int
    total_actas: int
