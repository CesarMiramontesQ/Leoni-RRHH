"""Schemas para Ajustes de Nóminas (autorización de registro de horas extra)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

HorasExtraAutorizadosFiltro = Literal["todos", "autorizados", "no_autorizados"]


class HorasExtraAutorizadoItem(BaseModel):
    id: int
    no_empleado: str
    nombre: str
    rol: str
    area_descripcion: Optional[str] = None
    puesto_descripcion: Optional[str] = None
    autorizado: bool


class HorasExtraAutorizadosListResponse(BaseModel):
    items: list[HorasExtraAutorizadoItem]
    total: int
    page: int
    page_size: int
    total_autorizados: int


class HorasExtraAutorizacionUpdate(BaseModel):
    empleado_ids: list[int] = Field(min_length=1)
    autorizado: bool


class HorasExtraAutorizacionUpdateResponse(BaseModel):
    actualizados: int
    total_autorizados: int
