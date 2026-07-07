# app/schemas/juntas.py
"""
Schemas Pydantic v2 del modulo de Juntas.

Convenciones (como el resto del proyecto):
  - `model_config = {"from_attributes": True}` en las respuestas.
  - Listas anidadas de asistentes en el detalle.
  - `no_empleado` se expone como int (tipo real en Bono); el frontend lo
    normaliza a string para mostrar.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

JuntaEstado = Literal["registrada", "cancelada", "cerrada"]


# ── Entrada ───────────────────────────────────────────────────────────────────
class JuntaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=3, max_length=255)
    motivo: Optional[str] = Field(None, max_length=2000)
    categoria: Optional[str] = Field(None, max_length=120)
    asistente_ids: list[int] = Field(default_factory=list)


# ── Asistente ─────────────────────────────────────────────────────────────────
class AsistenteResponse(BaseModel):
    model_config = {"from_attributes": True}

    empleado_id: int
    no_empleado: Optional[int] = None
    nombre: Optional[str] = None
    puesto: Optional[str] = None
    area: Optional[str] = None


# ── Respuesta ─────────────────────────────────────────────────────────────────
class JuntaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    motivo: Optional[str] = None
    categoria: Optional[str] = None
    estado: JuntaEstado
    asistentes_count: int = 0
    created_at: datetime
    updated_at: datetime


class JuntaDetalleResponse(JuntaResponse):
    asistentes: list[AsistenteResponse] = Field(default_factory=list)


class JuntaListResponse(BaseModel):
    items: list[JuntaResponse]
    total: int
    page: int
    page_size: int
