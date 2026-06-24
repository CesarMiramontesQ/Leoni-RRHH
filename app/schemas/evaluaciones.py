# app/schemas/evaluaciones.py
"""
Schemas Pydantic v2 para Evaluaciones de Competencias — Fase 2.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EvaluacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    competencia_id: int
    nivel_actual: int = Field(..., ge=0, le=4)
    observaciones: Optional[str] = None


class EvaluacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nivel_actual: Optional[int] = Field(None, ge=0, le=4)
    observaciones: Optional[str] = None


class EvaluacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    competencia_id: int
    competencia_nombre: Optional[str] = None
    nivel_actual: int
    evaluador_id: Optional[int] = None
    evaluador_nombre: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_evaluacion: datetime
    created_at: datetime
    updated_at: datetime


class EvaluacionListResponse(BaseModel):
    items: list[EvaluacionResponse]
    total: int
    page: int
    page_size: int


class EvaluacionBulkCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    evaluaciones: list[EvaluacionCreate]


class EmpleadoCompetenciaResumen(BaseModel):
    competencia_id: int
    competencia_nombre: str
    categoria: str
    nivel_requerido: int
    nivel_actual: int
    gap: int
    brecha_pct: float = 0.0
    severidad: str = "alineado"
    accion_recomendada: Optional[str] = None
    accion_color: Optional[str] = None


class EmpleadoResumenResponse(BaseModel):
    empleado_id: int
    empleado_nombre: str
    area_nombre: Optional[str] = None
    puesto_nombre: Optional[str] = None
    nivel_puesto: Optional[str] = None
    departamento: Optional[str] = None
    evaluador_nombre: Optional[str] = None
    competencias_alineadas: int = 0
    brechas_identificadas: int = 0
    brecha_promedio: float = 0.0
    severidad_promedio: str = "alineado"
    readiness_score: float = 100.0
    competencias: list[EmpleadoCompetenciaResumen] = []
    cumplimiento_pct: float = 0.0
    total_competencias: int = 0
    evaluadas: int = 0
    con_gap: int = 0
