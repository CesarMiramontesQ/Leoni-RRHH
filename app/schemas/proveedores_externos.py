# app/schemas/proveedores_externos.py
"""
Schemas Pydantic v2 del modulo de Capacitacion de Personal Externo.

Convenciones (como el resto del proyecto):
  - `model_config = {"from_attributes": True}` en las respuestas.
  - `model_config = {"str_strip_whitespace": True}` en las entradas.
  - El estado de vencimiento (`estado`, `dias_restantes`) y los nombres
    denormalizados de la tabla de vencimientos se calculan en el service.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

EstadoVencimiento = Literal["vigente", "por_vencer", "vencido", "sin_vencimiento"]


# ── Proveedor ─────────────────────────────────────────────────────────────────
class ProveedorBase(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    rfc: Optional[str] = Field(None, max_length=20)
    contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    direccion: Optional[str] = Field(None, max_length=2000)


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    rfc: Optional[str] = Field(None, max_length=20)
    contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    direccion: Optional[str] = Field(None, max_length=2000)
    activo: Optional[bool] = None


class ProveedorResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    rfc: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool = True
    personas_count: int = 0
    created_at: datetime
    updated_at: datetime


# ── Persona ───────────────────────────────────────────────────────────────────
class PersonaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    identificacion: Optional[str] = Field(None, max_length=100)
    puesto: Optional[str] = Field(None, max_length=150)


class PersonaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    identificacion: Optional[str] = Field(None, max_length=100)
    puesto: Optional[str] = Field(None, max_length=150)
    activo: Optional[bool] = None


class PersonaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    proveedor_id: int
    nombre: str
    identificacion: Optional[str] = None
    puesto: Optional[str] = None
    activo: bool = True
    created_at: datetime
    updated_at: datetime


class ProveedorDetalleResponse(ProveedorResponse):
    personas: list[PersonaResponse] = Field(default_factory=list)


class ProveedorListResponse(BaseModel):
    items: list[ProveedorResponse]
    total: int
    page: int
    page_size: int


# ── Curso externo ─────────────────────────────────────────────────────────────
class CursoExternoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=2000)
    vigencia_meses: Optional[int] = Field(None, ge=1, le=600)


class CursoExternoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=2000)
    vigencia_meses: Optional[int] = Field(None, ge=1, le=600)
    activo: Optional[bool] = None


class CursoExternoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    vigencia_meses: Optional[int] = None
    activo: bool = True
    created_at: datetime
    updated_at: datetime


class CursoExternoListResponse(BaseModel):
    items: list[CursoExternoResponse]
    total: int
    page: int
    page_size: int


# ── Registro / Vencimiento ────────────────────────────────────────────────────
class RegistroCursoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    persona_id: int
    curso_externo_id: int
    fecha_realizado: date
    observaciones: Optional[str] = Field(None, max_length=2000)


class RegistroCursoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    fecha_realizado: Optional[date] = None
    observaciones: Optional[str] = Field(None, max_length=2000)


class RegistroCursoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    persona_id: int
    curso_externo_id: int
    fecha_realizado: date
    fecha_vencimiento: Optional[date] = None
    observaciones: Optional[str] = None
    # Derivados / denormalizados (calculados en el service para la tabla de vencimientos)
    estado: EstadoVencimiento = "sin_vencimiento"
    dias_restantes: Optional[int] = None
    proveedor_id: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    persona_nombre: Optional[str] = None
    curso_nombre: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VencimientoListResponse(BaseModel):
    items: list[RegistroCursoResponse]
    total: int
    page: int
    page_size: int
