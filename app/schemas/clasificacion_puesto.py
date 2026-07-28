# app/schemas/clasificacion_puesto.py
"""
Schemas Pydantic de los catalogos de clasificacion de puesto (Willis Towers Watson).

Career Path, Funcion y Disciplina viven juntos porque son un solo concepto de
negocio: la identidad WTW del puesto. La Disciplina siempre depende de la Funcion.
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ── Career Path ──────────────────────────────────────────────────────────────


class CareerPathCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=10)
    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class CareerPathUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=10)
    nombre: str = Field(..., min_length=2, max_length=100)
    orden: int = Field(..., ge=1, le=99)


class CareerPathResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    codigo: str
    nombre: str
    orden: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class CareerPathListResponse(BaseModel):
    items: list[CareerPathResponse]
    total: int
    page: int
    page_size: int


# ── Funcion ──────────────────────────────────────────────────────────────────


class FuncionPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=2, max_length=100)


class FuncionPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=2, max_length=100)


class FuncionPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    codigo: str
    nombre: str
    activo: bool
    created_at: datetime
    updated_at: datetime


class FuncionPuestoListResponse(BaseModel):
    items: list[FuncionPuestoResponse]
    total: int
    page: int
    page_size: int


# ── Disciplina ───────────────────────────────────────────────────────────────


class DisciplinaPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    funcion_id: int = Field(..., gt=0)
    nombre: str = Field(..., min_length=2, max_length=100)
    codigo: str | None = Field(None, max_length=20)


class DisciplinaPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    funcion_id: int = Field(..., gt=0)
    nombre: str = Field(..., min_length=2, max_length=100)
    codigo: str | None = Field(None, max_length=20)


class DisciplinaPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    funcion_id: int
    funcion_nombre: str | None = None
    nombre: str
    codigo: str | None = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class DisciplinaPuestoListResponse(BaseModel):
    items: list[DisciplinaPuestoResponse]
    total: int
    page: int
    page_size: int
