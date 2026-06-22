"""Schemas para Ajustes de Nóminas (autorización de registro de horas extra)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

HorasExtraAutorizadosFiltro = Literal["todos", "autorizados", "no_autorizados"]


class HorasExtraAutorizadoItem(BaseModel):
    id: int
    no_empleado: int
    nombre: str
    rol: str
    email: Optional[str] = None
    area_descripcion: Optional[str] = None
    puesto_descripcion: Optional[str] = None
    autorizado: bool
    fecha_autorizacion: Optional[datetime] = None
    autorizado_por: Optional[str] = None


class HorasExtraAutorizadosStats(BaseModel):
    total_autorizados: int
    autorizaciones_activas: int
    sin_autorizacion: int
    autorizaciones_recientes: int
    solicitudes_pendientes: int


class HorasExtraAutorizadosListResponse(BaseModel):
    items: list[HorasExtraAutorizadoItem]
    total: int
    page: int
    page_size: int
    stats: HorasExtraAutorizadosStats


class HorasExtraAutorizacionUpdate(BaseModel):
    empleado_ids: list[int] = Field(min_length=1)
    autorizado: bool


class HorasExtraAutorizacionUpdateResponse(BaseModel):
    actualizados: int
    stats: HorasExtraAutorizadosStats


# ── Aprobadores de horas extra (gerentes regionales / director) ──

HorasExtraAprobadorTipo = Literal["gerente_regional", "director"]


class HorasExtraAprobadorItem(BaseModel):
    id: int
    empleado_id: int
    no_empleado: int
    nombre: str
    email: Optional[str] = None
    area_descripcion: Optional[str] = None
    puesto_descripcion: Optional[str] = None
    tipo: HorasExtraAprobadorTipo
    activo: bool
    created_at: datetime


class HorasExtraAprobadoresListResponse(BaseModel):
    gerentes: list[HorasExtraAprobadorItem]
    directores: list[HorasExtraAprobadorItem]


class HorasExtraAprobadoresCreate(BaseModel):
    tipo: HorasExtraAprobadorTipo
    empleado_ids: list[int] = Field(min_length=1)


class HorasExtraAprobadorUpdate(BaseModel):
    activo: bool
