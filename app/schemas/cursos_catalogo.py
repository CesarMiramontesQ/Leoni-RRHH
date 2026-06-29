from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Schemas genéricos para catálogos simples (Categoría, Tipo, Clasificación) ──


class CursoCatSimpleCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=150)
    descripcion: Optional[str] = None


class CursoCatSimpleUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class CursoCatSimpleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    activo: bool
    created_at: datetime


class CursoCatSimpleListResponse(BaseModel):
    items: list[CursoCatSimpleResponse]
    total: int
    page: int
    page_size: int


# ── Instructor Externo ─────────────────────────────────────────────────────────


class InstructorExternoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    especialidad: Optional[str] = Field(None, max_length=255)
    empresa: Optional[str] = Field(None, max_length=255)
    contacto: Optional[str] = Field(None, max_length=255)


class InstructorExternoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    especialidad: Optional[str] = Field(None, max_length=255)
    empresa: Optional[str] = Field(None, max_length=255)
    contacto: Optional[str] = Field(None, max_length=255)
    activo: Optional[bool] = None


class InstructorExternoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    especialidad: Optional[str] = None
    empresa: Optional[str] = None
    contacto: Optional[str] = None
    activo: bool
    created_at: datetime


class InstructorExternoListResponse(BaseModel):
    items: list[InstructorExternoResponse]
    total: int
    page: int
    page_size: int


# ── Instructor Interno ─────────────────────────────────────────────────────────


class InstructorInternoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int = Field(..., gt=0)
    especialidad: Optional[str] = Field(None, max_length=255)


class InstructorInternoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    especialidad: Optional[str] = Field(None, max_length=255)
    activo: Optional[bool] = None


class InstructorInternoResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    no_empleado: Optional[str] = None
    especialidad: Optional[str] = None
    activo: bool
    created_at: datetime


class InstructorInternoListResponse(BaseModel):
    items: list[InstructorInternoResponse]
    total: int
    page: int
    page_size: int


# ── Proveedor ──────────────────────────────────────────────────────────────────


class ProveedorCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    direccion: Optional[str] = None


class ProveedorUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    direccion: Optional[str] = None
    activo: Optional[bool] = None


class ProveedorResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool
    created_at: datetime


class ProveedorListResponse(BaseModel):
    items: list[ProveedorResponse]
    total: int
    page: int
    page_size: int
