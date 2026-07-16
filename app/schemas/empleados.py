from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class DescansosEmpleadoResponse(BaseModel):
    empleado_id: int
    no_empleado: int
    fecha_inicio: date
    fecha_fin: date
    descansos: list[date]


class CatalogoSimpleResponse(BaseModel):
    model_config = {"from_attributes": True}
    descripcion: str
    estatus_id: int


class AreaResponse(CatalogoSimpleResponse):
    area_id: int


class SubareaResponse(CatalogoSimpleResponse):
    subarea_id: int
    area_id: int


class CategoriaResponse(CatalogoSimpleResponse):
    categoria_id: int
    nivel: Optional[str] = None
    descripcion: Optional[str] = None


class PuestoResponse(CatalogoSimpleResponse):
    puesto_id: int
    area_id: Optional[int] = None


class EstadoEmpleadoResponse(CatalogoSimpleResponse):
    estado_id: int


class ClasificacionEmpleadoResponse(CatalogoSimpleResponse):
    clasificacion_id: int
    significado: Optional[str] = None


class EmpleadoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    no_empleado: int
    no_sap: Optional[int] = None
    nombre: str
    email: Optional[str] = None
    usuario: Optional[str] = None
    rol_id: Optional[int] = None
    categoria: Optional[CategoriaResponse] = None
    subarea: Optional[SubareaResponse] = None
    puesto: Optional[PuestoResponse] = None
    estado: Optional[EstadoEmpleadoResponse] = None
    area: Optional[AreaResponse] = None
    clasificacion: Optional[ClasificacionEmpleadoResponse] = None
    lider_id: Optional[int] = None
    centrocosto_id: Optional[int] = None
    recibe_bono: Optional[bool] = None
    brigada: Optional[str] = None
    registro: Optional[str] = None
    a_restringido: Optional[str] = None
    requiere_cambio_password: Optional[bool] = None
    created_at: Optional[datetime] = None
