# app/schemas/talento.py
"""
Schemas Pydantic v2 para el modulo de Talento — Fase 1.
Puestos Perfil y Competencias.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Puestos Perfil ───────────────────────────────────────────────────────────


class PuestoPerfilCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=3, max_length=255)
    area_id: Optional[int] = None
    nivel: Optional[str] = Field(None, max_length=50)
    descripcion: Optional[str] = None


class PuestoPerfilUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=3, max_length=255)
    area_id: Optional[int] = None
    nivel: Optional[str] = Field(None, max_length=50)
    descripcion: Optional[str] = None


class PuestoPerfilResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    codigo: str
    nombre: str
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    nivel: Optional[str] = None
    descripcion: Optional[str] = None
    version: int
    activo: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PuestoPerfilListResponse(BaseModel):
    items: list[PuestoPerfilResponse]
    total: int
    page: int
    page_size: int


# ── Competencias ─────────────────────────────────────────────────────────────

CategoriaCompetencia = Literal["tecnica", "blanda"]


class CompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    categoria: CategoriaCompetencia
    area_id: Optional[int] = None


class CompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    categoria: Optional[CategoriaCompetencia] = None
    area_id: Optional[int] = None


class CompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    categoria: str
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class CompetenciaListResponse(BaseModel):
    items: list[CompetenciaResponse]
    total: int
    page: int
    page_size: int


# ── Matriz de Competencias ───────────────────────────────────────────────────


class MatrizCelda(BaseModel):
    competencia_id: int
    puesto_perfil_id: int
    nivel_requerido: int = Field(..., ge=0, le=4)


class MatrizRow(BaseModel):
    competencia_id: int
    competencia_nombre: str
    categoria: str
    niveles: dict[int, int]  # {puesto_perfil_id: nivel_requerido}


class MatrizResponse(BaseModel):
    area_id: int
    area_nombre: Optional[str] = None
    puestos: list[PuestoPerfilResponse]
    competencias: list[MatrizRow]


class MatrizBulkUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    celdas: list[MatrizCelda]


# ── Resumen de Area ──────────────────────────────────────────────────────────


class ResumenAreaResponse(BaseModel):
    area_id: int
    area_nombre: Optional[str] = None
    total_empleados: int
    total_puestos_perfil: int
    total_competencias: int
    requisitos_activos: int
    cumplimiento_porcentaje: float


# ── Brechas ──────────────────────────────────────────────────────────────────


class BrechaItem(BaseModel):
    competencia_id: int
    competencia_nombre: str
    categoria: str
    nivel_requerido_promedio: float
    gap_porcentaje: float
    empleados_afectados: int


class BrechasResponse(BaseModel):
    area_id: int
    area_nombre: Optional[str] = None
    brechas: list[BrechaItem]


# ── Filter Options ───────────────────────────────────────────────────────────


class FilterOption(BaseModel):
    id: str
    label: str


class FilterOptionsResponse(BaseModel):
    areas: list[FilterOption] = []
    lineas: list[FilterOption] = []
    sectores: list[FilterOption] = []


# ── Resumen Tarjetas ────────────────────────────────────────────────────────


class PerfilTarjetaItem(BaseModel):
    id: int
    codigo: str
    nombre: str
    area_nombre: Optional[str] = None
    nivel: Optional[str] = None
    personas: int = 0
    cumplimiento_pct: int = 0
    brechas: int = 0
    cursos: int = 0
    evidencias: int = 0


class ResumenTarjetasResponse(BaseModel):
    items: list[PerfilTarjetaItem]


# ── IA Generacion ────────────────────────────────────────────────────────────


class GenerarPerfilIARequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=3, max_length=255)
    area_nombre: Optional[str] = None


class GenerarPerfilIAResponse(BaseModel):
    descripcion: str
    competencias_tecnicas: list[str]
    habilidades_blandas: list[str]
    maquinas_herramientas: list[str]
