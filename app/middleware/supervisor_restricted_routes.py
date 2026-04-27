"""
Bloqueo temprano para el rol `supervisor` en rutas de Actas y analítica de comedor.

La verificación por endpoint (role_checker) sigue siendo obligatoria; este middleware
refuerza la política antes de ejecutar handlers y evita depender solo del cliente.
"""

from __future__ import annotations

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

_FORBIDDEN_DETAIL = (
    "Acceso denegado: el rol supervisor no puede acceder a este recurso."
)


def _path_restricted_for_supervisor(path: str) -> bool:
    if path == "/api/v1/actas" or path.startswith("/api/v1/actas/"):
        return True
    if path.startswith("/api/v1/comedor/estadisticas"):
        return True
    if path.startswith("/api/v1/comedor/proyecciones"):
        return True
    return False


def _decode_payload_safe(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    return payload if isinstance(payload, dict) else None


class SupervisorRestrictedRoutesMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if not _path_restricted_for_supervisor(path):
            return await call_next(request)

        auth = request.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return await call_next(request)

        token = auth[len("Bearer ") :].strip()
        if not token:
            return await call_next(request)

        payload = _decode_payload_safe(token)
        if payload is None:
            return await call_next(request)

        if payload.get("type") != "access":
            return await call_next(request)

        if payload.get("rol") != "supervisor":
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={"detail": _FORBIDDEN_DETAIL},
        )
