# app/schemas/usuarios.py
"""
Schemas Pydantic v2 para el dominio usuarios/empleados.
"""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, model_validator

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

    @model_validator(mode="before")
    @classmethod
    def resolver_email_alterno(cls, value: Any) -> Any:
        if isinstance(value, dict):
            if not value.get("email"):
                email_rel = value.get("email_alterno")
                if isinstance(email_rel, dict) and email_rel.get("email"):
                    value["email"] = email_rel["email"]
            return value

        if getattr(value, "email", None):
            return value

        email_rel = getattr(value, "email_alterno", None)
        if email_rel and getattr(email_rel, "email", None):
            payload = {
                "id": value.id,
                "empleado_id": value.empleado_id,
                "no_empleado": value.no_empleado,
                "nombre": value.nombre,
                "email": email_rel.email,
                "rol_id": value.rol_id,
                "rol": value.rol,
                "estado": value.estado,
                "area": value.area,
                "subarea": value.subarea,
                "puesto": value.puesto,
                "categoria": value.categoria,
                "clasificacion": value.clasificacion,
                "lider_id": value.lider_id,
                "registro": value.registro,
                "created_at": value.created_at,
            }
            return payload
        return value


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
    sin_lider_asignado: int
    practicantes: int
    porcentaje_operatividad: float
    colaboradores_total: int
    contratos_por_vencer: int


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
