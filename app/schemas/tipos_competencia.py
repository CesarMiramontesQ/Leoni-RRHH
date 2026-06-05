# app/schemas/tipos_competencia.py
"""Schemas Pydantic para el catalogo de tipos de competencia."""

from datetime import datetime

from pydantic import BaseModel, Field


class TipoCompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    grupo_competencia_id: int = Field(..., gt=0)


class TipoCompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    grupo_competencia_id: int = Field(..., gt=0)


class TipoCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    grupo_competencia_id: int
    grupo_nombre: str = ""
    grupo_categoria: str = ""
    activo: bool
    created_at: datetime
    updated_at: datetime


class TipoCompetenciaListResponse(BaseModel):
    items: list[TipoCompetenciaResponse]
    total: int
    page: int
    page_size: int
