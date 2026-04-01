from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.auditoria import TokenBlacklist
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository


async def authenticate_user(
    email: str, password: str, db: AsyncSession
) -> Empleado:
    repo = EmpleadoRepository(db)
    empleado = await repo.get_by_email(email)

    if not empleado or not verify_password(password, empleado.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not empleado.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empleado inactivo",
        )
    return empleado


def create_tokens(empleado: Empleado) -> dict:
    rol_nombre = empleado.rol.nombre if empleado.rol else "empleado"
    payload = {
        "sub": str(empleado.id),
        "rol": rol_nombre,
        "dept": empleado.departamento or "",
        "num": empleado.num_empleado,
    }
    return {
        "access_token": create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
        "token_type": "bearer",
    }


async def revoke_token(jti: str, expires_at: datetime, db: AsyncSession) -> None:
    blacklist_entry = TokenBlacklist(jti=jti, expires_at=expires_at)
    db.add(blacklist_entry)
    await db.flush()


async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    from sqlalchemy import select
    result = await db.execute(
        select(TokenBlacklist).where(TokenBlacklist.jti == jti)
    )
    return result.scalar_one_or_none() is not None


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> dict:
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de tipo incorrecto — se requiere refresh token",
        )

    # Verificar no revocado
    jti = payload.get("jti", "")
    if await is_token_revoked(jti, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado",
        )

    # Generar nuevo access token
    new_payload = {
        "sub": payload["sub"],
        "rol": payload.get("rol", "empleado"),
        "dept": payload.get("dept", ""),
        "num": payload.get("num", ""),
    }
    return {
        "access_token": create_access_token(new_payload),
        "token_type": "bearer",
    }
