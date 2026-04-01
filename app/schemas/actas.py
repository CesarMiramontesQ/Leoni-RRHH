# app/schemas/actas.py
"""
Schemas Pydantic v2 para el dominio actas administrativas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ActaGenerarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    incidencia_id: Optional[int] = None


class ActaEditarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    contenido_final: str


class ActaFirmarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    comentario: Optional[str] = None


class ActaAprobacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    acta_id: int
    firmante_id: int
    rol_firmante: str
    firma_timestamp: Optional[datetime] = None
    comentario: Optional[str] = None


class ActaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    incidencia_id: Optional[int] = None
    contenido_ia: Optional[str] = None
    contenido_final: Optional[str] = None
    estado: str
    generado_por: int
    created_at: datetime
    aprobaciones: list[ActaAprobacionResponse] = []
    firmantes_pendientes: list[str] = []
