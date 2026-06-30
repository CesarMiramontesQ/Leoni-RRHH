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
    nivel_grado1: int = 0
    gap: int
    brecha_pct: float = 0.0
    severidad: str = "alineado"
    accion_recomendada: Optional[str] = None
    accion_color: Optional[str] = None


class EmpleadoConPerfilItem(BaseModel):
    """Empleado ligado a un perfil de puesto (asignación PerfilFunciones activa)."""

    empleado_id: int
    empleado_nombre: str
    no_empleado: Optional[int] = None
    puesto_perfil_id: int
    puesto_nombre: Optional[str] = None
    puesto_codigo: Optional[str] = None
    nivel_puesto: Optional[str] = None
    grado_id: Optional[int] = None
    grado_nombre: Optional[str] = None
    departamento: Optional[str] = None
    area_nombre: Optional[str] = None
    readiness_score: float = 100.0
    brechas_identificadas: int = 0
    severidad_promedio: str = "alineado"
    competencias_alineadas: int = 0
    total_competencias: int = 0


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
