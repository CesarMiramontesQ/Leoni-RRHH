from pydantic import BaseModel, Field


class RhModuloCatalogItem(BaseModel):
    key: str
    label: str
    group: str
    nav_item_ids: list[str]


class RhPermisosMeResponse(BaseModel):
    rol: str
    puede_administrar_permisos_rh: bool
    modulos: dict[str, bool]
    inscrito: bool


class RhUsuarioPermisosItem(BaseModel):
    empleado_id: int
    no_empleado: str
    nombre: str
    email: str | None = None
    rol_nombre: str
    activo: bool
    permisos_personalizados: bool
    puede_administrar_permisos_rh: bool
    modulos: dict[str, bool]
    editable: bool


class RhEmpleadoBusquedaItem(BaseModel):
    empleado_id: int
    no_empleado: str
    nombre: str
    email: str | None = None
    rol_nombre: str


class RhPermisosUpdate(BaseModel):
    modulos: dict[str, bool] = Field(default_factory=dict)
