# app/schemas/categorias_tarea.py
"""Schemas Pydantic para el catalogo de categorias de tarea."""

from datetime import datetime

from pydantic import BaseModel, Field


class CategoriaTareaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class CategoriaTareaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class CategoriaTareaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class CategoriaTareaListResponse(BaseModel):
    items: list[CategoriaTareaResponse]
    total: int
    page: int
    page_size: int
