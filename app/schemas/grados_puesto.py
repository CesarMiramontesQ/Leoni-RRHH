# app/schemas/grados_puesto.py
"""Schemas Pydantic para el catalogo de grados de puesto."""

from datetime import datetime

from pydantic import BaseModel, Field


class GradoPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class GradoPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class GradoPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
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
