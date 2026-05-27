# app/schemas/tareas_catalogo.py
"""Schemas Pydantic v2 para el catalogo centralizado de tareas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TareaCatalogoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    categoria: Optional[str] = Field(None, max_length=50)
    es_complemento: bool = False


class TareaCatalogoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    categoria: Optional[str] = Field(None, max_length=50)
    es_complemento: Optional[bool] = None


class TareaCatalogoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    categoria: Optional[str] = None
    es_complemento: bool
    activo: bool
    created_at: datetime
    updated_at: datetime


class TareaCatalogoListResponse(BaseModel):
    items: list[TareaCatalogoResponse]
    total: int
    page: int
    page_size: int
