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
    ) -> Empleado:
        rol_nombre = current_user.rol.nombre if current_user.rol else None
        if rol_nombre not in roles_requeridos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes. Roles requeridos: {roles_requeridos}",
            )
        return current_user

    return check_role


async def require_huella_ip(request: Request) -> None:
    """Verifica que la IP del cliente esté en la whitelist de lectores de huella."""
    from app.core.config import settings

    if not settings.HUELLA_WHITELIST_IPS:
        # Lista vacía = permite todo (entorno de desarrollo)
        return

    client_ip = request.client.host if request.client else None
    if not client_ip or client_ip not in settings.HUELLA_WHITELIST_IPS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP no autorizada para acceso de lector de huella",
        )
