"""Modo de UI para usuarios RH (operativo, autoservicio, líder o gerente)."""

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

_VALID_RH_UI_MODES = frozenset(
    {
        RH_UI_MODE_OPERATIVO,
        RH_UI_MODE_EMPLEADO,
        RH_UI_MODE_LIDER,
        RH_UI_MODE_GERENTE,
    }
)


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


def validate_rh_ui_mode_for_user(user: "Empleado", mode: str) -> None:
    from fastapi import HTTPException, status

    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return

    # RH removido de la administración de permisos: pasa a vista de empleado,
    # se permite cualquier modo (el acceso a módulos RH ya está denegado por
    # modulos_rh todo-falso). Evita 422 al enviar modo "empleado".
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


def is_rh_empleado_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_EMPLEADO


def is_rh_operativo_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_OPERATIVO


def is_rh_lider_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    if effective_rh_ui_mode(rh_ui_mode) != RH_UI_MODE_LIDER:
        return False
    return resolve_rh_gestor_alcance(user) == "supervisor"


def is_rh_gerente_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return False
    if effective_rh_ui_mode(rh_ui_mode) != RH_UI_MODE_GERENTE:
        return False
    return resolve_rh_gestor_alcance(user) == "gerente"


def is_rh_gestor_team_ui_mode(user: "Empleado", rh_ui_mode: str | None) -> bool:
    return is_rh_lider_ui_mode(user, rh_ui_mode) or is_rh_gerente_ui_mode(user, rh_ui_mode)


def rh_tiene_alcance_gestor(user: "Empleado", rh_ui_mode: str | None) -> bool:
    """RH con permisos globales de gestión (solo modo operativo)."""
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh":
        return rol in ("director", "supervisor", "gerente")
    return is_rh_operativo_ui_mode(user, rh_ui_mode)


def rh_tiene_modulos_completos_operativo(user: "Empleado", rh_ui_mode: str | None) -> bool:
    """Líder/Gerente RH en modo operativo: acceso total al catálogo de módulos."""
    if not is_rh_operativo_ui_mode(user, rh_ui_mode):
        return False
    return resolve_rh_gestor_alcance(user) is not None


def effective_solicitud_scope_rol(user: "Empleado", rh_ui_mode: str | None) -> str:
    """Rol efectivo para listar/ver/aprobar solicitudes."""
    rol = user.rol.nombre if user.rol else "empleado"
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
