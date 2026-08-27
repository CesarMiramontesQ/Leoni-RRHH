"""Schemas de Contratos (vencimientos del personal, caché de TRESS en Bono)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# Excluyentes entre sí: las tarjetas suman el total. La ventana N mueve gente entre
# `por_vencer` y `vigente`.
EstatusContrato = Literal["vencido", "por_vencer", "vigente", "indefinido", "sin_dato"]

ESTATUS_CONTRATO: tuple[EstatusContrato, ...] = (
    "vencido",
    "por_vencer",
    "vigente",
    "indefinido",
    "sin_dato",
)

VENTANA_DIAS_DEFAULT = 30
VENTANA_DIAS_MAX = 365


class ContratoEmpleadoItem(BaseModel):
    empleado_id: int
    no_empleado: int
    nombre: str
    area: str | None = None
    puesto: str | None = None
    supervisor: str | None = None
    contrato_codigo: str | None = None
    contrato_descripcion: str | None = None
    # 0 = indefinido; None = código sin catálogo.
    contrato_dias: int | None = None
    fecha_contrato: date | None = None
    fecha_vencimiento: date | None = None
    # Negativo cuando ya venció; None cuando no vence o no hay dato.
    dias_restantes: int | None = None
    estatus: EstatusContrato
    sincronizado_en: datetime | None = None


class ContratosListResponse(BaseModel):
    items: list[ContratoEmpleadoItem]
    total: int
    page: int
    page_size: int
    ventana_dias: int


class ContratosKpisResponse(BaseModel):
    vencidos: int = 0
    por_vencer: int = 0
    vigentes: int = 0
    indefinidos: int = 0
    sin_dato: int = 0
    total: int = 0
    ventana_dias: int = Field(default=VENTANA_DIAS_DEFAULT)


class ContratoAreaOption(BaseModel):
    area_id: int
    descripcion: str


class ContratoEmpleadoResumen(BaseModel):
    """Lo que ve la Vista 360: sin datos de área/puesto (ya están en la ficha)."""

    contrato_codigo: str | None = None
    contrato_descripcion: str | None = None
    contrato_dias: int | None = None
    fecha_contrato: date | None = None
    fecha_vencimiento: date | None = None
    dias_restantes: int | None = None
    estatus: EstatusContrato
    sincronizado_en: datetime | None = None
