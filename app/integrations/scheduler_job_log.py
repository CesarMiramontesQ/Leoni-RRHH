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

import asyncio
import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable

from sqlalchemy import update

from app.core.database import AsyncSessionLocal
from app.models.scheduler_job_log import SchedulerJobLog

logger = logging.getLogger(__name__)

# Tope de líneas guardadas por corrida, para que un job hablador no infle la fila.
MAX_LINEAS = 200

# Tope de caracteres por mensaje: un str(exc) de SQLAlchemy puede arrastrar el SQL y
# sus `[parameters: ...]`, que con ODBC o asyncpg pesa decenas de KB — inaceptable
# multiplicado por MAX_LINEAS en una columna JSONB.
MAX_MENSAJE = 2000
_SUFIJO_TRUNCADO = "… [truncado]"

# Reintentos automáticos (solo jobs opt-in, ver `con_registro(reintentos=True)`): tras
# una corrida con resultado `error` se vuelve a ejecutar el job con este espaciado.
# Cubre desde un parpadeo de red hasta una caída de ~1 h de la BD externa. Los
# reintentos viven como tareas asyncio, no en APScheduler: si el proceso se reinicia,
# se pierden — igual que un misfire, que quedó fuera de alcance a propósito.
BACKOFF_REINTENTOS_SEGUNDOS: tuple[int, ...] = (15 * 60, 30 * 60, 60 * 60)
MAX_INTENTOS = len(BACKOFF_REINTENTOS_SEGUNDOS) + 1

# Referencias vivas a las tareas de reintento pendientes: el event loop solo guarda
# referencias débiles y sin esto podrían recolectarse a media espera.
_REINTENTOS_PENDIENTES: set[asyncio.Task] = set()


def _truncar_mensaje(mensaje: str) -> str:
    if len(mensaje) <= MAX_MENSAJE:
        return mensaje
    return mensaje[: MAX_MENSAJE - len(_SUFIJO_TRUNCADO)] + _SUFIJO_TRUNCADO


@dataclass
class CorridaBuffer:
    """Líneas y nivel máximo de la corrida en curso."""

    job_id: str
    lineas: list[dict] = field(default_factory=list)
    descartadas: int = 0
    # Arranca en INFO: una corrida sin líneas es `ok`, no `advertencia`.
    nivel_max: int = logging.INFO
    # Último mensaje INFO visto, se haya guardado o no en `lineas`. Varios jobs loguean
    # warnings por empleado dentro de un bucle y su línea de conteos sale al final: si
    # ya se llegó al tope, esa línea se descarta pero igual es el mejor resumen posible.
    ultimo_info: str | None = None

    def agregar(self, record: logging.LogRecord) -> None:
        if record.levelno > self.nivel_max:
            self.nivel_max = record.levelno
        try:
            mensaje = record.getMessage()
        except Exception:  # noqa: BLE001 — un %-format roto no puede tumbar el job
            mensaje = str(record.msg)
        mensaje = _truncar_mensaje(mensaje)
        if record.levelno == logging.INFO:
            self.ultimo_info = mensaje
        if len(self.lineas) >= MAX_LINEAS:
            self.descartadas += 1
            return
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


def resumen_desde_lineas(
    lineas: list[dict], ultimo_info: str | None = None
) -> str | None:
    """Última línea INFO — por convención de estos jobs, la que trae los conteos.

    `ultimo_info` es el último mensaje INFO que vio el buffer, se haya guardado o no
    en `lineas` (`CorridaBuffer.ultimo_info`). Si se pasa, gana sobre lo que haya en
    `lineas`: es la única fuente que sigue siendo correcta cuando esa línea se
    descartó por el tope de `MAX_LINEAS`. Sin argumento, el contrato original queda
    intacto (última INFO en `lineas`, o la primera línea, o `None`).
    """
    if ultimo_info:
        return ultimo_info
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


async def _insertar_en_curso(
    job_id: str, inicio: datetime, intento: int = 1
) -> int | None:
    """Devuelve el id de la fila, o `None` si no se pudo registrar."""
    async with AsyncSessionLocal() as db:
        fila = SchedulerJobLog(
            job_id=job_id, inicio_at=inicio, resultado="en_curso", intento=intento
        )
        db.add(fila)
        await db.commit()
        await db.refresh(fila)
        return fila.id


