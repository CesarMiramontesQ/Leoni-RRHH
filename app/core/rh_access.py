"""Helpers de autorización RH: admin vía `is_admin_user()`, no rol JWT/BD."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.data_scope import effective_data_scope_rol
from app.core.rh_ui_mode import is_admin_user, is_rh_operativo_ui_mode

if TYPE_CHECKING:
    from app.models.empleados import Empleado

# Rol lógico de API para vista RH operativa (admin Modo RH o legacy BD `rh`).
OPERATIVO_API_ROLE = "operativo"
LEGACY_RH_BD_ROLE = "rh"


def user_rol_nombre(user: "Empleado") -> str:
    return user.rol.nombre if user.rol else "empleado"


def is_legacy_rh_role(user: "Empleado") -> bool:
    """Usuario con rol de catálogo Bono `rh` (legacy)."""
    return user_rol_nombre(user) == LEGACY_RH_BD_ROLE


def requires_operativo_api_role(roles_requeridos: list[str]) -> bool:
    return OPERATIVO_API_ROLE in roles_requeridos


def rol_satisfies_api_roles(rol_nombre: str, roles_requeridos: list[str]) -> bool:
    if rol_nombre in roles_requeridos:
        return True
    return rol_nombre == LEGACY_RH_BD_ROLE and requires_operativo_api_role(roles_requeridos)


def can_use_rh_ui_modes(user: "Empleado") -> bool:
    """Puede enviar `X-RH-UI-Mode` (admin o RH legacy con acceso)."""
    if is_admin_user(user):
        return True
    return is_legacy_rh_role(user) and not bool(getattr(user, "acceso_rh_removido", False))


def has_rh_plantilla_scope(user: "Empleado", rh_ui_mode: str | None = None) -> bool:
    """Vista operativa de plantilla completa (scope efectivo `rh`)."""
    return effective_data_scope_rol(user, rh_ui_mode) == "rh"


def has_rh_operative_access(
    user: "Empleado",
    rh_ui_mode: str | None = None,
    *,
    module_key: str | None = None,
) -> bool:
    """Admin en Modo RH operativo, RH legacy operativo o inscrito con módulo."""
    from app.core.rh_module_registry import is_modulos_rh_enrolled, user_has_module

    if is_admin_user(user) and is_rh_operativo_ui_mode(user, rh_ui_mode):
        return module_key is None or user_has_module(user, module_key)
    if is_legacy_rh_role(user) and is_rh_operativo_ui_mode(user, rh_ui_mode):
        return module_key is None or user_has_module(user, module_key)
    if is_modulos_rh_enrolled(user) and module_key:
        return user_has_module(user, module_key)
    return False
