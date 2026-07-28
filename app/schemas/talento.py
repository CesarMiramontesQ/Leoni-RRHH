# app/schemas/talento.py
"""
Schemas Pydantic v2 para el modulo de Talento — Fase 1.
Puestos Perfil y Competencias.

Los del Dashboard de Talento viven en `app/schemas/talento_dashboard.py`: es
otro dominio, solo comparten el nombre "talento".
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Puestos Perfil ───────────────────────────────────────────────────────────

TipoPuestoPerfil = Literal["administrativo", "operativo"]


class GradoPerfilItem(BaseModel):
    """Global Level del perfil (P10, M3)."""

    id: int
    nombre: str
    orden: int
    codigo: Optional[str] = None
    career_path_codigo: Optional[str] = None


EstadoPuestoPerfil = Literal["activo", "inactivo", "en_revision"]


class PuestoPerfilCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=3, max_length=255)
    area_id: int = Field(..., gt=0, description="Area del perfil (obligatoria)")
    grado_ids: list[int] = Field(
        ...,
        min_length=1,
        description="Global levels consecutivos del perfil, todos del mismo career path",
    )
    # ── Clasificacion organizacional (obligatoria al crear) ───────────────────
    career_path_id: int = Field(..., gt=0)
    funcion_id: int = Field(..., gt=0)
    disciplina_id: int = Field(..., gt=0)
    global_grade_id: Optional[int] = Field(
        None,
        gt=0,
        description=(
            "Se toma de la equivalencia configurada para el global level inicial. "
            "Solo hay que enviarlo si no existe equivalencia."
        ),
    )
    estado: Optional[EstadoPuestoPerfil] = None
    motivo_clasificacion: Optional[str] = Field(
        None, description="Queda registrado en el historial de clasificacion"
    )
    tipo: TipoPuestoPerfil = Field(
        default="administrativo",
        description="Clasificacion operativa del puesto: administrativo u operativo",
    )
    descripcion: Optional[str] = None


class PuestoPerfilUpdate(BaseModel):
    """
    Actualizacion parcial.

    La clasificacion es opcional a proposito: los perfiles anteriores a la
    metodologia WTW se pueden seguir editando sin completarla, y se marcan como
    pendientes en la UI.
    """

    model_config = {"str_strip_whitespace": True}

    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=3, max_length=255)
    area_id: Optional[int] = Field(None, gt=0)
    grado_ids: Optional[list[int]] = Field(None, min_length=1)
    career_path_id: Optional[int] = Field(None, gt=0)
    funcion_id: Optional[int] = Field(None, gt=0)
    disciplina_id: Optional[int] = Field(None, gt=0)
    global_grade_id: Optional[int] = Field(None, gt=0)
    estado: Optional[EstadoPuestoPerfil] = None
    motivo_clasificacion: Optional[str] = None
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
    # ── Clasificacion organizacional ─────────────────────────────────────────
    career_path_id: Optional[int] = None
    career_path_codigo: Optional[str] = None
    career_path_nombre: Optional[str] = None
    funcion_id: Optional[int] = None
    funcion_nombre: Optional[str] = None
    disciplina_id: Optional[int] = None
    disciplina_nombre: Optional[str] = None
    global_grade_id: Optional[int] = None
    global_grade_codigo: Optional[str] = None
    global_grade_nombre: Optional[str] = None
    estado: EstadoPuestoPerfil = "activo"
    clasificacion_completa: bool = False
    # Solo se llenan en el detalle: sacarlos en el listado costaria una consulta
    # de historial por fila.
    clasificado_por: Optional[str] = None
    clasificado_en: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ClasificacionCambioItem(BaseModel):
    """Un campo que se movio en un evento de clasificacion."""

    campo: str
    etiqueta: str
    anterior: Optional[str] = None
    nuevo: Optional[str] = None


class ClasificacionHistorialItem(BaseModel):
    id: int
    version: Optional[int] = None
    cambios: list[ClasificacionCambioItem] = []
    motivo: Optional[str] = None
    changed_by: Optional[int] = None
    changed_by_nombre: Optional[str] = None
    created_at: datetime


class ClasificacionHistorialResponse(BaseModel):
    items: list[ClasificacionHistorialItem]
    total: int


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
