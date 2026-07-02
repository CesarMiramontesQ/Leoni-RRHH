# app/schemas/evaluacion360.py
"""
Schemas Pydantic v2 para el modulo de Evaluacion 360 (Level Up) — Fase 1.

Cubre: configuracion, escalas, banco de preguntas, campanas (con competencias y
tipos de evaluador), participantes, evaluaciones (responder/enviar), resultados y
dashboard. Paginacion por page/page_size (estilo incidencias/competencias).
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

TipoEvaluador = Literal[
    "autoevaluacion",
    "jefe",
    "par",
    "subordinado",
    "cliente_interno",
    "cliente_externo",
]
CampanaEstado = Literal[
    "borrador", "activa", "en_progreso", "finalizada", "cerrada", "cancelada"
]
EvaluacionEstado = Literal["pendiente", "en_progreso", "completada", "vencida"]


# ── Escalas ───────────────────────────────────────────────────────────────────


class EscalaBase(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=1, max_length=100)
    valor_min: int = Field(1, ge=0, le=100)
    valor_max: int = Field(5, ge=1, le=100)
    etiquetas: Optional[dict[str, str]] = None

    @field_validator("valor_max")
    @classmethod
    def _max_gt_min(cls, v: int, info) -> int:
        vmin = info.data.get("valor_min")
        if vmin is not None and v <= vmin:
            raise ValueError("valor_max debe ser mayor que valor_min")
        return v


class EscalaCreate(EscalaBase):
    pass


class EscalaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    valor_min: Optional[int] = Field(None, ge=0, le=100)
    valor_max: Optional[int] = Field(None, ge=1, le=100)
    etiquetas: Optional[dict[str, str]] = None
    activo: Optional[bool] = None


class EscalaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    valor_min: int
    valor_max: int
    etiquetas: Optional[dict[str, str]] = None
    activo: bool


# ── Configuracion global ──────────────────────────────────────────────────────


class ConfigUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    escala_id: Optional[int] = None
    comentarios_obligatorios: Optional[bool] = None
    autoevaluacion_habilitada: Optional[bool] = None
    guardar_borradores: Optional[bool] = None
    evaluacion_anonima: Optional[bool] = None
    nivel_minimo_esperado: Optional[int] = Field(None, ge=0, le=4)
    pesos_evaluadores: Optional[dict[str, float]] = None
    frecuencia_sugerida: Optional[
        Literal["mensual", "trimestral", "semestral", "anual", "manual"]
    ] = None
    recordatorios: Optional[dict] = None
    plantillas_correo: Optional[dict] = None

    @field_validator("pesos_evaluadores")
    @classmethod
    def _pesos_suman_100(cls, v: Optional[dict[str, float]]) -> Optional[dict[str, float]]:
        if v:
            total = round(sum(v.values()), 2)
            if abs(total - 100.0) > 0.01:
                raise ValueError(f"Los pesos de evaluadores deben sumar 100% (suman {total})")
        return v


class ConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    escala_id: Optional[int] = None
    comentarios_obligatorios: bool
    autoevaluacion_habilitada: bool
    guardar_borradores: bool
    evaluacion_anonima: bool
    nivel_minimo_esperado: int
    pesos_evaluadores: Optional[dict[str, float]] = None
    frecuencia_sugerida: str
    recordatorios: Optional[dict] = None
    plantillas_correo: Optional[dict] = None


# ── Banco de preguntas ────────────────────────────────────────────────────────


class PreguntaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    competencia_id: int
    texto: str = Field(..., min_length=3)
    orden: Optional[int] = None


class PreguntaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    texto: Optional[str] = Field(None, min_length=3)
    orden: Optional[int] = None
    activo: Optional[bool] = None


class PreguntaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    competencia_id: int
    texto: str
    orden: Optional[int] = None
    activo: bool


class CompetenciaCatalogoItem(BaseModel):
    """Ítem ligero del catálogo de competencias para el wizard (sin depender
    del módulo `competencias`)."""

    id: int
    nombre: str
    categoria: Optional[str] = None
    num_preguntas: int = 0


# ── Campanas ──────────────────────────────────────────────────────────────────


class CampanaCompetenciaIn(BaseModel):
    competencia_id: int
    peso: float = Field(0, ge=0, le=100)
    num_preguntas: Optional[int] = Field(None, ge=1, le=50)
    nivel_esperado: int = Field(3, ge=0, le=4)
    obligatoria: bool = True
    orden: Optional[int] = None


class CampanaEvaluadorTipoIn(BaseModel):
    tipo: TipoEvaluador
    peso: float = Field(0, ge=0, le=100)
    activo: bool = True


class CampanaConfigIn(BaseModel):
    anonima: bool = False
    comentarios_obligatorios: bool = False
    permitir_borradores: bool = True
    mostrar_progreso: bool = True
    fecha_limite: Optional[date] = None
    recordatorios: Optional[dict] = None


class CampanaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=3, max_length=255)
    descripcion: Optional[str] = None
    objetivo: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_cierre: Optional[date] = None
    tipo: str = "evaluacion_360"
    escala_id: Optional[int] = None
    plantilla_id: Optional[int] = None
    competencias: list[CampanaCompetenciaIn] = Field(default_factory=list)
    evaluador_tipos: list[CampanaEvaluadorTipoIn] = Field(default_factory=list)
    empleado_ids: list[int] = Field(default_factory=list)
    config: Optional[CampanaConfigIn] = None

    @field_validator("evaluador_tipos")
    @classmethod
    def _pesos_activos_suman_100(
        cls, v: list[CampanaEvaluadorTipoIn]
    ) -> list[CampanaEvaluadorTipoIn]:
        activos = [t for t in v if t.activo]
        if activos:
            total = round(sum(t.peso for t in activos), 2)
            if abs(total - 100.0) > 0.01:
                raise ValueError(
                    f"Los pesos de evaluadores activos deben sumar 100% (suman {total})"
                )
        return v


class CampanaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=3, max_length=255)
    descripcion: Optional[str] = None
    objetivo: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_cierre: Optional[date] = None
    escala_id: Optional[int] = None
    competencias: Optional[list[CampanaCompetenciaIn]] = None
    evaluador_tipos: Optional[list[CampanaEvaluadorTipoIn]] = None
    empleado_ids: Optional[list[int]] = None
    config: Optional[CampanaConfigIn] = None


class CampanaCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    competencia_id: int
    competencia_nombre: Optional[str] = None
    peso: float
    num_preguntas: Optional[int] = None
    nivel_esperado: int
    obligatoria: bool
    orden: Optional[int] = None


class CampanaEvaluadorTipoResponse(BaseModel):
    model_config = {"from_attributes": True}

    tipo: TipoEvaluador
    peso: float
    activo: bool


class CampanaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    objetivo: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_cierre: Optional[date] = None
    estado: CampanaEstado
    tipo: str
    escala_id: Optional[int] = None
    config: Optional[dict] = None
    participantes: int = 0
    evaluadores: int = 0
    evaluaciones_total: int = 0
    evaluaciones_completadas: int = 0
    avance: float = 0.0
    created_at: datetime
    updated_at: datetime


class CampanaDetalleResponse(CampanaResponse):
    competencias: list[CampanaCompetenciaResponse] = Field(default_factory=list)
    evaluador_tipos: list[CampanaEvaluadorTipoResponse] = Field(default_factory=list)


class CampanaListResponse(BaseModel):
    items: list[CampanaResponse]
    total: int
    page: int
    page_size: int


# ── Participantes / evaluadores ───────────────────────────────────────────────


class ParticipanteResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    puesto: Optional[str] = None
    area: Optional[str] = None
    estado: str
    evaluaciones_total: int = 0
    evaluaciones_completadas: int = 0
    avance: float = 0.0


class EvaluadorManualIn(BaseModel):
    """Alta manual de evaluador (interno por empleado_id o externo por nombre)."""

    participante_id: int
    tipo_evaluador: TipoEvaluador
    evaluador_empleado_id: Optional[int] = None
    evaluador_nombre: Optional[str] = None


class SugerenciaEvaluadorResponse(BaseModel):
    participante_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    tipo_evaluador: TipoEvaluador
    evaluador_empleado_id: Optional[int] = None
    evaluador_nombre: Optional[str] = None


# ── Responder evaluaciones (Mis Evaluaciones) ─────────────────────────────────


class MiEvaluacionResumen(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    campana_id: int
    campana_nombre: Optional[str] = None
    evaluado_nombre: Optional[str] = None
    tipo_evaluador: TipoEvaluador
    estado: EvaluacionEstado
    fecha_asignacion: datetime
    fecha_limite: Optional[date] = None
    avance: float = 0.0


class PreguntaEvaluacion(BaseModel):
    pregunta_id: int
    texto: str
    valor: Optional[float] = None


class CompetenciaEvaluacion(BaseModel):
    competencia_id: int
    competencia_nombre: str
    nivel_esperado: int
    preguntas: list[PreguntaEvaluacion] = Field(default_factory=list)
    comentario: Optional[str] = None


class EvaluacionDetalleResponse(BaseModel):
    id: int
    campana_id: int
    campana_nombre: Optional[str] = None
    evaluado_nombre: Optional[str] = None
    tipo_evaluador: TipoEvaluador
    estado: EvaluacionEstado
    es_anonima: bool
    escala: Optional[EscalaResponse] = None
    comentarios_obligatorios: bool = False
    fecha_limite: Optional[date] = None
    competencias: list[CompetenciaEvaluacion] = Field(default_factory=list)


class RespuestaIn(BaseModel):
    pregunta_id: int
    valor: float


class ComentarioIn(BaseModel):
    competencia_id: Optional[int] = None
    texto: str = Field(..., min_length=1)
    tipo: Literal["fortaleza", "oportunidad", "general"] = "general"


class EvaluacionRespuestasIn(BaseModel):
    """Payload para guardar borrador o enviar una evaluacion."""

    respuestas: list[RespuestaIn] = Field(default_factory=list)
    comentarios: list[ComentarioIn] = Field(default_factory=list)


# ── Resultados / reportes ─────────────────────────────────────────────────────


class ResultadoCompetencia(BaseModel):
    model_config = {"from_attributes": True}

    competencia_id: Optional[int] = None
    competencia_nombre: Optional[str] = None
    promedio_general: Optional[float] = None
    promedio_por_tipo: Optional[dict[str, float]] = None
    autoevaluacion: Optional[float] = None
    nivel_esperado: Optional[float] = None
    brecha: Optional[float] = None
    estado_brecha: Optional[str] = None


class ResultadoParticipanteResponse(BaseModel):
    participante_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    puesto: Optional[str] = None
    calificacion_general: Optional[float] = None
    competencias: list[ResultadoCompetencia] = Field(default_factory=list)
    fortalezas: list[str] = Field(default_factory=list)
    oportunidades: list[str] = Field(default_factory=list)


class ComentarioReporte(BaseModel):
    tipo_evaluador: Optional[TipoEvaluador] = None
    competencia_id: Optional[int] = None
    competencia_nombre: Optional[str] = None
    texto: str
    tipo: str = "general"


class EvolucionPunto(BaseModel):
    campana_id: int
    campana_nombre: str
    fecha: Optional[date] = None
    calificacion_general: Optional[float] = None


class ReporteIndividualResponse(BaseModel):
    participante_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    puesto: Optional[str] = None
    area: Optional[str] = None
    campana_id: int
    campana_nombre: Optional[str] = None
    calificacion_general: Optional[float] = None
    promedio_autoevaluacion: Optional[float] = None
    promedio_externo: Optional[float] = None
    competencias: list[ResultadoCompetencia] = Field(default_factory=list)
    fortalezas: list[str] = Field(default_factory=list)
    oportunidades: list[str] = Field(default_factory=list)
    comentarios: list[ComentarioReporte] = Field(default_factory=list)
    evolucion: list[EvolucionPunto] = Field(default_factory=list)


# ── Dashboard ─────────────────────────────────────────────────────────────────


class DashboardKpis(BaseModel):
    campanas_activas: int = 0
    campanas_finalizadas: int = 0
    evaluaciones_pendientes: int = 0
    evaluaciones_respondidas: int = 0
    participantes: int = 0
    promedio_general: Optional[float] = None
    competencia_menor: Optional[str] = None
    competencia_menor_promedio: Optional[float] = None
    competencia_mayor: Optional[str] = None
    competencia_mayor_promedio: Optional[float] = None


class DashboardSeriePunto(BaseModel):
    label: str
    valor: float


class CampanaAvance(BaseModel):
    campana_id: int
    nombre: str
    avance: float


class DashboardResponse(BaseModel):
    kpis: DashboardKpis
    estado_evaluaciones: list[DashboardSeriePunto] = Field(default_factory=list)
    competencias_mejor: list[DashboardSeriePunto] = Field(default_factory=list)
    competencias_oportunidad: list[DashboardSeriePunto] = Field(default_factory=list)
    avance_por_campana: list[CampanaAvance] = Field(default_factory=list)
    distribucion_calificaciones: list[DashboardSeriePunto] = Field(default_factory=list)


# ── Plantillas ────────────────────────────────────────────────────────────────


class PlantillaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=3, max_length=255)
    descripcion: Optional[str] = None
    escala_id: Optional[int] = None
    competencias: list[CampanaCompetenciaIn] = Field(default_factory=list)
    evaluador_tipos: list[CampanaEvaluadorTipoIn] = Field(default_factory=list)
    config: Optional[CampanaConfigIn] = None


class PlantillaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=3, max_length=255)
    descripcion: Optional[str] = None
    escala_id: Optional[int] = None
    competencias: Optional[list[CampanaCompetenciaIn]] = None
    evaluador_tipos: Optional[list[CampanaEvaluadorTipoIn]] = None
    config: Optional[CampanaConfigIn] = None
    activo: Optional[bool] = None


class PlantillaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    escala_id: Optional[int] = None
    activo: bool
    competencias: list[CampanaCompetenciaResponse] = Field(default_factory=list)
    evaluador_tipos: list[CampanaEvaluadorTipoResponse] = Field(default_factory=list)
    config: Optional[dict] = None


class RecordatoriosResultado(BaseModel):
    recordatorios_enviados: int = 0
    vencidas_marcadas: int = 0


# ── Fase 4: capacitación / PDI / perfil ──────────────────────────────────────


class CursoSugeridoItem(BaseModel):
    id: int
    nombre: str
    modalidad: Optional[str] = None
    duracion_horas: Optional[int] = None


class CursoSugeridoPorCompetencia(BaseModel):
    competencia_id: int
    competencia_nombre: Optional[str] = None
    brecha: Optional[float] = None
    estado_brecha: Optional[str] = None
    cursos: list[CursoSugeridoItem] = Field(default_factory=list)


class GenerarPdiResultado(BaseModel):
    creados: int = 0
    competencias: list[str] = Field(default_factory=list)


class ResumenEmpleadoResponse(BaseModel):
    empleado_id: int
    tiene_datos: bool = False
    participante_id: Optional[int] = None
    campana_nombre: Optional[str] = None
    calificacion_general: Optional[float] = None
    competencias: list[ResultadoCompetencia] = Field(default_factory=list)
    evolucion: list[EvolucionPunto] = Field(default_factory=list)


# ── Fase 5: 9-Box / talento ──────────────────────────────────────────────────


class NineBoxUpdate(BaseModel):
    desempeno: Optional[float] = Field(None, ge=0, le=100)
    potencial: Optional[float] = Field(None, ge=0, le=100)


class NineBoxCelda(BaseModel):
    desempeno: Literal["bajo", "medio", "alto"]
    potencial: Literal["bajo", "medio", "alto"]
    clasificacion: str
    empleados: list[str] = Field(default_factory=list)


class TalentoSegmentoResumen(BaseModel):
    segmento: str
    label: str
    cantidad: int


class NineBoxResponse(BaseModel):
    campana_id: int
    escala_max: float
    celdas: list[NineBoxCelda] = Field(default_factory=list)
    segmentos: list[TalentoSegmentoResumen] = Field(default_factory=list)
