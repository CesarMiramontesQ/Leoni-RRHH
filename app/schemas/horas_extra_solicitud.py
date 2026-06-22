"""Schemas para solicitudes de horas extra (supervisor)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.schemas.horas_extra_aprobacion import HorasExtraEstadoConsolidado

HorasExtraTipoSolicitud = Literal["planeado", "espontaneo"]
HorasExtraEstadoSolicitud = Literal[
    "borrador", "pendiente", "aprobado", "rechazado", "cancelado"
]


class HorasExtraEmpleadoOption(BaseModel):
    id: int
    no_empleado: int
    nombre: str
    centrocosto_id: Optional[int] = None
    area_id: Optional[int] = None
    subarea_id: Optional[int] = None
    area_descripcion: Optional[str] = None
    centrocosto_descripcion: Optional[str] = None
    turno: Optional[str] = None


class HorasExtraSolicitudOpcionesResponse(BaseModel):
    empleados: list[HorasExtraEmpleadoOption]
    semana_actual: int = Field(ge=1, le=53)


class HorasExtraDetalleCreate(BaseModel):
    empleado_id: int
    lunes: Decimal = Field(default=Decimal("0"), ge=0)
    martes: Decimal = Field(default=Decimal("0"), ge=0)
    miercoles: Decimal = Field(default=Decimal("0"), ge=0)
    jueves: Decimal = Field(default=Decimal("0"), ge=0)
    viernes: Decimal = Field(default=Decimal("0"), ge=0)
    sabado: Decimal = Field(default=Decimal("0"), ge=0)
    domingo: Decimal = Field(default=Decimal("0"), ge=0)


class HorasExtraSolicitudCreate(BaseModel):
    semana: int = Field(ge=1, le=53)
    tipo: HorasExtraTipoSolicitud
    motivo: str = Field(min_length=1, max_length=500)
    empleados: list[HorasExtraDetalleCreate] = Field(min_length=1)

    @field_validator("motivo")
    @classmethod
    def strip_motivo(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("El motivo es obligatorio.")
        return stripped


class HorasExtraDetalleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empleado_id: int
    no_empleado: int
    nombre_empleado: str
    lunes: Decimal
    martes: Decimal
    miercoles: Decimal
    jueves: Decimal
    viernes: Decimal
    sabado: Decimal
    domingo: Decimal
    total_horas: Decimal

    @field_serializer(
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo",
        "total_horas",
    )
    def _serialize_horas(self, value: Decimal) -> float:
        return float(value)


class HorasExtraSolicitudResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_solicitud: date
    semana: int
    semana_inicio: date
    tipo: HorasExtraTipoSolicitud
    area_id: int
    area_descripcion: str
    subarea_id: int
    subarea_descripcion: str
    centrocosto_id: int
    centrocosto_descripcion: str
    motivo_id: int
    motivo_descripcion: str
    comentarios: Optional[str] = None
    estado: HorasExtraEstadoSolicitud
    estado_consolidado: HorasExtraEstadoConsolidado
    total_horas_general: Decimal
    total_empleados: int
    created_at: datetime
    detalle: list[HorasExtraDetalleResponse]

    @field_serializer("total_horas_general")
    def _serialize_total_general(self, value: Decimal) -> float:
        return float(value)


class HorasExtraSolicitudListItem(BaseModel):
    id: int
    fecha_solicitud: date
    semana: int
    semana_inicio: date
    area_descripcion: str
    tipo: HorasExtraTipoSolicitud
    total_horas_general: Decimal
    estado: HorasExtraEstadoSolicitud
    estado_consolidado: HorasExtraEstadoConsolidado
    created_at: datetime

    @field_serializer("total_horas_general")
    def _serialize_total_general(self, value: Decimal) -> float:
        return float(value)


class HorasExtraSolicitudListResponse(BaseModel):
    items: list[HorasExtraSolicitudListItem]
    total: int
    page: int
    page_size: int


class HorasExtraSolicitudEstadisticasResponse(BaseModel):
    total_solicitudes: int = Field(ge=0)
    pendientes: int = Field(ge=0)
    aprobadas: int = Field(ge=0)
    total_horas: Decimal = Field(ge=0)

    @field_serializer("total_horas")
    def _serialize_total_horas(self, value: Decimal) -> float:
        return float(value)
