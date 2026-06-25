"""Modo de UI para usuarios ADMIN (operativo, autoservicio, líder, gerente o director)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.rh_gestor_registry import resolve_rh_gestor_alcance

if TYPE_CHECKING:
    from app.models.empleados import Empleado

RH_UI_MODE_HEADER = "X-RH-UI-Mode"
RH_UI_MODE_EMPLEADO = "empleado"
RH_UI_MODE_OPERATIVO = "operativo"
RH_UI_MODE_LIDER = "lider"
RH_UI_MODE_GERENTE = "gerente"
RH_UI_MODE_DIRECTOR = "director"

_VALID_RH_UI_MODES = frozenset(
    {
        RH_UI_MODE_OPERATIVO,
        RH_UI_MODE_EMPLEADO,
        RH_UI_MODE_LIDER,
        RH_UI_MODE_GERENTE,
        RH_UI_MODE_DIRECTOR,
    }
)


def is_admin_user(user: "Empleado") -> bool:
    return bool(getattr(user, "puede_administrar_permisos_rh", False))


def parse_rh_ui_mode(raw: str | None) -> str:
    value = (raw or "").strip().lower()
    if value in _VALID_RH_UI_MODES:
        return value
    return RH_UI_MODE_OPERATIVO


def normalized_rh_ui_mode(raw: str | None) -> str | None:
    """None si el header no se envió; valor parseado si sí."""
    if raw is None or not str(raw).strip():
        return None
    return parse_rh_ui_mode(raw)


def effective_rh_ui_mode(raw: str | None) -> str:
    return parse_rh_ui_mode(raw) if raw is not None and str(raw).strip() else RH_UI_MODE_OPERATIVO


def _operational_rol(user: "Empleado") -> str:
    rol = user.rol.nombre if user.rol else "empleado"
    if rol in ("gerente", "supervisor", "director", "empleado"):
        return rol
    alcance = resolve_rh_gestor_alcance(user)
    if alcance == "gerente":
        return "gerente"
    if alcance == "supervisor":
        return "supervisor"
    return "empleado"


def validate_rh_ui_mode_for_user(user: "Empleado", mode: str) -> None:
    from fastapi import HTTPException, status

    if not is_admin_user(user):
        rol = user.rol.nombre if user.rol else "empleado"
        if rol != "rh":
            return
        if getattr(user, "acceso_rh_removido", False):
            return
        alcance = resolve_rh_gestor_alcance(user)
        if mode == RH_UI_MODE_LIDER:
            if alcance != "supervisor":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Modo líder no disponible para este usuario.",
                )
            return
        if mode == RH_UI_MODE_GERENTE:
            if alcance != "gerente":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Modo gerente no disponible para este usuario.",
                )
            return
        if mode == RH_UI_MODE_EMPLEADO and alcance is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Usuarios RH líder/gerente deben usar modo líder o gerente.",
            )
        return

    if mode == RH_UI_MODE_OPERATIVO:
        return

    operational = _operational_rol(user)
    if mode == RH_UI_MODE_EMPLEADO and operational not in ("empleado",):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Modo empleado no disponible para este usuario.",
        )
    if mode == RH_UI_MODE_LIDER and operational != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Modo líder no disponible para este usuario.",
        )
    if mode == RH_UI_MODE_GERENTE and operational != "gerente":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Modo gerente no disponible para este usuario.",
        )
    if mode == RH_UI_MODE_DIRECTOR and operational != "director":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Modo director no disponible para este usuario.",
        )


def is_rh_empleado_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    if not is_admin_user(user):
        rol = user.rol.nombre if user.rol else "empleado"
        if rol != "rh":
            return False
        return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_EMPLEADO
    return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_EMPLEADO


def is_rh_operativo_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    if not is_admin_user(user):
        rol = user.rol.nombre if user.rol else "empleado"
        if rol != "rh":
            return False
        return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_OPERATIVO
    return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_OPERATIVO


def is_rh_lider_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    if effective_rh_ui_mode(rh_ui_mode) != RH_UI_MODE_LIDER:
        return False
    if is_admin_user(user):
        return _operational_rol(user) == "supervisor"
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    return resolve_rh_gestor_alcance(user) == "supervisor"


def is_rh_gerente_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    if effective_rh_ui_mode(rh_ui_mode) != RH_UI_MODE_GERENTE:
        return False
    if is_admin_user(user):
        return _operational_rol(user) == "gerente"
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    return resolve_rh_gestor_alcance(user) == "gerente"


def is_rh_director_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    if effective_rh_ui_mode(rh_ui_mode) != RH_UI_MODE_DIRECTOR:
        return False
    if not is_admin_user(user):
        return False
    return _operational_rol(user) == "director"


def is_rh_gestor_team_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    return is_rh_lider_ui_mode(user, rh_ui_mode) or is_rh_gerente_ui_mode(user, rh_ui_mode)


def rh_tiene_alcance_gestor(user: "Empleado", rh_ui_mode: str | None) -> bool:
    """RH/ADMIN con permisos globales de gestión (solo modo operativo)."""
    rol = user.rol.nombre if user.rol else "empleado"
    if is_admin_user(user):
        return is_rh_operativo_ui_mode(user, rh_ui_mode)
    if rol != "rh":
        return rol in ("director", "supervisor", "gerente")
    return is_rh_operativo_ui_mode(user, rh_ui_mode)


def rh_tiene_modulos_completos_operativo(user: "Empleado", rh_ui_mode: str | None) -> bool:
    """Líder/Gerente ADMIN en modo operativo: acceso total al catálogo de módulos."""
    if not is_rh_operativo_ui_mode(user, rh_ui_mode):
        return False
    return resolve_rh_gestor_alcance(user) is not None


def effective_solicitud_scope_rol(user: "Empleado", rh_ui_mode: str | None) -> str:
    """Rol efectivo para listar/ver/aprobar solicitudes."""
    rol = user.rol.nombre if user.rol else "empleado"

    if is_admin_user(user):
        mode = effective_rh_ui_mode(rh_ui_mode)
        if mode == RH_UI_MODE_EMPLEADO:
            return "empleado"
        if mode == RH_UI_MODE_LIDER:
            return "supervisor"
        if mode == RH_UI_MODE_GERENTE:
            return "gerente"
        if mode == RH_UI_MODE_DIRECTOR:
            return "director"
        return "rh"

    if rol != "rh":
        return rol

    mode = effective_rh_ui_mode(rh_ui_mode)
    if mode == RH_UI_MODE_EMPLEADO:
        return "empleado"
    if mode == RH_UI_MODE_LIDER:
        return "supervisor"
    if mode == RH_UI_MODE_GERENTE:
        return "gerente"
    return "rh"
