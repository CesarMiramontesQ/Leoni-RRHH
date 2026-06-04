"""Modo de UI para usuarios RH (operativo vs autoservicio empleado)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.empleados import Empleado

RH_UI_MODE_HEADER = "X-RH-UI-Mode"
RH_UI_MODE_EMPLEADO = "empleado"
RH_UI_MODE_OPERATIVO = "operativo"


def is_rh_empleado_ui_mode(user: Empleado, rh_ui_mode: str | None) -> bool:
    """True si el usuario RH está en modo autoservicio (solo datos propios)."""
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    return (rh_ui_mode or "").strip().lower() == RH_UI_MODE_EMPLEADO


def rh_tiene_alcance_gestor(user: Empleado, rh_ui_mode: str | None) -> bool:
    """RH puede usar permisos de gestión solo fuera del modo empleado."""
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return rol in ("director", "supervisor", "gerente")
    return not is_rh_empleado_ui_mode(user, rh_ui_mode)


def effective_solicitud_scope_rol(user: Empleado, rh_ui_mode: str | None) -> str:
    """Rol efectivo para listar/ver solicitudes (RH+empleado → mismo alcance que empleado)."""
    rol = user.rol.nombre if user.rol else "empleado"
    if is_rh_empleado_ui_mode(user, rh_ui_mode):
        return "empleado"
    return rol
