"""Registro de corridas de los jobs del scheduler.

El envoltorio `con_registro` deja una fila por ejecución en `levelup_scheduler_job_log`.
Mientras el job corre, un `ContextVar` apunta al buffer de esa corrida y
`CapturaCorridaHandler` copia ahí las líneas que el job emite — los logs siguen saliendo
a stdout igual que siempre, esto solo las duplica.

Por qué se deduce el resultado del nivel de log y no de una excepción: los 11 jobs
atrapan la suya para no tumbar el scheduler y registran el fallo con `logger.error(...)`
sin propagar nada. Un listener de APScheduler los vería «ejecutados correctamente».
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Tope de líneas guardadas por corrida, para que un job hablador no infle la fila.
MAX_LINEAS = 200


@dataclass
class CorridaBuffer:
    """Líneas y nivel máximo de la corrida en curso."""

    job_id: str
    lineas: list[dict] = field(default_factory=list)
    descartadas: int = 0
    # Arranca en INFO: una corrida sin líneas es `ok`, no `advertencia`.
    nivel_max: int = logging.INFO

    def agregar(self, record: logging.LogRecord) -> None:
        if record.levelno > self.nivel_max:
            self.nivel_max = record.levelno
        if len(self.lineas) >= MAX_LINEAS:
            self.descartadas += 1
            return
        try:
            mensaje = record.getMessage()
        except Exception:  # noqa: BLE001 — un %-format roto no puede tumbar el job
            mensaje = str(record.msg)
        self.lineas.append(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "nivel": record.levelname,
                "mensaje": mensaje,
            }
        )


_CORRIDA: ContextVar[CorridaBuffer | None] = ContextVar(
    "scheduler_job_corrida", default=None
)


def resultado_desde_nivel(nivel_max: int) -> str:
    if nivel_max >= logging.ERROR:
        return "error"
    if nivel_max >= logging.WARNING:
        return "advertencia"
    return "ok"


def resumen_desde_lineas(lineas: list[dict]) -> str | None:
    """Última línea INFO — por convención de estos jobs, la que trae los conteos."""
    for linea in reversed(lineas):
        if linea.get("nivel") == "INFO":
            return linea.get("mensaje")
    return lineas[0].get("mensaje") if lineas else None


def primer_error(lineas: list[dict]) -> str | None:
    for linea in lineas:
        if linea.get("nivel") in ("ERROR", "CRITICAL"):
            return linea.get("mensaje")
    return None


class CapturaCorridaHandler(logging.Handler):
    """Copia al buffer de la corrida activa. Sin corrida activa, no hace nada."""

    def emit(self, record: logging.LogRecord) -> None:
        buffer = _CORRIDA.get()
        if buffer is None:
            return
        try:
            buffer.agregar(record)
        except Exception:  # noqa: BLE001 — registrar nunca puede romper al que loguea
            pass


_handler_instalado: CapturaCorridaHandler | None = None


def instalar_captura_logs() -> None:
    """Engancha el handler al logger raíz. Idempotente: llamarlo dos veces no duplica."""
    global _handler_instalado
    if _handler_instalado is not None:
        return
    handler = CapturaCorridaHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger().addHandler(handler)
    _handler_instalado = handler
