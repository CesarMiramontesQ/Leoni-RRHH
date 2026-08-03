"""
Control de acceso por VISTA para los roles base (`empleado`, `supervisor`, `gerente`).

Bloquea las rutas de una vista que el admin RH apagó para ese rol, de modo que entrar por
URL directa no sirva de nada. La verificación por endpoint (`role_checker`) sigue siendo
obligatoria; este middleware refuerza la política antes de ejecutar handlers.

Excepciones (ver `api_path_exento_del_gate`): autoservicio y `api_compat_roles` —ambas
existen para no cerrar accesos que hoy funcionan.
"""

from __future__ import annotations

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.vista_rol_cache import get_config_con_sesion_propia, vista_habilitada_en
from app.core.vista_rol_registry import (
    VISTAS_ROL,
    gate_api_bloquea,
    is_rol_configurable,
    resolve_vista_from_api_path,
)


def _decode_payload_safe(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    return payload if isinstance(payload, dict) else None


class VistaRolPermissionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        vista_key = resolve_vista_from_api_path(path)
        if vista_key is None:
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

        # El admin RH conserva acceso a todo, incluida la administración de vistas.
        if payload.get("rh_admin"):
            return await call_next(request)

        rol = payload.get("rol")
        if not is_rol_configurable(rol):
            return await call_next(request)

        # Un usuario inscrito en permisos por módulo se rige por ese sistema.
        if payload.get("rh_enrolled") or isinstance(payload.get("rh_modulos"), dict):
            return await call_next(request)

        config = await get_config_con_sesion_propia()
        habilitado = vista_habilitada_en(config, rol, vista_key)
        if not gate_api_bloquea(rol, vista_key, habilitado):
            return await call_next(request)

        etiqueta = VISTAS_ROL[vista_key].label
        return JSONResponse(
            status_code=403,
            content={
                "detail": (
                    f"Acceso denegado: la vista '{etiqueta}' está deshabilitada "
                    f"para el rol '{rol}'."
                ),
            },
        )
