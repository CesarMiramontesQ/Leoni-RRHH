# app/schemas/perfil_funciones.py
"""
Schemas Pydantic v2 para Perfil de Funciones.
Tareas, Cualificaciones, Competencias Requeridas y Asignaciones individuales.
"""

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.cualificaciones_catalogo import (
    OpcionCalificacionResponse,
    validar_criterio_requerido,
    validar_valor_capturado,
)
from app.schemas.empleados import AreaResponse


# ── Tipos enumerados ────────────────────────────────────────────────────────

DivisionType = Literal["holding", "wsd", "wcs"]

CategoriaCompetenciaRequerida = Literal[
    "informatica",
    "idiomas",
    "profesional",
    "social",
    "personal",
    "metodos",
    "complementos",
]


# ── PuestoPerfil extension (campos adicionales) ────────────────────────────


class PuestoPerfilFuncionesUpdate(BaseModel):
    """Campos del perfil de funciones que se agregan al puesto perfil existente."""

    model_config = {"str_strip_whitespace": True}

    division: Optional[DivisionType] = None
    centro_leoni: Optional[str] = Field(None, max_length=200)
    form_version: Optional[str] = Field(None, max_length=20)
    reporta_a: Optional[str] = Field(None, max_length=200)
    ordenes_funcional_de: Optional[str] = Field(None, max_length=200)
    responsable_de: Optional[str] = None
    sustituye_a: Optional[str] = Field(None, max_length=200)
    sustituido_por: Optional[str] = Field(None, max_length=200)
    obligaciones_empresariales: Optional[bool] = None
    obligacion_confidencialidad: Optional[bool] = None
    poderes_legales: Optional[str] = None
    complemento_poderes: Optional[str] = None


# ── Búsqueda de empleados disponibles para asignar ─────────────────────────


class EmpleadoDisponibleResponse(BaseModel):
    """Empleado activo sin asignación de perfil, para el buscador del modal de asignar."""

    model_config = {"from_attributes": True}

    id: int
    no_empleado: int
    nombre: str
    area: Optional[AreaResponse] = None


# ── Perfil Tareas ───────────────────────────────────────────────────────────


class PerfilTareaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tarea_catalogo_id: Optional[int] = None
    orden: int = Field(..., ge=1)
    descripcion: Optional[str] = Field(None, min_length=1)
    es_complemento: bool = False
    grado_id: Optional[int] = Field(
        None, gt=0, description="Null = tarea general (todos los grados del perfil)"
    )

    @model_validator(mode="after")
    def check_source(self) -> "PerfilTareaCreate":
        if not self.tarea_catalogo_id and not self.descripcion:
            raise ValueError("Se requiere tarea_catalogo_id o descripcion")
        return self


class PerfilTareaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: Optional[int] = Field(None, ge=1)
    descripcion: Optional[str] = Field(None, min_length=1)
    es_complemento: Optional[bool] = None
    grado_id: Optional[int] = Field(
        None,
        description="Null = general; omitir para no cambiar; >0 = grado específico",
    )

    @model_validator(mode="after")
    def check_grado_id(self) -> "PerfilTareaUpdate":
        if self.grado_id is not None and self.grado_id <= 0:
            raise ValueError("grado_id debe ser mayor que 0")
        return self


class PerfilTareaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    orden: int
    descripcion: str
    es_complemento: bool
    tarea_catalogo_id: Optional[int] = None
    tarea_catalogo_nombre: Optional[str] = None
    grado_id: Optional[int] = None
    grado_nombre: Optional[str] = None
    es_general: bool = True
    created_at: datetime
    updated_at: datetime


# ── Perfil Cualificaciones ──────────────────────────────────────────────────


class PerfilCualificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    cualificacion_catalogo_id: int = Field(..., gt=0)
    criterio_requerido: dict[str, Any]
    comentarios: Optional[str] = None


class PerfilCualificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    criterio_requerido: Optional[dict[str, Any]] = None
    comentarios: Optional[str] = None


class PerfilCualificacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    cualificacion_catalogo_id: Optional[int] = None
    cualificacion_nombre: str = ""
    tipo_nombre: str = ""
    metodo_tipo: str = ""
    metodo_config: dict[str, Any] = Field(default_factory=dict)
    opciones: list[OpcionCalificacionResponse] = Field(default_factory=list)
    criterio_requerido: Optional[dict[str, Any]] = None
    comentarios: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Perfil Competencias (usa tabla unificada competencia_requisitos) ────────


class PerfilCompetenciaCreate(BaseModel):
    competencia_id: int
    grado_id: Optional[int] = Field(
        None, gt=0, description="Null = competencia general (todos los grados del perfil)"
    )
    nivel_requerido: int = Field(..., ge=1, description="Nivel mínimo requerido (valor del catálogo)")


class PerfilCompetenciaUpdate(BaseModel):
    nivel_requerido: int = Field(..., ge=1, description="Nivel mínimo requerido (valor del catálogo)")


class PerfilCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    competencia_id: int
    competencia_nombre: str = ""
    tipo_competencia_id: Optional[int] = None
    tipo_nombre: Optional[str] = None
    categoria: Optional[str] = None
    grupo_nombre: Optional[str] = None
    grado_id: Optional[int] = None
    grado_nombre: Optional[str] = None
    es_general: bool = False
    nivel_requerido: int = 0
    orden: Optional[int] = None


