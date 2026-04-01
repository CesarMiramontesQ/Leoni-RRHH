# app/schemas/usuarios.py
"""
Schemas Pydantic v2 para el dominio usuarios/empleados.
Separados del schema de empleados para no contaminar el modulo ya existente.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UsuarioCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    num_empleado: str
    nombre: str
    apellido: str
    email: EmailStr
    password: str
    departamento: Optional[str] = None
    puesto: Optional[str] = None
    rol_id: int
    supervisor_id: Optional[int] = None
    fecha_ingreso: Optional[date] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contrasena debe tener al menos 8 caracteres")
        return v


class UsuarioUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = None
    apellido: Optional[str] = None
    departamento: Optional[str] = None
    puesto: Optional[str] = None
    rol_id: Optional[int] = None
    supervisor_id: Optional[int] = None
    fecha_ingreso: Optional[date] = None


class RolBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str


class UsuarioResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    num_empleado: str
    nombre: str
    apellido: str
    email: str
    departamento: Optional[str] = None
    puesto: Optional[str] = None
    rol_id: int
    rol: Optional[RolBrief] = None
    supervisor_id: Optional[int] = None
    activo: bool
    fecha_ingreso: Optional[date] = None
    created_at: datetime


class UsuarioListItem(UsuarioResponse):
    """Fila de listado RH con nombre del supervisor resuelto."""

    supervisor_nombre: Optional[str] = None


class UsuarioPageResponse(BaseModel):
    items: list[UsuarioListItem]
    total: int
    page: int
    page_size: int


class UsuarioResumenResponse(BaseModel):
    total_plantilla: int
    activos: int
    capacitacion_pendiente: int
    practicantes: int
    porcentaje_operatividad: float


class CatalogoFiltrosResponse(BaseModel):
    departamentos: list[str]
    puestos: list[str]


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
