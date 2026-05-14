# app/schemas/capacitaciones.py
"""
Schemas Pydantic v2 para Capacitaciones — Modulo Talento Fase 3.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Capacitacion ─────────────────────────────────────────────────────────────


class CapacitacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    duracion_horas: int = Field(..., ge=1)
    modalidad: Literal["presencial", "online", "mixta"]
    instructor: Optional[str] = Field(None, max_length=255)
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    cupo_maximo: Optional[int] = Field(None, ge=1)
    area_id: Optional[int] = None
    competencias_asociadas: Optional[list[dict]] = None


class CapacitacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    duracion_horas: Optional[int] = Field(None, ge=1)
    modalidad: Optional[Literal["presencial", "online", "mixta"]] = None
    instructor: Optional[str] = Field(None, max_length=255)
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    cupo_maximo: Optional[int] = Field(None, ge=1)
    area_id: Optional[int] = None
    competencias_asociadas: Optional[list[dict]] = None
    estado: Optional[Literal["activa", "cancelada", "finalizada"]] = None


class CapacitacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    duracion_horas: int
    modalidad: str
    instructor: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    cupo_maximo: Optional[int] = None
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    competencias_asociadas: Optional[list[dict]] = None
    estado: str
    inscritos_count: int = 0
    created_at: datetime
    updated_at: datetime


class CapacitacionListResponse(BaseModel):
    items: list[CapacitacionResponse]
    total: int
    page: int
    page_size: int


# ── Inscripcion ──────────────────────────────────────────────────────────────


class InscripcionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    capacitacion_id: int
    empleado_id: int


class InscripcionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    estado: Optional[Literal["inscrito", "en_curso", "completado", "cancelado"]] = None
    calificacion: Optional[int] = Field(None, ge=0, le=100)


class InscripcionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    capacitacion_id: int
    capacitacion_nombre: Optional[str] = None
    empleado_id: int
    empleado_nombre: Optional[str] = None
    estado: str
    calificacion: Optional[int] = None
    fecha_inscripcion: datetime
    fecha_completado: Optional[datetime] = None


class InscripcionListResponse(BaseModel):
    items: list[InscripcionResponse]
    total: int
    page: int
    page_size: int