# ── Perfil Funciones (asignacion individual) ────────────────────────────────


class PerfilFuncionesCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    puesto_perfil_id: int
    empleado_id: int
    grado_id: int = Field(..., gt=0)
    departamento: Optional[str] = Field(None, max_length=200)
    fecha_firma_superior: Optional[date] = None
    fecha_firma_empleado: Optional[date] = None
    firma_superior_id: Optional[str] = Field(None, max_length=50)
    firma_empleado_id: Optional[str] = Field(None, max_length=50)


class PerfilFuncionesUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    grado_id: Optional[int] = Field(None, gt=0)
    departamento: Optional[str] = Field(None, max_length=200)
    fecha_firma_superior: Optional[date] = None
    fecha_firma_empleado: Optional[date] = None
    firma_superior_id: Optional[str] = Field(None, max_length=50)
    firma_empleado_id: Optional[str] = Field(None, max_length=50)
    activo: Optional[bool] = None


class PerfilFuncionesResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    empleado_id: int
    grado_id: int
    grado_nombre: str = ""
    nombre_empleado: Optional[str] = None
    no_empleado: Optional[int] = None
    departamento: Optional[str] = None
    fecha_firma_superior: Optional[date] = None
    fecha_firma_empleado: Optional[date] = None
    firma_superior_id: Optional[str] = None
    firma_empleado_id: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class PerfilFuncionesListResponse(BaseModel):
    items: list[PerfilFuncionesResponse]
    total: int
    page: int
    page_size: int


# ── Perfil Funciones Cualificacion (evaluacion individual) ──────────────────


class PerfilFuncionesCualificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    cualificacion_id: int
    valor_capturado: dict[str, Any]
    comentarios: Optional[str] = None


class PerfilFuncionesCualificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    valor_capturado: Optional[dict[str, Any]] = None
    comentarios: Optional[str] = None


class PerfilFuncionesCualificacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    perfil_funciones_id: int
    cualificacion_id: int
    valor_capturado: Optional[dict[str, Any]] = None
    comentarios: Optional[str] = None
    cumple: Optional[bool] = None
    created_at: datetime
    updated_at: datetime


# ── Perfil Funciones Competencia (evaluacion individual) ────────────────────


class PerfilFuncionesCompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    competencia_requisito_id: int
    situacion_actual: str = Field(..., min_length=1)
    comentarios: Optional[str] = None


class PerfilFuncionesCompetenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    situacion_actual: Optional[str] = Field(None, min_length=1)
    comentarios: Optional[str] = None


class PerfilFuncionesCompetenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    perfil_funciones_id: int
    competencia_requisito_id: int
    situacion_actual: str
    comentarios: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Sync bulk de competencias (multi-select por categoría) ───────────────────


class PerfilCompetenciaSyncItem(BaseModel):
    competencia_id: int
    nivel_requerido: int = Field(..., ge=1)


class PerfilCompetenciaSyncBody(BaseModel):
    grado_id: Optional[int] = Field(
        None, gt=0, description="Null = sync de competencias generales del perfil"
    )
    tipo_competencia_id: int = Field(..., gt=0)
    competencias: list[PerfilCompetenciaSyncItem] = Field(default_factory=list)
    # Legado: si se envía sin `competencias`, se interpreta nivel 1 en altas nuevas.
    competencia_ids: list[int] | None = None

    @model_validator(mode="after")
    def normalize_legacy_competencia_ids(self) -> "PerfilCompetenciaSyncBody":
        if not self.competencias and self.competencia_ids:
            self.competencias = [
                PerfilCompetenciaSyncItem(competencia_id=cid, nivel_requerido=1)
                for cid in self.competencia_ids
            ]
        return self


class EvaluacionCompetenciaItem(BaseModel):
    competencia_requisito_id: int
    nivel: int = Field(..., ge=0, le=4)


class EvaluacionCompetenciaSyncBody(BaseModel):
    evaluaciones: list[EvaluacionCompetenciaItem]


# ── Tareas Extra (per-employee) ───────────────────────────────────────────────


class PerfilFuncionesTareaCreate(BaseModel):
    tarea_catalogo_id: int


class PerfilFuncionesTareaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    perfil_funciones_id: int
    tarea_catalogo_id: int
    tarea_catalogo_nombre: str = ""
    tarea_catalogo_categoria: Optional[str] = None
    created_at: datetime


# ── Respuesta compuesta (perfil completo de un puesto) ──────────────────────


class PerfilFuncionesCompletoResponse(BaseModel):
    """Respuesta con toda la informacion del perfil de funciones de un puesto."""

    model_config = {"from_attributes": True}

    # Datos del puesto
    id: int
    codigo: str
    nombre: str
    division: Optional[str] = None
    centro_leoni: Optional[str] = None
    form_version: Optional[str] = None
    reporta_a: Optional[str] = None
    ordenes_funcional_de: Optional[str] = None
    responsable_de: Optional[str] = None
    sustituye_a: Optional[str] = None
    sustituido_por: Optional[str] = None
    obligaciones_empresariales: Optional[bool] = None
    obligacion_confidencialidad: Optional[bool] = None
    poderes_legales: Optional[str] = None
    complemento_poderes: Optional[str] = None

    # Colecciones hijas
    tareas: list[PerfilTareaResponse] = []
    cualificaciones: list[PerfilCualificacionResponse] = []
    competencias_requeridas: list[PerfilCompetenciaResponse] = []
