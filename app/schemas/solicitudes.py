# app/schemas/solicitudes.py
"""
Schemas Pydantic v2 para el dominio solicitudes.

Convencion:
  - {Entidad}Create  — entrada para POST
  - {Entidad}Update  — entrada para PATCH (todos Optional)
  - {Entidad}Response — salida; siempre model_config = {"from_attributes": True}
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


SOLICITUD_TIPOS_VALIDOS = {"vacaciones", "home_office"}
SOLICITUD_ESTADOS_VALIDOS = {"pending", "approved", "rejected", "cancelled", "overridden"}
APROBACION_ACCIONES_VALIDAS = {"approve", "reject", "override"}


class SolicitudCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: str
    fecha_inicio: date
    fecha_fin: date
    comentarios: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in SOLICITUD_TIPOS_VALIDOS:
            raise ValueError(f"tipo debe ser uno de: {sorted(SOLICITUD_TIPOS_VALIDOS)}")
        return v

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas(cls, v: date, info) -> date:
        fecha_inicio = info.data.get("fecha_inicio")
        if fecha_inicio and v < fecha_inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return v


class SolicitudUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    estado: Optional[str] = None
    comentarios: Optional[str] = None
    nivel_actual: Optional[int] = None

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SOLICITUD_ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de: {sorted(SOLICITUD_ESTADOS_VALIDOS)}")
        return v


class SolicitudResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    nivel_actual: int
    comentarios: Optional[str]
    created_at: datetime


class SolicitudAprobacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    accion: str
    nivel: int
    comentario: Optional[str] = None

    @field_validator("accion")
    @classmethod
    def validar_accion(cls, v: str) -> str:
        if v not in APROBACION_ACCIONES_VALIDAS:
            raise ValueError(f"accion debe ser una de: {sorted(APROBACION_ACCIONES_VALIDAS)}")
        return v


class SolicitudAprobacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    solicitud_id: int
    aprobador_id: int
    accion: str
    nivel: int
    comentario: Optional[str]
    timestamp: datetime
