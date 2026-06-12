# app/schemas/niveles_puesto.py
"""Schemas Pydantic para el catalogo de niveles de puesto."""

from datetime import datetime

from pydantic import BaseModel, Field


class NivelPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class NivelPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class NivelPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class NivelPuestoListResponse(BaseModel):
    items: list[NivelPuestoResponse]
    total: int
    page: int
    page_size: int
