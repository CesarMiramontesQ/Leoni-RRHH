"""Tiempo por request: cabecera `X-Process-Time-Ms` y una línea de log por petición.

Nació de un dashboard de gerente que tardaba 10 s sin que nada en el backend dijera
qué endpoint se los llevaba. Cada respuesta lleva su duración en la cabecera (para
verla desde el navegador) y deja en el logger `app.request_timing` método, ruta,
status, `sub` del JWT y milisegundos. Por encima de `SLOW_REQUEST_MS` la línea sube a
WARNING con la marca «lenta», que es lo que se busca en los logs de producción.

El `sub` se lee del token sin validarlo: es solo para correlacionar, la autorización
la hacen los demás middlewares y `get_current_user`.
"""

from __future__ import annotations

import logging
import time

from jose import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

logger = logging.getLogger("app.request_timing")


def _sub_del_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        claims = jwt.get_unverified_claims(auth[7:].strip())
    except Exception:  # noqa: BLE001 — token malformado: no hay sub que correlacionar
        return None
    sub = claims.get("sub") if isinstance(claims, dict) else None
    return str(sub) if sub is not None else None


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        inicio = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            ms = (time.perf_counter() - inicio) * 1000.0
        response.headers["X-Process-Time-Ms"] = f"{ms:.1f}"

        lenta = ms >= settings.SLOW_REQUEST_MS
        query = f"?{request.url.query}" if request.url.query else ""
        logger.log(
            logging.WARNING if lenta else logging.INFO,
            "%s%s %s%s %s sub=%s %.1f ms",
            "request lenta: " if lenta else "",
            request.method,
            request.url.path,
            query,
            response.status_code,
            _sub_del_token(request) or "-",
            ms,
        )
        return response
