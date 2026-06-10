"""
Control de acceso por módulo para usuarios inscritos (RH y otros roles con permisos explícitos).
"""

from __future__ import annotations

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.rh_module_registry import (
    RH_MODULE_EXEMPT_API_PREFIXES,
    is_rh_self_service_api_path,
    jwt_module_guard_applies,
    resolve_module_from_api_path,
    user_has_module_from_claims,
)


def _decode_payload_safe(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    return payload if isinstance(payload, dict) else None


def _path_exempt(path: str) -> bool:
    for prefix in RH_MODULE_EXEMPT_API_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


class RhModulePermissionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if _path_exempt(path):
            return await call_next(request)

        module_key = resolve_module_from_api_path(path)
        if module_key is None:
            return await call_next(request)

        auth = request.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return await call_next(request)

        token = auth[len("Bearer ") :].strip()
        if not token:
            return await call_next(request)

        payload = _decode_payload_safe(token)
        if payload is None or payload.get("type") != "access":
            return await call_next(request)

        if not jwt_module_guard_applies(payload):
            return await call_next(request)

        if payload.get("rol") == "rh" and is_rh_self_service_api_path(path):
            return await call_next(request)

        if user_has_module_from_claims(payload, module_key, rh_ui_mode=request.headers.get("X-RH-UI-Mode")):
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={
                "detail": f"Acceso denegado: no tienes permiso para el módulo '{module_key}'.",
            },
        )
