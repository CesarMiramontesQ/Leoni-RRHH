from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.models.viajes_laborales import VIAJE_LABORAL_ESTADOS

ViajeLaboralEstado = Literal[
    "borrador",
    "pendiente",
    "aprobado",
    "rechazado",
    "cancelado",
]

VIAJE_LABORAL_ESTADO_LABELS: dict[str, str] = {
    "borrador": "Borrador",
    "pendiente": "Pendiente",
    "aprobado": "Aprobado",
    "rechazado": "Rechazado",
    "cancelado": "Cancelado",
}


class ViajeLaboralCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int = Field(..., gt=0)
    fecha_salida: date
    fecha_regreso: date
    lugar_origen: str = Field(..., min_length=1, max_length=255)
    lugar_destino: str = Field(..., min_length=1, max_length=255)
    motivo: str = Field(..., min_length=1, max_length=4000)
    descripcion: Optional[str] = Field(None, max_length=4000)
    medio_transporte: str = Field(..., min_length=1, max_length=120)
    hospedaje: Optional[str] = Field(None, max_length=255)
    viaticos_estimados: Optional[Decimal] = Field(None, ge=0)

    @model_validator(mode="after")
    def validate_fechas(self) -> "ViajeLaboralCreate":
        if self.fecha_regreso < self.fecha_salida:
            raise ValueError("fecha_regreso no puede ser anterior a fecha_salida")
        return self


class ViajeLaboralUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: Optional[int] = Field(None, gt=0)
    fecha_salida: Optional[date] = None
    fecha_regreso: Optional[date] = None
    lugar_origen: Optional[str] = Field(None, min_length=1, max_length=255)
    lugar_destino: Optional[str] = Field(None, min_length=1, max_length=255)
    motivo: Optional[str] = Field(None, min_length=1, max_length=4000)
    descripcion: Optional[str] = Field(None, max_length=4000)
    medio_transporte: Optional[str] = Field(None, min_length=1, max_length=120)
    hospedaje: Optional[str] = Field(None, max_length=255)
    viaticos_estimados: Optional[Decimal] = Field(None, ge=0)

    @model_validator(mode="after")
    def validate_fechas(self) -> "ViajeLaboralUpdate":
        if (
            self.fecha_salida is not None
            and self.fecha_regreso is not None
            and self.fecha_regreso < self.fecha_salida
        ):
            raise ValueError("fecha_regreso no puede ser anterior a fecha_salida")
        return self


class ViajeLaboralRechazarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    motivo_rechazo: str = Field(..., min_length=1, max_length=4000)


class ViajeLaboralResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    numero_empleado: Optional[str] = None
    fecha_salida: date
    fecha_regreso: date
    lugar_origen: str
    lugar_destino: str
    motivo: str
    descripcion: Optional[str] = None
    medio_transporte: str
    hospedaje: Optional[str] = None
    viaticos_estimados: Optional[Decimal] = None
    estado: ViajeLaboralEstado
    registrado_por_id: int
    registrado_por_nombre: Optional[str] = None
    aprobado_por_id: Optional[int] = None
    aprobado_por_nombre: Optional[str] = None
    motivo_rechazo: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ViajesLaboralesPageResponse(BaseModel):
    items: list[ViajeLaboralResponse]
    total: int
    page: int
    page_size: int


class ViajeLaboralEstadoItem(BaseModel):
    value: ViajeLaboralEstado
    label: str


class ViajesLaboralesEstadosResponse(BaseModel):
    items: list[ViajeLaboralEstadoItem]


class ViajesLaboralesEstadisticasResponse(BaseModel):
    total: int
    pendientes: int
    aprobados: int
    cancelados: int


def list_estado_items() -> list[ViajeLaboralEstadoItem]:
    return [
        ViajeLaboralEstadoItem(value=estado, label=VIAJE_LABORAL_ESTADO_LABELS[estado])  # type: ignore[arg-type]
        for estado in VIAJE_LABORAL_ESTADOS
    ]
