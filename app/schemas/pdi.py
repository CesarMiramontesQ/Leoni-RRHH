"""Schemas para Plan de Desarrollo Individual (PDI)."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, model_validator


class PDICreate(BaseModel):
    competencia_id: int
    accion: str
    tipo: str
    duracion_horas: Optional[int] = None
    fecha_inicio: date
    fecha_fin: date
    responsable: str

    @model_validator(mode="after")
    def fechas_validas(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"str_strip_whitespace": True}


class PDIUpdate(BaseModel):
    accion: Optional[str] = None
    tipo: Optional[str] = None
    duracion_horas: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    responsable: Optional[str] = None
    estado: Optional[str] = None

    @model_validator(mode="after")
    def fechas_validas(self):
        if self.fecha_inicio and self.fecha_fin:
            if self.fecha_fin < self.fecha_inicio:
                raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"str_strip_whitespace": True}


class PDIResponse(BaseModel):
    id: int
    empleado_id: int
    competencia_id: int
    competencia_nombre: str
    accion: str
    tipo: str
    duracion_horas: Optional[int] = None
    fecha_inicio: date
    fecha_fin: date
    responsable: str
    estado: str
    creado_por: Optional[int] = None
    creado_por_nombre: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PDIListResponse(BaseModel):
    items: list[PDIResponse]
    total: int
