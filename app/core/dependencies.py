from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.auditoria import TokenBlacklist
from app.models.empleados import Empleado
from app.models.roles import Rol
from app.core.rh_ui_mode import (
    is_rh_gestor_team_ui_mode,
    is_rh_lider_ui_mode,
    normalized_rh_ui_mode,
    validate_rh_ui_mode_for_user,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Empleado:
    payload = decode_token(token)

    # Verificar tipo de token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de tipo incorrecto",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verificar JTI no está en blacklist
    jti = payload.get("jti")
    if jti:
        result = await db.execute(
            select(TokenBlacklist).where(TokenBlacklist.jti == jti)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token revocado",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Obtener empleado
    empleado_id = payload.get("sub")
    if not empleado_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido: sin sub",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Backdoor SOLO dev: admin sintético (no consulta BD).
    from app.core.dev_admin import build_dev_admin, is_dev_admin_sub

    if is_dev_admin_sub(empleado_id):
        return build_dev_admin()

    result = await db.execute(
        select(Empleado)
        .options(
            selectinload(Empleado.core),
            selectinload(Empleado.estado),
            selectinload(Empleado.area),
            selectinload(Empleado.puesto),
            selectinload(Empleado.subarea),
            selectinload(Empleado.categoria),
            selectinload(Empleado.clasificacion),
            # Evita lazy load async al serializar solicitudes (p. ej. `emp.lider` en `_solicitud_to_response`).
            selectinload(Empleado.lider),
        )
        .where(Empleado.id == int(empleado_id))
    )
    empleado = result.scalar_one_or_none()

    if not empleado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empleado no encontrado",
        )
    if empleado.estado_id is None or empleado.estado_id not in settings.ESTADOS_ACTIVOS_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empleado inactivo",
        )

    return empleado


def role_checker(roles_requeridos: list[str]):
    """Factory que retorna una dependency para verificar roles de API.

    Usa ``operativo`` para vista RH (admin en Modo RH o rol legacy BD ``rh``).
    """

    async def check_role(
        request: Request,
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    ) -> Empleado:
        from app.core.rh_access import requires_operativo_api_role, rol_satisfies_api_roles
        from app.core.rh_module_registry import resolve_module_from_api_path, user_has_module
        from app.core.rh_ui_mode import (
            is_admin_user,
            is_rh_director_ui_mode,
            is_rh_empleado_ui_mode,
            is_rh_gerente_ui_mode,
            is_rh_lider_ui_mode,
            is_rh_operativo_ui_mode,
        )

        if is_admin_user(current_user):
            if is_rh_operativo_ui_mode(current_user, rh_ui_mode) and requires_operativo_api_role(
                roles_requeridos
            ):
                return current_user
            if is_rh_lider_ui_mode(current_user, rh_ui_mode) and "supervisor" in roles_requeridos:
                return current_user
            if is_rh_gerente_ui_mode(current_user, rh_ui_mode) and "gerente" in roles_requeridos:
                return current_user
            if is_rh_director_ui_mode(current_user, rh_ui_mode) and "director" in roles_requeridos:
                return current_user
            if is_rh_empleado_ui_mode(current_user, rh_ui_mode) and "empleado" in roles_requeridos:
                return current_user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes. Roles requeridos: {roles_requeridos}",
            )

        rol_result = await db.execute(select(Rol).where(Rol.id == current_user.rol_id))
        rol = rol_result.scalar_one_or_none()
        rol_nombre = rol.nombre if rol else "empleado"
        if rol_satisfies_api_roles(rol_nombre, roles_requeridos):
            return current_user
        module_key = resolve_module_from_api_path(request.url.path)
        if module_key and user_has_module(current_user, module_key):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permisos insuficientes. Roles requeridos: {roles_requeridos}",
        )

    return check_role


async def require_rh_permisos_admin(
    current_user: Empleado = Depends(get_current_user),
) -> Empleado:
    """Administrar permisos depende del flag `puede_administrar_permisos_rh`, no del rol."""
    if not current_user.puede_administrar_permisos_rh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para administrar accesos de usuarios RH.",
        )
    return current_user


