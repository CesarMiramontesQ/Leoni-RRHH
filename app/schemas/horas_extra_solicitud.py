"""Schemas para solicitudes de horas extra (supervisor)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

HorasExtraTipoSolicitud = Literal["planeado", "espontaneo"]
HorasExtraEstadoSolicitud = Literal[
    "borrador", "pendiente", "aprobado", "rechazado", "cancelado"
]


class HorasExtraCatalogoOption(BaseModel):
    id: int
    label: str


class HorasExtraSubareaOption(BaseModel):
    id: int
    label: str
    area_id: int


class HorasExtraEmpleadoOption(BaseModel):
    id: int
    no_empleado: str
    nombre: str
    centrocosto_id: Optional[int] = None


class HorasExtraSolicitudOpcionesResponse(BaseModel):
    departamentos: list[HorasExtraCatalogoOption]
    areas: list[HorasExtraCatalogoOption]
    subareas: list[HorasExtraSubareaOption]
    centros_costo: list[HorasExtraCatalogoOption]
    motivos: list[HorasExtraCatalogoOption]
    empleados: list[HorasExtraEmpleadoOption]


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
    fecha_solicitud: date
    semana_inicio: date
    tipo: HorasExtraTipoSolicitud
    departamento_id: int
    area_id: int
    subarea_id: int
    centrocosto_id: int
    motivo_id: int
    comentarios: Optional[str] = None
    empleados: list[HorasExtraDetalleCreate] = Field(min_length=1)

    @field_validator("comentarios")
    @classmethod
    def strip_comentarios(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None


class HorasExtraDetalleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empleado_id: int
    no_empleado: str
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
    semana_inicio: date
    tipo: HorasExtraTipoSolicitud
    departamento_id: int
    departamento_nombre: str
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
    semana_inicio: date
    departamento_nombre: str
    area_descripcion: str
    tipo: HorasExtraTipoSolicitud
    total_horas_general: Decimal
    estado: HorasExtraEstadoSolicitud
    created_at: datetime

    @field_serializer("total_horas_general")
    def _serialize_total_general(self, value: Decimal) -> float:
        return float(value)


class HorasExtraSolicitudListResponse(BaseModel):
    items: list[HorasExtraSolicitudListItem]
    total: int
    page: int
    page_size: int
