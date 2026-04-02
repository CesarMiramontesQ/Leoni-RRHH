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
    """Solo RH puede usar este schema. Permite cambiar únicamente lider_id y rol_id."""

    model_config = {"str_strip_whitespace": True}
    lider_id: Optional[int] = None
    rol_id: Optional[int] = None


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


class UsuarioResumenResponse(BaseModel):
    total_plantilla: int
    activos: int
    inactivos: int
    practicantes: int
    porcentaje_operatividad: float


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
    estado: str
    created_at: datetime


class ActaBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    estado: str
    created_at: datetime


class UsuarioVista360Response(BaseModel):
    model_config = {"from_attributes": True}
    usuario: UsuarioResponse
    solicitudes_recientes: list[SolicitudBrief]
    incidencias_activas: list[IncidenciaBrief]
    actas_firmadas: list[ActaBrief]
    saldo_vacaciones: int


class MetricasUsuarioResponse(BaseModel):
    solicitudes_por_estado: dict[str, int]
    incidencias_por_tipo: dict[str, int]
    dias_antiguedad: int
    total_actas: int