def require_rh_module(module_key: str):
    """Factory: exige acceso al módulo RH indicado para inscritos y admin operativo."""

    async def check_module(
        current_user: Empleado = Depends(get_current_user),
        rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    ) -> Empleado:
        from app.core.rh_module_registry import is_modulos_rh_enrolled, user_has_module
        from app.core.rh_ui_mode import is_admin_user, is_rh_operativo_ui_mode

        if not is_modulos_rh_enrolled(current_user):
            return current_user
        if is_admin_user(current_user) and not is_rh_operativo_ui_mode(current_user, rh_ui_mode):
            return current_user
        if not user_has_module(current_user, module_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes acceso al módulo '{module_key}'.",
            )
        return current_user

    return check_module


async def require_huella_ip(request: Request) -> None:
    """Verifica que la IP del cliente esté en la whitelist de lectores de huella."""
    from app.core.config import parse_comma_separated_ips, settings

    allowed = parse_comma_separated_ips(settings.HUELLA_WHITELIST_IPS)
    if not allowed:
        # Lista vacía = permite todo (entorno de desarrollo)
        return

    client_ip = request.client.host if request.client else None
    if not client_ip or client_ip not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP no autorizada para acceso de lector de huella",
        )


def _comedor_terminal_allowed_ips() -> list[str]:
    from app.core.config import parse_comma_separated_ips, settings

    terminal = parse_comma_separated_ips(settings.COMEDOR_TERMINAL_IPS)
    if terminal:
        return terminal
    return parse_comma_separated_ips(settings.HUELLA_WHITELIST_IPS)


async def require_comedor_terminal_ip(request: Request) -> None:
    """Solo terminales en la red del comedor (whitelist). Vacío = permite todo (dev)."""
    allowed = _comedor_terminal_allowed_ips()
    if not allowed:
        return

    client_ip = request.client.host if request.client else None
    if not client_ip or client_ip not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP no autorizada para terminal de comedor",
        )


async def require_torniquete_api_key(request: Request) -> None:
    """Si TORNIQUETE_API_KEY está definida, exige header X-Torniquete-Key."""
    from app.core.config import settings

    expected = (settings.TORNIQUETE_API_KEY or "").strip()
    if not expected:
        return

    got = request.headers.get("X-Torniquete-Key") or request.headers.get("x-torniquete-key")
    if got != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clave de terminal inválida",
        )


def get_rh_ui_mode(
    x_rh_ui_mode: str | None = Header(None, alias="X-RH-UI-Mode"),
    current_user: Empleado = Depends(get_current_user),
) -> str | None:
    """Modo de UI activo para usuarios ADMIN (`operativo` | `empleado` | `lider` | `gerente` | `director`)."""
    from app.core.rh_access import can_use_rh_ui_modes

    mode = normalized_rh_ui_mode(x_rh_ui_mode)
    if mode is not None and can_use_rh_ui_modes(current_user):
        validate_rh_ui_mode_for_user(current_user, mode)
    return x_rh_ui_mode


def gestor_team_role_checker(roles_requeridos: list[str]):
    """Permite supervisor/gerente nativos o RH en modo líder/gerente."""

    async def check(
        current_user: Empleado = Depends(get_current_user),
        rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    ) -> Empleado:
        from app.core.rh_access import is_legacy_rh_role
        from app.core.rh_ui_mode import is_admin_user

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol in roles_requeridos:
            return current_user
        if is_admin_user(current_user) and is_rh_gestor_team_ui_mode(current_user, rh_ui_mode):
            return current_user
        if is_legacy_rh_role(current_user) and is_rh_gestor_team_ui_mode(current_user, rh_ui_mode):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permisos insuficientes. Roles requeridos: {roles_requeridos}",
        )

    return check


def gestor_supervisor_role_checker():
    """Supervisor nativo o RH en modo líder."""

    async def check(
        current_user: Empleado = Depends(get_current_user),
        rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    ) -> Empleado:
        from app.core.rh_access import is_legacy_rh_role
        from app.core.rh_ui_mode import is_admin_user

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol == "supervisor":
            return current_user
        if is_admin_user(current_user) and is_rh_lider_ui_mode(current_user, rh_ui_mode):
            return current_user
        if is_legacy_rh_role(current_user) and is_rh_lider_ui_mode(current_user, rh_ui_mode):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes. Se requiere rol supervisor.",
        )

    return check
