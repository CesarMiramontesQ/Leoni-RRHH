from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class EmpleadoBase(BaseModel):
    num_empleado: str
    nombre: str
    apellido: str
    email: EmailStr
    departamento: Optional[str] = None
    puesto: Optional[str] = None


class EmpleadoCreate(EmpleadoBase):
    password: str
    rol_id: int


class EmpleadoUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    departamento: Optional[str] = None
    puesto: Optional[str] = None
    rol_id: Optional[int] = None
    activo: Optional[bool] = None


class EmpleadoResponse(EmpleadoBase):
    id: int
    rol_id: int
    supervisor_id: Optional[int] = None
    activo: bool
    fecha_ingreso: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}
