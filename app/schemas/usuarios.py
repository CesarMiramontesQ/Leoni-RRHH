# app/schemas/usuarios.py
"""
Schemas Pydantic v2 para el dominio usuarios/empleados.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.contratos import ContratoEmpleadoResumen
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
    no_empleado: int
    nombre: str
    email: Optional[str] = None
    rol_id: Optional[int] = None
    rol: Optional[RolBrief] = None
    estado: Optional[EstadoEmpleadoResponse] = None
    area: Optional[AreaResponse] = None
    subarea: Optional[SubareaResponse] = None
    puesto: Optional[PuestoResponse] = None
    categoria: Optional[CategoriaResponse] = None
    clasificacion: Optional[ClasificacionEmpleadoResponse] = None
    lider_id: Optional[int] = None
    centrocosto_id: Optional[int] = None
    foto: Optional[str] = None
    registro: Optional[str] = None
    created_at: Optional[datetime] = None


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
    """Filas de `turnos_empleados` (nombre de comedor + turno). Solo se envía cuando el solicitante es RH."""

    comedor: Optional[str] = None
    turno: Optional[str] = None


class UsuarioVista360Response(BaseModel):
    model_config = {"from_attributes": True}
    usuario: UsuarioResponse
    solicitudes_recientes: list[SolicitudBrief]
    incidencias_activas: list[IncidenciaBrief]
    actas_firmadas: list[ActaBrief]
    turno_empleado: Optional[Vista360TurnoEmpleado] = None
    # Fecha de ingreso real desde SQL Server datos-analisis (CB_FEC_ING de dbo.COLABORA);
    # None si la BD externa no está disponible (el frontend cae a `registro`).
    fecha_ingreso: Optional[date] = None
    # Contrato actual (misma caché). None si el empleado no está sincronizado.
    contrato: Optional[ContratoEmpleadoResumen] = None


class MetricasUsuarioResponse(BaseModel):
    solicitudes_por_estado: dict[str, int]
    incidencias_por_tipo: dict[str, int]
    dias_antiguedad: int
    total_actas: int
