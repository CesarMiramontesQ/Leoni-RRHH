from fastapi import Depends, HTTPException, Request, status
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

    result = await db.execute(
        select(Empleado)
        .options(
            selectinload(Empleado.rol),
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
    """Factory que retorna una dependency para verificar roles."""

    async def check_role(
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Empleado:
        rol_result = await db.execute(select(Rol).where(Rol.id == current_user.rol_id))
        rol = rol_result.scalar_one_or_none()
        # Alinear con auth_service y servicios de dominio: sin rol explícito → empleado.
        rol_nombre = rol.nombre if rol else "empleado"
        if rol_nombre not in roles_requeridos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes. Roles requeridos: {roles_requeridos}",
            )
        return current_user

    return check_role


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
