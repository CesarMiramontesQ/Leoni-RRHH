# app/schemas/cualificaciones_catalogo.py
"""Schemas Pydantic para el catálogo configurable de cualificaciones."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator

MetodoCalificacionTipo = Literal[
    "lista_ordenada",
    "escala_numerica",
    "si_no",
    "anios_experiencia",
    "nivel_dominio",
    "seleccion_simple",
    "seleccion_multiple",
    "texto_libre",
]

ComparadorTipo = Literal[
    "ordinal_gte",
    "numeric_gte",
    "numeric_range",
    "exact",
    "boolean_yes",
    "set_superset",
    "none",
]

TIPOS_REQUIEREN_OPCIONES = frozenset({
    "lista_ordenada",
    "si_no",
    "nivel_dominio",
    "seleccion_simple",
    "seleccion_multiple",
})


class MetodoCalificacionConfig(BaseModel):
    comparador: ComparadorTipo = "none"
    permite_na: bool = True
    requiere_opciones: bool = False
    captura: dict[str, Any] = Field(default_factory=lambda: {"campos": ["texto"], "anios_habilitado": False})


# ── Tipos de cualificación ──────────────────────────────────────────────────


class TipoCualificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None
    metodo_calificacion_id: int = Field(..., gt=0, description="Método de evaluación asociado al tipo")


class TipoCualificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    metodo_calificacion_id: Optional[int] = Field(None, gt=0)
    activo: Optional[bool] = None


class TipoCualificacionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    descripcion: Optional[str] = None
    activo: bool
    metodo_calificacion_id: Optional[int] = None
    metodo_nombre: str = ""
    metodo_tipo: str = ""
    metodo_config: dict[str, Any] = Field(default_factory=dict)
    opciones: list["OpcionCalificacionResponse"] = Field(default_factory=list)
    cualificacion_catalogo_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TipoCualificacionListResponse(BaseModel):
    items: list[TipoCualificacionResponse]
    total: int
    page: int
    page_size: int


# ── Opciones de calificación ────────────────────────────────────────────────


class OpcionCalificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    etiqueta: str = Field(..., min_length=1, max_length=200)
    valor: str = Field(..., min_length=1, max_length=100)
    orden: int = Field(0, ge=0)
    peso: Optional[int] = None


class OpcionCalificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    etiqueta: Optional[str] = Field(None, min_length=1, max_length=200)
    valor: Optional[str] = Field(None, min_length=1, max_length=100)
    orden: Optional[int] = Field(None, ge=0)
    peso: Optional[int] = None
    activo: Optional[bool] = None


class OpcionCalificacionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    metodo_calificacion_id: int
    etiqueta: str
    valor: str
    orden: int
    peso: Optional[int] = None
    activo: bool


# ── Métodos de calificación ─────────────────────────────────────────────────


class MetodoCalificacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: str = Field(..., min_length=2, max_length=100)
    tipo: MetodoCalificacionTipo
    descripcion: Optional[str] = None
    config: MetodoCalificacionConfig = Field(default_factory=MetodoCalificacionConfig)


class MetodoCalificacionUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    tipo: Optional[MetodoCalificacionTipo] = None
    descripcion: Optional[str] = None
    config: Optional[MetodoCalificacionConfig] = None
    activo: Optional[bool] = None


class MetodoCalificacionResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str
    tipo: str
    descripcion: Optional[str] = None
    config: dict[str, Any]
    activo: bool
    created_at: datetime
    updated_at: datetime
    opciones: list[OpcionCalificacionResponse] = Field(default_factory=list)


class MetodoCalificacionListResponse(BaseModel):
    items: list[MetodoCalificacionResponse]
    total: int
    page: int
    page_size: int


# ── Cualificaciones del catálogo ────────────────────────────────────────────


class CualificacionCatalogoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    tipo_cualificacion_id: int
    metodo_calificacion_id: int
    nombre: str = Field(..., min_length=2, max_length=200)
    descripcion: Optional[str] = None
    obligatorio: bool = True


class CualificacionCatalogoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    tipo_cualificacion_id: Optional[int] = None
    metodo_calificacion_id: Optional[int] = None
    nombre: Optional[str] = Field(None, min_length=2, max_length=200)
    descripcion: Optional[str] = None
    obligatorio: Optional[bool] = None
    activo: Optional[bool] = None


class CualificacionCatalogoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo_cualificacion_id: int
    tipo_nombre: str = ""
    metodo_calificacion_id: int
    metodo_nombre: str = ""
    metodo_tipo: str = ""
    metodo_config: dict[str, Any] = Field(default_factory=dict)
    nombre: str
    descripcion: Optional[str] = None
    obligatorio: bool
    activo: bool
    opciones: list[OpcionCalificacionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CualificacionCatalogoListResponse(BaseModel):
    items: list[CualificacionCatalogoResponse]
    total: int
    page: int
    page_size: int


class CatalogoCompletoResponse(BaseModel):
    tipos: list[TipoCualificacionResponse]
    metodos: list[MetodoCalificacionResponse]
    cualificaciones: list[CualificacionCatalogoResponse]


def validar_criterio_requerido(config: dict, criterio: dict) -> None:
    comparador = config.get("comparador", "none")
    if criterio.get("na"):
        return
    if comparador == "ordinal_gte" and not criterio.get("opcion_valor") and not criterio.get("texto"):
        raise ValueError("Se requiere opcion_valor o texto en criterio_requerido")
    if comparador == "numeric_gte" and criterio.get("min_anios") is None and not criterio.get("texto"):
        raise ValueError("Se requiere min_anios o texto en criterio_requerido")
    if comparador == "boolean_yes" and not criterio.get("opcion_valor") and not criterio.get("texto"):
        raise ValueError("Se requiere opcion_valor o texto en criterio_requerido")
    if comparador == "exact" and not criterio.get("opcion_valor") and not criterio.get("texto"):
        raise ValueError("Se requiere opcion_valor o texto en criterio_requerido")
    if comparador == "set_superset" and not criterio.get("opciones_valor"):
        raise ValueError("Se requiere opciones_valor en criterio_requerido")
    if comparador == "none" and not criterio.get("texto"):
        raise ValueError("Se requiere texto en criterio_requerido")


def validar_valor_capturado(config: dict, valor: dict) -> None:
    comparador = config.get("comparador", "none")
    if valor.get("na"):
        return
    captura = config.get("captura", {})
    campos = captura.get("campos", ["texto"])
    if comparador == "none":
        if not valor.get("texto"):
            raise ValueError("Se requiere texto en valor_capturado")
        return
    if "opcion" in campos and comparador in ("ordinal_gte", "boolean_yes", "exact"):
        if not valor.get("opcion_valor") and not valor.get("texto"):
            raise ValueError("Se requiere opcion_valor en valor_capturado")
    if captura.get("anios_habilitado") and comparador == "numeric_gte":
        if valor.get("anios") is None and not valor.get("texto"):
            raise ValueError("Se requiere anios en valor_capturado")


class CriterioRequeridoPayload(BaseModel):
    criterio_requerido: dict[str, Any]

    @model_validator(mode="after")
    def _no_vacio(self) -> "CriterioRequeridoPayload":
        if not self.criterio_requerido:
            raise ValueError("criterio_requerido no puede estar vacío")
        return self
