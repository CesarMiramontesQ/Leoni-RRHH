"""Schemas Pydantic para Plan de Desarrollo Individual (PDI)."""

from datetime import date
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
    def check_fechas(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"from_attributes": True}


class PDIUpdate(BaseModel):
    accion: Optional[str] = None
    tipo: Optional[str] = None
    duracion_horas: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    responsable: Optional[str] = None
    estado: Optional[str] = None

    @model_validator(mode="after")
    def check_fechas(self):
        if self.fecha_inicio and self.fecha_fin:
            if self.fecha_fin < self.fecha_inicio:
                raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    model_config = {"from_attributes": True}


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
    creado_por_nombre: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PDIListResponse(BaseModel):
    items: list[PDIResponse]
    total: int
