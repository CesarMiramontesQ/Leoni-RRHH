# app/schemas/talento.py
"""
Schemas Pydantic v2 para el modulo de Talento — Fase 1.
Puestos Perfil y Competencias.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Puestos Perfil ───────────────────────────────────────────────────────────

TipoPuestoPerfil = Literal["administrativo", "operativo"]


class GradoPerfilItem(BaseModel):
    id: int
    nombre: str
    orden: int


class PuestoPerfilCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=3, max_length=255)
    area_id: int = Field(..., gt=0, description="Area del perfil (obligatoria)")
    grado_ids: list[int] = Field(
        ..., min_length=1, description="Grados consecutivos del perfil (obligatorio)"
    )
    tipo: TipoPuestoPerfil = Field(
        default="administrativo",
        description="Clasificacion del puesto: administrativo u operativo",
    )
    descripcion: Optional[str] = None


class PuestoPerfilUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=3, max_length=255)
    area_id: Optional[int] = Field(None, gt=0)
    grado_ids: Optional[list[int]] = Field(None, min_length=1)
    tipo: Optional[TipoPuestoPerfil] = None
    descripcion: Optional[str] = None


class PuestoPerfilResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    codigo: str
    nombre: str
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    grados: list[GradoPerfilItem] = []
    tipo: TipoPuestoPerfil
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
    tipo_competencia_id: int = Field(..., gt=0)
    area_id: Optional[int] = None


class CompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo_competencia_id: Optional[int] = Field(None, gt=0)
    area_id: Optional[int] = None


class CompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    categoria: str
    tipo_competencia_id: int
    tipo_nombre: str = ""
    tipo_grupo: str = ""
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
    grados: list[GradoPerfilItem] = []
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


# ── Multihabilidades (Matriz por Puesto) ────────────────────────────────────


class MultihabilidadesCompetenciaItem(BaseModel):
    competencia_id: int
    competencia_nombre: str
    tipo_competencia_id: int
    tipo_nombre: str = ""
    nivel_requerido: int


class MetodoCalificacionCompetenciaResumen(BaseModel):
    valor: int
    nombre: str
    orden: int


class MultihabilidadesEmpleadoItem(BaseModel):
    empleado_id: int
    nombre: str
    no_empleado: int
    grado_id: int
    grado_nombre: str = ""
    niveles: dict[int, int]
    requisitos: dict[int, int] = Field(
        default_factory=dict,
        description="Nivel requerido por competencia_id según el grado asignado al colaborador",
    )


class MultihabilidadesResponse(BaseModel):
    puesto_perfil_id: int
    puesto_nombre: str
    competencias: list[MultihabilidadesCompetenciaItem]
    empleados: list[MultihabilidadesEmpleadoItem]
    metodos_calificacion: list[MetodoCalificacionCompetenciaResumen] = []


class MultihabilidadesPuestoOption(BaseModel):
    id: int
    codigo: str
    nombre: str
    num_competencias: int
    num_empleados: int


# ── Dashboard de Talento (agregador de solo lectura) ─────────────────────────
# Sincronizados con `frontend/src/api/talento.ts`. Cada bloque comparte la misma
# forma -- `disponible` + `org` + `areas[]` -- para que el frontend los trate de
# forma uniforme y pueda pintar cada columna en cuanto llega.

_CFG = ConfigDict(from_attributes=True)


class CicloInfoSchema(BaseModel):
    model_config = _CFG

    id: int
    nombre: str
    estado: str


class AreaDesempenoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float | None
    distribucion: dict[str, int]
    semaforo: str | None


class OrgDesempenoSchema(BaseModel):
    model_config = _CFG

    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float | None
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


class BloqueDesempenoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    ciclo: CicloInfoSchema | None = None
    org: OrgDesempenoSchema | None = None
    areas: list[AreaDesempenoSchema] = []


class AreaPolivalenciaSchema(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


class OrgPolivalenciaSchema(BaseModel):
    model_config = _CFG

    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


class BloquePolivalenciaResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPolivalenciaSchema | None = None
    areas: list[AreaPolivalenciaSchema] = []


class AreaCapacitacionSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class OrgCapacitacionSchema(BaseModel):
    model_config = _CFG

    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class BloqueCapacitacionResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgCapacitacionSchema | None = None
    areas: list[AreaCapacitacionSchema] = []


class AreaPdiSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class OrgPdiSchema(BaseModel):
    model_config = _CFG

    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class BloquePdiResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPdiSchema | None = None
    areas: list[AreaPdiSchema] = []


class RangoObjetivoSchema(BaseModel):
    model_config = _CFG

    desde: date
    hasta: date


class AreaObjetivoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    indice_promedio: float | None


class OrgObjetivoSchema(BaseModel):
    model_config = _CFG

    n_empleados: int
    indice_promedio: float | None


class BloqueObjetivoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    rango: RangoObjetivoSchema | None = None
    org: OrgObjetivoSchema | None = None
    areas: list[AreaObjetivoSchema] = []


class EmpleadoFocoSchema(BaseModel):
    model_config = _CFG

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None
    senales: list[str]


class DetalleAreaResponse(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    desempeno: AreaDesempenoSchema | None
    polivalencia: AreaPolivalenciaSchema | None
    capacitacion: AreaCapacitacionSchema | None
    pdi: AreaPdiSchema | None
    empleados_foco: list[EmpleadoFocoSchema] = []
