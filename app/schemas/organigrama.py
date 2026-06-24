from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class OrganigramaNodoResponse(BaseModel):
    id: int
    empleado_id: int
    no_empleado: int
    nombre_colaborador: str
    nombre_puesto: str | None = None
    departamento: str | None = None
    correo: str | None = None
    foto_url: str | None = None
    extension_telefono: str | None = None
    parent_id: int | None = None
    nivel_jerarquico: int = 0
    nivel_visual: str = "operacion"
    activo: bool
    estado_empleado: str | None = None
    reportes_directos: int = 0
    created_at: datetime
    updated_at: datetime | None = None
    relacion_incompleta: bool = False
    children: list["OrganigramaNodoResponse"] = Field(default_factory=list)


class OrganigramaResponse(BaseModel):
    total_nodos: int
    total_raices: int
    total_relaciones_incompletas: int
    generated_at: datetime
    roots: list[OrganigramaNodoResponse]


OrganigramaNodoResponse.model_rebuild()
