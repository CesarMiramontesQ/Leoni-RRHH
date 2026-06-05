# app/schemas/grupos_competencia.py
"""Schemas Pydantic para el catalogo de grupos de competencia."""

from datetime import datetime

from pydantic import BaseModel, Field


class GrupoCompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class GrupoCompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)


class GrupoCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class GrupoCompetenciaListResponse(BaseModel):
    items: list[GrupoCompetenciaResponse]
    total: int
    page: int
    page_size: int
