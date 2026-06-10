# app/schemas/metodos_calificacion_competencia.py
"""Schemas Pydantic para metodos de calificacion de competencias."""

from datetime import datetime

from pydantic import BaseModel, Field


class MetodoCalificacionCompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=4)


class MetodoCalificacionCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    valor: int
    nombre: str
    orden: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class MetodoCalificacionCompetenciaListResponse(BaseModel):
    items: list[MetodoCalificacionCompetenciaResponse]
    total: int
