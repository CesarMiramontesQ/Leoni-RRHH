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


# ── Global Grade ─────────────────────────────────────────────────────────────
# Clasificacion organizacional del puesto. No representa sueldo ni compensacion.


class GlobalGradeCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20, description="Ej. GG10")
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    orden: int = Field(..., ge=1, le=999)


class GlobalGradeUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    orden: int = Field(..., ge=1, le=999)


class GlobalGradeResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    codigo: str
    nombre: str
    descripcion: str | None = None
    orden: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class GlobalGradeListResponse(BaseModel):
    items: list[GlobalGradeResponse]
    total: int
    page: int
    page_size: int


# ── Equivalencia Career Level ↔ Global Grade ─────────────────────────────────


class EquivalenciaCreate(BaseModel):
    career_level_id: int = Field(..., gt=0)
    global_grade_id: int = Field(..., gt=0)


class EquivalenciaUpdate(BaseModel):
    career_level_id: int = Field(..., gt=0)
    global_grade_id: int = Field(..., gt=0)


class EquivalenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    career_level_id: int
    career_level_codigo: str | None = None
    career_level_nombre: str | None = None
    career_path_id: int | None = None
    career_path_codigo: str | None = None
    career_path_nombre: str | None = None
    global_grade_id: int
    global_grade_codigo: str | None = None
    global_grade_nombre: str | None = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class EquivalenciaListResponse(BaseModel):
    items: list[EquivalenciaResponse]
    total: int
    page: int
    page_size: int
