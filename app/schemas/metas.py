# app/schemas/metas.py
"""Schemas Pydantic v2 para el modulo de Metas (OKR ligero).

Cubre: ciclos, metas (individual/equipo), resultados clave y check-ins.
Los valores validos de `estado`/`nivel`/`tipo_metrica`/`direccion` se validan
contra las constantes definidas en `app/models/metas.py` (fuente unica de
verdad, no se duplican como Literal aqui) — mismo patron que
`app/schemas/encuestas_rh.py`.

Reglas de negocio que NO se validan aqui (a proposito, van en el service como
`DomainValidationError`, igual que en encuestas_rh): rango de `calificacion`
en `cerrar_meta` (el metodo recibe el valor suelto, no un schema), fechas de
ciclo, y las reglas cruzadas de `nivel`/`empleado_id`/`area_id`/`lider_id`/
`meta_padre_id`.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.metas import (
    META_NIVELES,
    RC_DIRECCIONES,
    RC_TIPOS_METRICA,
)


def _validar_pertenece(valor: str, valores_validos: tuple, campo: str) -> str:
    if valor not in valores_validos:
        raise ValueError(f"{campo} invalido: {valor!r} (validos: {', '.join(valores_validos)})")
    return valor


# ── Ciclo ────────────────────────────────────────────────────────────────


class MetaCicloCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    creado_por_id: Optional[int] = None


class MetaCicloUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None


class MetaCicloResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    estado: str
    creado_por_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# ── Resultado clave ──────────────────────────────────────────────────────


class ResultadoClaveCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: int = 1
    titulo: str = Field(..., min_length=1, max_length=255)
    tipo_metrica: str
    unidad: Optional[str] = None
    direccion: str
    valor_inicial: Decimal
    valor_objetivo: Decimal
    # Si no viene, el service la inicializa igual a valor_inicial.
    valor_actual: Optional[Decimal] = None

    @field_validator("tipo_metrica")
    @classmethod
    def _tipo_metrica_valida(cls, v: str) -> str:
        return _validar_pertenece(v, RC_TIPOS_METRICA, "tipo_metrica")

    @field_validator("direccion")
    @classmethod
    def _direccion_valida(cls, v: str) -> str:
        return _validar_pertenece(v, RC_DIRECCIONES, "direccion")


class ResultadoClaveUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    orden: Optional[int] = None
    titulo: Optional[str] = Field(None, min_length=1, max_length=255)
    unidad: Optional[str] = None
    valor_objetivo: Optional[Decimal] = None


class ResultadoClaveResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    meta_id: int
    orden: int
    titulo: str
    tipo_metrica: str
    unidad: Optional[str] = None
    direccion: str
    valor_inicial: Decimal
    valor_objetivo: Decimal
    valor_actual: Decimal
    # Derivado, no persistido (ver MetaResultadoClave en app/models/metas.py).
    avance: float = 0.0


# ── Check-in ─────────────────────────────────────────────────────────────


class CheckinResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    resultado_clave_id: int
    autor_id: int
    valor_registrado: Decimal
    nota: Optional[str] = None
    es_ajuste_jefe: bool
    created_at: datetime
    # Avance % del resultado clave luego de aplicar este check-in.
    avance_resultante: float = 0.0


# ── Meta ─────────────────────────────────────────────────────────────────


class MetaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    ciclo_id: int
    nivel: str
    empleado_id: Optional[int] = None
    area_id: Optional[int] = None
    lider_id: Optional[int] = None
    titulo: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    peso: Decimal = Field(..., ge=0, le=100)
    meta_padre_id: Optional[int] = None
    asignada_por_id: int
    resultados_clave: list[ResultadoClaveCreate] = Field(default_factory=list)

    @field_validator("nivel")
    @classmethod
    def _nivel_valido(cls, v: str) -> str:
        return _validar_pertenece(v, META_NIVELES, "nivel")


class MetaUpdate(BaseModel):
    """Actualizacion parcial. `nivel` no es editable en el MVP (ver spec)."""

    model_config = {"str_strip_whitespace": True}

    titulo: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    peso: Optional[Decimal] = Field(None, ge=0, le=100)
    meta_padre_id: Optional[int] = None
    empleado_id: Optional[int] = None
    area_id: Optional[int] = None
    lider_id: Optional[int] = None


class MetaFiltros(BaseModel):
    ciclo_id: Optional[int] = None
    empleado_id: Optional[int] = None
    nivel: Optional[str] = None

    @field_validator("nivel")
    @classmethod
    def _nivel_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, META_NIVELES, "nivel")


class MetaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    ciclo_id: int
    nivel: str
    empleado_id: Optional[int] = None
    area_id: Optional[int] = None
    lider_id: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    peso: Decimal
    estado: str
    meta_padre_id: Optional[int] = None
    asignada_por_id: int
    calificacion_cierre: Optional[Decimal] = None
    comentario_cierre: Optional[str] = None
    # Derivado (promedio de resultados_clave, o roll-up de submetas si es
    # meta de equipo sin resultados clave propios) — ver MetasService.avance_meta.
    avance: float = 0.0
    resultados_clave: list[ResultadoClaveResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CerrarMetaRequest(BaseModel):
    """Body para el futuro endpoint `POST /metas/{id}/cerrar` (Tarea 3).
    `MetasService.cerrar_meta` recibe los valores sueltos, no este schema."""

    calificacion: Decimal = Field(..., ge=0, le=100)
    comentario: Optional[str] = None


# ── Cumplimiento ─────────────────────────────────────────────────────────


class CumplimientoResponse(BaseModel):
    ciclo_id: int
    empleado_id: int
    cumplimiento: float
    metas_consideradas: int


# ── Tablero de equipo (Tarea 4) ───────────────────────────────────────────


class EquipoAvanceMiembro(BaseModel):
    """Un miembro del equipo (reporte directo del jefe) con sus metas
    individuales del ciclo y su avance global derivado (ver
    `MetasService.construir_equipo_avance`)."""

    empleado_id: int
    empleado_nombre: Optional[str] = None
    metas: list[MetaResponse] = Field(default_factory=list)
    # Promedio ponderado por `peso` del `avance` (derivado, no la
    # calificacion de cierre) de las metas individuales del empleado en el
    # ciclo. Sin metas -> 0.0. Senal de SEGUIMIENTO durante el ciclo; el
    # cumplimiento oficial (ponderado por calificacion) sigue siendo
    # `CumplimientoResponse`/`cumplimiento_empleado`, solo disponible tras
    # el cierre de cada meta.
    avance_global: float = 0.0


class EquipoAvanceResponse(BaseModel):
    """Tablero de avance del equipo del jefe (o del ciclo completo si RH
    global) para `GET /equipo/avance`. Las metas de nivel "equipo" (lider_id,
    sin empleado_id) van aparte en `metas_equipo` — no son de "un miembro"."""

    ciclo_id: int
    miembros: list[EquipoAvanceMiembro] = Field(default_factory=list)
    metas_equipo: list[MetaResponse] = Field(default_factory=list)


# ── Recordatorios (Tarea 5) ────────────────────────────────────────────────


class RecordatoriosResultado(BaseModel):
    """Resumen de `MetasService.procesar_recordatorios` (job diario)."""

    notificados: int
    ciclos_por_cerrar: int


class ForzarRecordatoriosResponse(BaseModel):
    """Respuesta de `POST /ciclos/{ciclo_id}/recordatorios` (endpoint manual):
    fuerza un recordatorio a todos los empleados con metas individuales
    pendientes (no cerradas) del ciclo, sin importar la cadencia de
    `procesar_recordatorios`."""

    notificados: int
