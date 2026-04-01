from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class ComedorResponse(BaseModel):
    id: int
    nombre: str
    ubicacion: Optional[str] = None
    capacidad: Optional[int] = None
    activo: bool

    model_config = {"from_attributes": True}


class MenuSemanalCreate(BaseModel):
    comedor_id: int
    semana: date
    dia: str
    tipo: str
    descripcion: Optional[str] = None


class MenuSemanalResponse(MenuSemanalCreate):
    id: int
    foto_path: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ComedorRegistroCreate(BaseModel):
    comedor_id: int
    semana: date
    tipo_platillo: str


class ComedorRegistroResponse(ComedorRegistroCreate):
    id: int
    empleado_id: int
    acceso_concedido: bool
    huella_timestamp: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HuellaValidarRequest(BaseModel):
    huella_id: str  # identificador único del lector / hash de huella
    comedor_id: int
    timestamp: datetime


class HuellaValidarResponse(BaseModel):
    acceso: bool
    empleado: Optional[str] = None
    tipo_platillo: Optional[str] = None
