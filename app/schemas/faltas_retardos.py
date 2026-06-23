from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS, FALTA_RETARDO_TIPOS_RANGO

FaltaRetardoTipo = Literal[
    "falta_justificada",
    "falta_injustificada",
    "retardo",
    "incapacidad",
    "suspension",
]


class FaltaRetardoCreateRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int = Field(..., gt=0)
    tipo: FaltaRetardoTipo
    fecha_evento: date
    fecha_fin: Optional[date] = None
    observaciones: Optional[str] = Field(None, max_length=4000)

    @field_validator("tipo")
    @classmethod
    def validate_tipo(cls, value: str) -> str:
        if value not in FALTA_RETARDO_TIPOS:
            raise ValueError(f"Tipo inválido. Valores permitidos: {', '.join(FALTA_RETARDO_TIPOS)}")
        return value

    @model_validator(mode="after")
    def validate_fechas(self) -> "FaltaRetardoCreateRequest":
        if self.tipo in FALTA_RETARDO_TIPOS_RANGO:
            if self.fecha_fin is None:
                raise ValueError("fecha_fin es obligatoria para incapacidad y suspensión")
            if self.fecha_fin < self.fecha_evento:
                raise ValueError("fecha_fin no puede ser anterior a fecha_evento")
        elif self.fecha_fin is not None and self.fecha_fin != self.fecha_evento:
            raise ValueError("fecha_fin solo aplica para incapacidad y suspensión")
        return self


class FaltaRetardoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    numero_empleado: Optional[str] = None
    tipo: FaltaRetardoTipo
    fecha_evento: date
    fecha_fin: Optional[date] = None
    observaciones: Optional[str] = None
    registrado_por_id: Optional[int] = None
    registrado_por_nombre: Optional[str] = None
    created_at: datetime
    origen: Optional[str] = None
    origen_id: Optional[int] = None


class FaltasRetardosPageResponse(BaseModel):
    items: list[FaltaRetardoResponse]
    total: int
    page: int
    page_size: int


class FaltasRetardosTiposResponse(BaseModel):
    items: list[FaltaRetardoTipo]
