"""Schemas del flujo de encuestas post curso (Level Up).

La encuesta se habilita por sesión (sesión finalizada) pero la valoración pertenece al
curso: todas las respuestas de todas las sesiones alimentan el promedio del curso.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

EstadoEncuestaLiteral = Literal["activa", "cerrada"]
# Estado efectivo expuesto a la UI: "no_habilitada" = no existe encuesta para la sesión.
EstadoEncuestaEfectivoLiteral = Literal["no_habilitada", "activa", "cerrada"]


# ── Administración (RH) ──────────────────────────────────────────────────────


class EncuestaHabilitarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    fecha_limite: Optional[datetime] = None


class EncuestaUpdateRequest(BaseModel):
    estado: Optional[EstadoEncuestaLiteral] = None
    fecha_limite: Optional[datetime] = None


class EncuestaEstadoResponse(BaseModel):
    """Estado de la encuesta de una sesión + conteos de participación."""

    id: Optional[int] = None
    curso_id: int
    sesion_id: int
    estado_efectivo: EstadoEncuestaEfectivoLiteral
    fecha_limite: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    total_asistentes: int = 0
    respondidas: int = 0
    pendientes: int = 0


# ── Respuestas (empleado) ────────────────────────────────────────────────────


class EncuestaRespuestaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    score_general: int = Field(..., ge=1, le=5)
    score_instructor: int = Field(..., ge=1, le=5)
    score_contenido: int = Field(..., ge=1, le=5)
    score_aplicabilidad: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = Field(None, max_length=2000)


class EncuestaRespuestaResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    encuesta_id: int
    curso_id: int
    sesion_id: int
    empleado_id: int
    score_general: int
    score_instructor: int
    score_contenido: int
    score_aplicabilidad: int
    comentario: Optional[str] = None
    fecha: datetime


class EncuestaPendienteItem(BaseModel):
    encuesta_id: int
    curso_id: int
    curso_nombre: Optional[str] = None
    sesion_id: int
    fecha_sesion: Optional[date] = None
    fecha_limite: Optional[datetime] = None


class EncuestaPendienteListResponse(BaseModel):
    items: list[EncuestaPendienteItem]
    total: int


class EncuestaDetalleResponse(BaseModel):
    """Detalle para que el empleado responda la encuesta."""

    encuesta_id: int
    curso_id: int
    curso_nombre: Optional[str] = None
    sesion_id: int
    fecha_sesion: Optional[date] = None
    estado_efectivo: EstadoEncuestaEfectivoLiteral
    fecha_limite: Optional[datetime] = None
    ya_respondida: bool = False


# ── Resultados / métricas ────────────────────────────────────────────────────


class DistribucionItem(BaseModel):
    score: int  # 1..5
    cantidad: int


class ComentarioItem(BaseModel):
    sesion_id: int
    empleado_nombre: Optional[str] = None
    score_general: int
    comentario: str
    fecha: datetime


class EncuestaSesionResultado(BaseModel):
    sesion_id: int
    fecha_sesion: Optional[date] = None
    estado_efectivo: EstadoEncuestaEfectivoLiteral
    total_asistentes: int = 0
    respondidas: int = 0
    tasa_participacion: float = 0.0  # 0..1
    promedio_general: Optional[float] = None
    promedio_instructor: Optional[float] = None
    promedio_contenido: Optional[float] = None
    promedio_aplicabilidad: Optional[float] = None


class CursoEncuestasResumenResponse(BaseModel):
    curso_id: int
    curso_nombre: Optional[str] = None
    calificacion_promedio: Optional[float] = None  # AVG(score_general) de todas las sesiones
    total_evaluaciones: int = 0
    promedio_instructor: Optional[float] = None
    promedio_contenido: Optional[float] = None
    promedio_aplicabilidad: Optional[float] = None
    distribucion: list[DistribucionItem] = []
    sesiones: list[EncuestaSesionResultado] = []  # historial + comparativo por sesión
    comentarios: list[ComentarioItem] = []


# ── Dashboard global (RH) ────────────────────────────────────────────────────


class DashboardCursoItem(BaseModel):
    curso_id: int
    curso_nombre: str
    instructor_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    total_evaluaciones: int = 0
    promedio_general: Optional[float] = None
    promedio_instructor: Optional[float] = None
    promedio_contenido: Optional[float] = None
    promedio_aplicabilidad: Optional[float] = None


class EncuestasDashboardResponse(BaseModel):
    total_evaluaciones: int = 0
    score_medio: Optional[float] = None
    cursos_evaluados: int = 0
    cursos_en_alerta: int = 0  # promedio_general < 3.5
    distribucion: list[DistribucionItem] = []
    cursos: list[DashboardCursoItem] = []
    comentarios: list[ComentarioItem] = []
