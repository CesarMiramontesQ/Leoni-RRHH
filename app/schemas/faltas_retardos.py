from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.faltas_retardos import (
    FALTA_RETARDO_TIPOS,
    FALTA_RETARDO_TIPOS_GOCE,
    FALTA_RETARDO_TIPOS_RANGO,
)

FaltaRetardoTipo = Literal[
    "falta_justificada",
    "falta_injustificada",
    "retardo",
    "incapacidad",
    "suspension",
    "matrimonio",
    "incapacidad_interna",
    "defuncion",
    "paternidad",
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
    def validate_fechas_y_motivo(self) -> "FaltaRetardoCreateRequest":
        if self.tipo in FALTA_RETARDO_TIPOS_RANGO:
            if self.fecha_fin is None:
                raise ValueError(
                    "fecha_fin es obligatoria para incapacidad, suspensión y permisos con goce"
                )
            if self.fecha_fin < self.fecha_evento:
                raise ValueError("fecha_fin no puede ser anterior a fecha_evento")
        elif self.fecha_fin is not None and self.fecha_fin != self.fecha_evento:
            raise ValueError(
                "fecha_fin solo aplica para incapacidad, suspensión y permisos con goce"
            )
        if self.tipo == "suspension":
            motivo = (self.observaciones or "").strip()
            if not motivo:
                raise ValueError("observaciones es obligatoria para suspensión (motivo TRESS)")
            if len(motivo) > 30:
                raise ValueError("observaciones no puede exceder 30 caracteres para suspensión")
            self.observaciones = motivo
        elif self.tipo in FALTA_RETARDO_TIPOS_GOCE and self.observaciones:
            self.observaciones = self.observaciones.strip() or None
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


class FaltaRetardoTipoTotalItem(BaseModel):
    tipo: FaltaRetardoTipo
    total: int
    porcentaje: float


class FaltaRetardoMesTotalItem(BaseModel):
    periodo: str
    total: int


class FaltaRetardoPeriodoTipoItem(BaseModel):
    periodo: str
    tipo: FaltaRetardoTipo
    total: int


class FaltaRetardoEmpleadoTipoCountItem(BaseModel):
    tipo: FaltaRetardoTipo
    total: int


class FaltaRetardoEmpleadoTotalItem(BaseModel):
    empleado_id: int
    no_empleado: Optional[str] = None
    nombre: Optional[str] = None
    total: int
    por_tipo: list[FaltaRetardoEmpleadoTipoCountItem] = Field(default_factory=list)


class FaltasRetardosEstadisticasResponse(BaseModel):
    total_eventos: int
    falta_justificada: int
    falta_injustificada: int
    retardo: int
    incapacidad: int
    suspension: int
    eventos_por_mes: list[FaltaRetardoMesTotalItem]
    eventos_por_periodo_y_tipo: list[FaltaRetardoPeriodoTipoItem] = Field(default_factory=list)
    tendencia_agrupacion: str | None = None
    eventos_por_tipo: list[FaltaRetardoTipoTotalItem]
    empleados_con_mas_eventos: list[FaltaRetardoEmpleadoTotalItem]
