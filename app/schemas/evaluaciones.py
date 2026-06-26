# app/schemas/evaluaciones.py
"""
Schemas Pydantic v2 para Evaluaciones de Competencias — Fase 2 + Workflow.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EvaluacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    competencia_id: int
    nivel_actual: int = Field(0, ge=0, le=4)
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
    estado: str
    comentario_devolucion: Optional[str] = None
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


class EmpleadoResumenResponse(BaseModel):
    empleado_id: int
    empleado_nombre: str
    area_nombre: Optional[str] = None
    competencias: list[EmpleadoCompetenciaResumen]
    cumplimiento_pct: float
    total_competencias: int
    evaluadas: int
    con_gap: int


# ── Workflow schemas ───────────────────────────────────────────────────────────


class TransicionRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    comentario: str = Field(..., min_length=10)


class TransicionResponse(BaseModel):
    id: int
    estado: str
    mensaje: str


class HistorialEvento(BaseModel):
    actor_nombre: Optional[str] = None
    accion: str
    estado_anterior: Optional[str] = None
    estado_nuevo: Optional[str] = None
    comentario: Optional[str] = None
    timestamp: datetime


class HistorialResponse(BaseModel):
    evaluacion_id: int
    estado_actual: str
    eventos: list[HistorialEvento]
