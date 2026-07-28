# app/schemas/tareas_catalogo.py
"""Schemas Pydantic v2 para el catalogo centralizado de tareas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TareaCatalogoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, min_length=1)
    categoria_tarea_id: Optional[int] = Field(None, gt=0)
    es_complemento: bool = False


class TareaCatalogoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, min_length=1)
    categoria_tarea_id: Optional[int] = Field(
        None, description="Null = quitar la categoria; omitir para no cambiarla"
    )
    es_complemento: Optional[bool] = None


class TareaCatalogoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    categoria_tarea_id: Optional[int] = None
    categoria_tarea_nombre: Optional[str] = None
    # Texto libre legacy: se conserva de solo lectura mientras quedan filas sin
    # migrar al catalogo. No se puede escribir desde la API.
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
