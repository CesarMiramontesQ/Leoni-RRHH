from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, model_validator


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
    no_empleado: str
    no_sap: Optional[str] = None
    nombre: str
    email: Optional[str] = None
    usuario: Optional[str] = None
    rol_id: int
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
    registro: Optional[date] = None
    a_restringido: Optional[bool] = None
    requiere_cambio_password: Optional[bool] = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def resolver_email_alterno(cls, value: Any) -> Any:
        if isinstance(value, dict):
            if not value.get("email"):
                email_rel = value.get("email_alterno")
                if isinstance(email_rel, dict) and email_rel.get("email"):
                    value["email"] = email_rel["email"]
            return value

        if getattr(value, "email", None):
            return value

        email_rel = getattr(value, "email_alterno", None)
        if email_rel and getattr(email_rel, "email", None):
            payload = {
                "id": value.id,
                "empleado_id": value.empleado_id,
                "no_empleado": value.no_empleado,
                "no_sap": value.no_sap,
                "nombre": value.nombre,
                "email": email_rel.email,
                "usuario": value.usuario,
                "rol_id": value.rol_id,
                "categoria": value.categoria,
                "subarea": value.subarea,
                "puesto": value.puesto,
                "estado": value.estado,
                "area": value.area,
                "clasificacion": value.clasificacion,
                "lider_id": value.lider_id,
                "centrocosto_id": value.centrocosto_id,
                "recibe_bono": value.recibe_bono,
                "brigada": value.brigada,
                "registro": value.registro,
                "a_restringido": value.a_restringido,
                "requiere_cambio_password": value.requiere_cambio_password,
                "created_at": value.created_at,
            }
            return payload
        return value
