# app/schemas/grados_puesto.py
"""
Schemas Pydantic del catalogo de Global Levels (Willis Towers Watson).

La tabla se sigue llamando `levelup_grados_puesto` y el recurso `/grados-puesto`
por compatibilidad; el concepto de negocio es el Global Level (P1..Pn / M1..Mn).
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
