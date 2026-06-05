# app/schemas/grupos_competencia.py
"""Schemas Pydantic para el catalogo de grupos de competencia."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CategoriaGrupoCompetencia = Literal["tecnica", "blanda"]


class GrupoCompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    categoria: CategoriaGrupoCompetencia


class GrupoCompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    categoria: CategoriaGrupoCompetencia


class GrupoCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    categoria: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class GrupoCompetenciaListResponse(BaseModel):
    items: list[GrupoCompetenciaResponse]
    total: int
    page: int
    page_size: int
