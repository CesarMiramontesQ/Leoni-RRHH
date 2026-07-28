# app/schemas/grados_puesto.py
"""
Schemas Pydantic del catalogo de Career Levels (Willis Towers Watson).

El recurso es `/api/v1/career-levels`. La tabla conserva el nombre
`levelup_grados_puesto`: cuatro tablas la referencian por FK y renombrarla es
parte de la limpieza del vocabulario legacy en espanol, no de este cambio.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class GradoPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    career_path_id: int = Field(..., gt=0)
    codigo: str = Field(..., min_length=1, max_length=10, description="Ej. P10, M3")
    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class GradoPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    career_path_id: int = Field(..., gt=0)
    codigo: str = Field(..., min_length=1, max_length=10)
    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class GradoPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    career_path_id: int
    career_path_codigo: str | None = None
    career_path_nombre: str | None = None
    codigo: str
    nombre: str
    orden: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class GradoPuestoListResponse(BaseModel):
    items: list[GradoPuestoResponse]
    total: int
    page: int
    page_size: int
