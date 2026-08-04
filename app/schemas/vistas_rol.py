from pydantic import BaseModel, Field


class VistaRolCatalogItem(BaseModel):
    """Vista configurable del catálogo (definido en `app/core/vista_rol_registry.py`)."""

    key: str
    label: str
    descripcion: str
    grupo: str
    ruta: str
    activa: bool
    nav_item_ids: list[str]
    roles: list[str]


class VistaRolMeResponse(BaseModel):
    """Vistas habilitadas para el rol del usuario autenticado."""

    rol: str
    configurable: bool
    vistas: dict[str, bool]
    por_rol: dict[str, dict[str, bool]] | None = Field(
        default=None,
        description=(
            "Matriz completa rol → vistas. Solo se envía a admins RH, para que el toggle "
            "de Modo RH aplique la configuración del rol simulado sin volver a pedir datos."
        ),
    )


class VistaRolConfigResponse(BaseModel):
    """Matriz completa `{rol: {vista_key: habilitado}}`."""

    roles: list[str]
    config: dict[str, dict[str, bool]]


class VistaRolCambio(BaseModel):
    rol: str
    vista_key: str
    habilitado: bool


class VistaRolConfigUpdate(BaseModel):
    cambios: list[VistaRolCambio] = Field(default_factory=list)
