# app/schemas/perfil_funciones.py
"""
Schemas Pydantic v2 para Perfil de Funciones.
Tareas, Cualificaciones, Competencias Requeridas y Asignaciones individuales.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


# ── Tipos enumerados ────────────────────────────────────────────────────────

DivisionType = Literal["holding", "wsd", "wcs"]

TipoCualificacion = Literal[
    "estudios_finalizados",
    "formacion_profesional",
    "ampliacion_formacion",
    "estudios_universitarios",
    "experiencia_profesional",
    "experiencia_direccion",
    "complementos",
]

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


# ── Perfil Tareas ───────────────────────────────────────────────────────────


class PerfilTareaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: int = Field(..., ge=1)
    descripcion: str = Field(..., min_length=1)
    es_complemento: bool = False


class PerfilTareaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: Optional[int] = Field(None, ge=1)
    descripcion: Optional[str] = Field(None, min_length=1)
    es_complemento: Optional[bool] = None


class PerfilTareaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    orden: int
    descripcion: str
    es_complemento: bool
    created_at: datetime
    updated_at: datetime


# ── Perfil Cualificaciones ──────────────────────────────────────────────────


class PerfilCualificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: TipoCualificacion
    situacion_deseada: str = Field(..., min_length=1)
    comentarios: Optional[str] = None


class PerfilCualificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: Optional[TipoCualificacion] = None
    situacion_deseada: Optional[str] = Field(None, min_length=1)
    comentarios: Optional[str] = None


class PerfilCualificacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    tipo: str
    situacion_deseada: str
    comentarios: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Perfil Competencias Requeridas ──────────────────────────────────────────


class PerfilCompetenciaRequeridaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    competencia_id: Optional[int] = None
    categoria: CategoriaCompetenciaRequerida
    descripcion: Optional[str] = Field(None, min_length=1)
    orden: int = Field(..., ge=1)

    @model_validator(mode="after")
    def require_competencia_or_descripcion(self) -> "PerfilCompetenciaRequeridaCreate":
        if self.competencia_id is None and not self.descripcion:
            raise ValueError("Se requiere competencia_id o descripcion")
        return self


class PerfilCompetenciaRequeridaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    categoria: Optional[CategoriaCompetenciaRequerida] = None
    descripcion: Optional[str] = Field(None, min_length=1)
    orden: Optional[int] = Field(None, ge=1)


class PerfilCompetenciaRequeridaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    puesto_perfil_id: int
    competencia_id: Optional[int] = None
    competencia_nombre: Optional[str] = None
    categoria: str
    descripcion: str
    orden: int
    created_at: datetime
    updated_at: datetime


# ── Perfil Funciones (asignacion individual) ────────────────────────────────


class PerfilFuncionesCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    puesto_perfil_id: int
    empleado_id: int
    departamento: Optional[str] = Field(None, max_length=200)
    fecha_firma_superior: Optional[date] = None
    fecha_firma_empleado: Optional[date] = None
    firma_superior_id: Optional[str] = Field(None, max_length=50)
    firma_empleado_id: Optional[str] = Field(None, max_length=50)


class PerfilFuncionesUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

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
    nombre_empleado: Optional[str] = None
    no_empleado: Optional[str] = None
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
    situacion_actual: str = Field(..., min_length=1)
    comentarios: Optional[str] = None


class PerfilFuncionesCualificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    situacion_actual: Optional[str] = Field(None, min_length=1)
    comentarios: Optional[str] = None


class PerfilFuncionesCualificacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    perfil_funciones_id: int
    cualificacion_id: int
    situacion_actual: str
    comentarios: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Perfil Funciones Competencia (evaluacion individual) ────────────────────


class PerfilFuncionesCompetenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    competencia_requerida_id: int
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
    competencia_requerida_id: int
    situacion_actual: str
    comentarios: Optional[str] = None
    created_at: datetime
    updated_at: datetime


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
    competencias_requeridas: list[PerfilCompetenciaRequeridaResponse] = []