async def _cerrar_corrida(
    fila_id: int,
    *,
    fin: datetime,
    duracion_ms: int,
    buffer: CorridaBuffer,
    error_excepcion: str | None,
) -> None:
    resultado = resultado_desde_nivel(buffer.nivel_max)
    error = error_excepcion or primer_error(buffer.lineas)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SchedulerJobLog)
            .where(SchedulerJobLog.id == fila_id)
            .values(
                fin_at=fin,
                duracion_ms=duracion_ms,
                resultado=resultado,
                resumen=resumen_desde_lineas(buffer.lineas, buffer.ultimo_info),
                lineas=buffer.lineas,
                lineas_descartadas=buffer.descartadas,
                error=error,
            )
        )
        await db.commit()


def _programar_reintento(
    job_id: str,
    intento_fallido: int,
    ejecutar: Callable[[int], Awaitable[None]],
) -> None:
    """Agenda el siguiente intento como tarea asyncio con el backoff que toca."""
    espera = BACKOFF_REINTENTOS_SEGUNDOS[intento_fallido - 1]
    siguiente = intento_fallido + 1

    async def _reintento() -> None:
        await asyncio.sleep(espera)
        try:
            await ejecutar(siguiente)
        except Exception:  # noqa: BLE001
            # El intento ya dejó su propia fila como `error` (y agendó el que sigue,
            # si le quedaban); aquí solo se evita el "exception was never retrieved".
            logger.warning(
                "El intento %d/%d del job %s volvió a fallar",
                siguiente,
                MAX_INTENTOS,
                job_id,
            )

    logger.info(
        "Job %s con resultado error: reintento %d/%d en %d s",
        job_id,
        siguiente,
        MAX_INTENTOS,
        espera,
    )
    task = asyncio.create_task(_reintento(), name=f"reintento_{job_id}_{siguiente}")
    _REINTENTOS_PENDIENTES.add(task)
    task.add_done_callback(_REINTENTOS_PENDIENTES.discard)


def con_registro(
    fn: Callable[[], Awaitable[None]], job_id: str, *, reintentos: bool = False
) -> Callable[[], Awaitable[None]]:
    """Envuelve un job para dejar una fila por corrida.

    No cambia la semántica del job: si `fn` propaga, se registra y se re-lanza. Lo que
    nunca propaga es un fallo del registro — la página es diagnóstico y no puede
    convertirse en un punto de falla nuevo para nómina.

    Con `reintentos=True`, una corrida con resultado `error` (mismo criterio que la
    fila: nivel máximo de log, no excepción — los jobs atrapan la suya) agenda hasta
    `MAX_INTENTOS - 1` reintentos con `BACKOFF_REINTENTOS_SEGUNDOS`. Cada intento deja
    su propia fila con su número. Una `advertencia` no reintenta.
    """

    async def _ejecutar_intento(intento: int) -> None:
        inicio = datetime.now(timezone.utc)
        try:
            fila_id = await _insertar_en_curso(job_id, inicio, intento)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "No se pudo registrar el inicio del job %s: %s", job_id, exc
            )
            fila_id = None

        buffer = CorridaBuffer(job_id=job_id)
        token = _CORRIDA.set(buffer)
        error_excepcion: str | None = None
        try:
            await fn()
        except BaseException as exc:
            error_excepcion = f"{type(exc).__name__}: {exc}"
            buffer.nivel_max = max(buffer.nivel_max, logging.ERROR)
            raise
        finally:
            # Se resetea ANTES de escribir: si el cierre loguea un warning, ese warning
            # ya no pertenece a la corrida y no debe entrar a su propio buffer.
            _CORRIDA.reset(token)
            fin = datetime.now(timezone.utc)
            if fila_id is not None:
                try:
                    await _cerrar_corrida(
                        fila_id,
                        fin=fin,
                        duracion_ms=int((fin - inicio).total_seconds() * 1000),
                        buffer=buffer,
                        error_excepcion=error_excepcion,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "No se pudo cerrar el registro del job %s: %s", job_id, exc
                    )
            if (
                reintentos
                and intento < MAX_INTENTOS
                and resultado_desde_nivel(buffer.nivel_max) == "error"
            ):
                _programar_reintento(job_id, intento, _ejecutar_intento)

    async def _job_registrado() -> None:
        await _ejecutar_intento(1)

    _job_registrado.job_id = job_id  # type: ignore[attr-defined]
    _job_registrado.reintentos = reintentos  # type: ignore[attr-defined]
    _job_registrado.__name__ = f"registrado__{job_id}"
    return _job_registrado
