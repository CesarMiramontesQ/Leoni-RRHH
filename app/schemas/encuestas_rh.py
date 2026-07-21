# app/schemas/encuestas_rh.py
"""Schemas Pydantic v2 para el modulo de Encuestas RH (Level Up).

Cubre: CRUD de encuesta/preguntas/opciones, audiencia (filtros/preview),
publicacion, respuesta (con anonimato) y plantillas. Los resultados agregados
(reportes por segmento) se agregan en una tarea posterior.

Los valores validos de `tipo`/`estado`/`tipo` de pregunta se validan contra las
constantes definidas en `app/models/encuestas_rh.py` (fuente unica de verdad,
no se duplican como Literal aqui).
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.encuestas_rh import (
    ENCUESTA_PARTICIPANTE_ESTADOS,
    ENCUESTA_PREGUNTA_TIPOS,
    ENCUESTA_TIPOS,
)


def _validar_pertenece(valor: str, valores_validos: tuple, campo: str) -> str:
    if valor not in valores_validos:
        raise ValueError(f"{campo} invalido: {valor!r} (validos: {', '.join(valores_validos)})")
    return valor


# ── Opciones ────────────────────────────────────────────────────────────────


class OpcionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    texto: str = Field(..., min_length=1, max_length=255)
    orden: Optional[int] = None


class OpcionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    texto: str
    orden: Optional[int] = None


# ── Preguntas ───────────────────────────────────────────────────────────────


class PreguntaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: int
    tipo: str
    texto: str = Field(..., min_length=1)
    requerida: bool = True
    seleccion_multiple: bool = False
    opciones: list[OpcionCreate] = Field(default_factory=list)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v: str) -> str:
        return _validar_pertenece(v, ENCUESTA_PREGUNTA_TIPOS, "tipo de pregunta")


class PreguntaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: Optional[int] = None
    tipo: Optional[str] = None
    texto: Optional[str] = Field(None, min_length=1)
    requerida: Optional[bool] = None
    seleccion_multiple: Optional[bool] = None
    # Si se envia, reemplaza por completo las opciones existentes.
    opciones: Optional[list[OpcionCreate]] = None

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, ENCUESTA_PREGUNTA_TIPOS, "tipo de pregunta")


class PreguntaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    orden: int
    tipo: str
    texto: str
    requerida: bool
    seleccion_multiple: bool
    opciones: list[OpcionResponse] = Field(default_factory=list)


# ── Encuesta ──────────────────────────────────────────────────────────────


class EncuestaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    titulo: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    tipo: str = "otra"
    es_anonima: bool
    umbral_minimo_respuestas: int = Field(5, ge=1)
    recordatorio_cada_dias: int = Field(3, ge=1)
    # Nullable a nivel esquema/BD (ver app/models/encuestas_rh.py); el service
    # exige que venga poblado como regla de negocio al crear.
    creado_por_id: Optional[int] = None
    preguntas: list[PreguntaCreate] = Field(default_factory=list)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v: str) -> str:
        return _validar_pertenece(v, ENCUESTA_TIPOS, "tipo de encuesta")


class EncuestaUpdate(BaseModel):
    """Actualizacion parcial. En estado `publicada` el service solo permite
    `titulo`, `descripcion` y extender `fecha_cierre_programada`."""

    model_config = {"str_strip_whitespace": True}

    titulo: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    es_anonima: Optional[bool] = None
    umbral_minimo_respuestas: Optional[int] = Field(None, ge=1)
    recordatorio_cada_dias: Optional[int] = Field(None, ge=1)
    fecha_cierre_programada: Optional[date] = None

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, ENCUESTA_TIPOS, "tipo de encuesta")


class EncuestaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    es_anonima: bool
    umbral_minimo_respuestas: int
    estado: str
    fecha_publicacion: Optional[datetime] = None
    fecha_cierre_programada: Optional[date] = None
    fecha_cierre_real: Optional[datetime] = None
    audiencia_criterios: Optional[dict] = None
    recordatorio_cada_dias: int
    creado_por_id: Optional[int] = None
    created_at: datetime
    preguntas: list[PreguntaResponse] = Field(default_factory=list)


# ── Audiencia ────────────────────────────────────────────────────────────


class AudienciaFiltros(BaseModel):
    """Filtros de segmentacion de audiencia. Lista vacia = sin restriccion en
    esa dimension. Combinacion AND entre dimensiones."""

    areas: list[int] = Field(default_factory=list)
    turnos: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)


class AudienciaAreaConteo(BaseModel):
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    total: int


class AudienciaTurnoConteo(BaseModel):
    turno: Optional[str] = None
    total: int


class AudienciaPreview(BaseModel):
    total: int
    por_area: list[AudienciaAreaConteo] = Field(default_factory=list)
    por_turno: list[AudienciaTurnoConteo] = Field(default_factory=list)


class PublicarRequest(BaseModel):
    filtros: AudienciaFiltros = Field(default_factory=AudienciaFiltros)
    fecha_cierre_programada: date


# ── Responder ────────────────────────────────────────────────────────────


class ResponderItem(BaseModel):
    pregunta_id: int
    # Sin ge/le aqui a proposito: el rango 1..5 es una regla de negocio que
    # valida el service (DomainValidationError), no un 422 de Pydantic.
    valor_likert: Optional[int] = None
    texto: Optional[str] = None
    opcion_ids: Optional[list[int]] = None


class ResponderRequest(BaseModel):
    respuestas: list[ResponderItem] = Field(default_factory=list)


# ── Mis encuestas ────────────────────────────────────────────────────────


class MiEncuestaItem(BaseModel):
    encuesta_id: int
    titulo: str
    tipo: str
    estado: str
    participante_estado: str
    fecha_respuesta: Optional[datetime] = None
    fecha_cierre_programada: Optional[date] = None
    es_anonima: bool

    @field_validator("participante_estado")
    @classmethod
    def _participante_estado_valido(cls, v: str) -> str:
        return _validar_pertenece(v, ENCUESTA_PARTICIPANTE_ESTADOS, "estado de participante")


class ParticipanteItem(BaseModel):
    """Para el listado RH — nunca incluye respuestas individuales."""

    empleado_id: int
    empleado_nombre: Optional[str] = None
    estado: str
    fecha_respuesta: Optional[datetime] = None


# ── Preguntas: reordenar (Tarea 3) ───────────────────────────────────────


class ReordenarPreguntasRequest(BaseModel):
    """Lista de ids de pregunta en el nuevo orden deseado (debe cubrir
    exactamente todas las preguntas de la encuesta)."""

    pregunta_ids: list[int] = Field(..., min_length=1)


# ── Plantillas ───────────────────────────────────────────────────────────


class PlantillaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    es_predefinida: bool
    definicion: list[dict]


class CrearDesdeplantillaRequest(BaseModel):
    """`es_anonima` es explicito y obligatorio (decision de revision Tarea 2:
    no depender del default silencioso `True` del service)."""

    es_anonima: bool
