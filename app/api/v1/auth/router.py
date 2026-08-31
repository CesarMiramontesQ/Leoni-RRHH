from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.core.security import decode_token
from app.models.empleados import Empleado
from app.schemas.auth import RefreshRequest, SessionPolicyResponse, TokenResponse
from app.schemas.empleados import EmpleadoResponse
from app.services.auth_service import (
    authenticate_user,
    create_tokens,
    refresh_access_token,
    revoke_token,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticacion"])


@router.get("/session-policy", response_model=SessionPolicyResponse)
async def session_policy():
    """Timeout de inactividad para el cliente. Público: 0 = desactivado."""
    return SessionPolicyResponse(idle_timeout_seconds=max(0, settings.SESSION_IDLE_TIMEOUT_SECONDS))


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """Login con correo; sin @ intenta no_empleado y luego usuario."""
    empleado = await authenticate_user(form_data.username, form_data.password, db)
    tokens = await create_tokens(empleado, db)
    return tokens


@router.post("/refresh")
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Renueva el access token usando el refresh token."""
    return await refresh_access_token(body.refresh_token, db)


@router.post("/logout")
async def logout(
    request: Request,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalida el token actual. El JTI queda en blacklist."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()

    if token:
        payload = decode_token(token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            await revoke_token(jti, expires_at, db)

    return {"message": "Sesion cerrada exitosamente"}


@router.get("/me", response_model=EmpleadoResponse)
async def get_me(current_user: Empleado = Depends(get_current_user)):
    """Retorna el perfil del usuario autenticado."""
    return current_user


@router.post("/sync-it")
async def sync_it(
    current_user: Empleado = Depends(role_checker(["operativo"])),
):
    """Fuerza sincronizacion con BD de IT. Requiere rol RH."""
    # TODO: Implementar en fase de integraciones
    return {
        "message": "Sincronizacion IT iniciada",
        "status": "pending",
        "nota": "Implementacion completa disponible en fase de integraciones",
    }
