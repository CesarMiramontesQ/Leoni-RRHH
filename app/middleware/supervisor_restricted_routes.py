"""
Bloqueo temprano para el rol `supervisor` en rutas de Actas y analítica de comedor.

La verificación por endpoint (role_checker) sigue siendo obligatoria; este middleware
refuerza la política antes de ejecutar handlers y evita depender solo del cliente.

Excepciones:
- ADMIN (`rh_admin`) en Modo RH operativo (`X-RH-UI-Mode: operativo` o sin header).
- Supervisores inscritos con el módulo correspondiente otorgado explícitamente.
"""

from __future__ import annotations

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.rh_module_registry import resolve_module_from_api_path
from app.core.rh_ui_mode import RH_UI_MODE_OPERATIVO, effective_rh_ui_mode

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


def supervisor_restricted_path_allowed(
    payload: dict,
    path: str,
    *,
    rh_ui_mode: str | None = None,
) -> bool:
    """True si el supervisor puede pasar el middleware para `path` (tests y lógica compartida)."""
    if payload.get("rol") != "supervisor":
        return True

    if payload.get("rh_admin"):
        return effective_rh_ui_mode(rh_ui_mode) == RH_UI_MODE_OPERATIVO

    module_key = resolve_module_from_api_path(path)
    modulos = payload.get("rh_modulos")
    if (
        module_key
        and isinstance(modulos, dict)
        and bool(modulos.get(module_key, False))
    ):
        return True

    return False


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

        rh_ui_mode = request.headers.get("X-RH-UI-Mode")
        if supervisor_restricted_path_allowed(payload, path, rh_ui_mode=rh_ui_mode):
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={"detail": _FORBIDDEN_DETAIL},
        )
