"""Persistencia del historial de jobs de importación bono histórico."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, Literal, TypeAlias

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.bono_historico_import_log import BonoHistoricoImportLog

logger = logging.getLogger(__name__)

FuenteBonoHistorico: TypeAlias = Literal[
    "empleados",
    "calidad_historico",
    "seguridad_historico",
    "importadas_historico",
    "evaluacion_historica_gral",
    "ausencias_fi",
    "ausencias_re",
]

OrigenEjecucion: TypeAlias = Literal["scheduler", "manual"]
ImportStatus: TypeAlias = Literal["ok", "skipped", "error"]

_MAX_MENSAJES_GUARDADOS = 200


@dataclass
class _ImportStatsLike:
    leidos: int = 0
    insertados: int = 0
    omitidos: int = 0
    errores: int = 0
    mensajes_error: list[str] | None = None


async def registrar_corrida_importacion(
    fuente: FuenteBonoHistorico,
    *,
    status: ImportStatus,
    started_at: datetime,
    finished_at: datetime,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
    stats: _ImportStatsLike | None = None,
    error_msg: str | None = None,
    db: AsyncSession | None = None,
) -> None:
    """Inserta una fila en bono_historico_import_log (no propaga errores de escritura)."""
    mensajes: list[str] | None = None
    if stats and stats.mensajes_error:
        mensajes = list(stats.mensajes_error[:_MAX_MENSAJES_GUARDADOS])

    entry = BonoHistoricoImportLog(
        fuente=fuente,
        corrida_id=corrida_id,
        origen_ejecucion=origen_ejecucion,
        status=status,
        started_at=started_at,
        finished_at=finished_at,
        leidos=stats.leidos if stats else None,
        insertados=stats.insertados if stats else None,
        omitidos=stats.omitidos if stats else None,
        errores=stats.errores if stats else None,
        mensajes_error=mensajes,
        error_msg=error_msg,
    )
    try:
        if db is not None:
            db.add(entry)
            await db.flush()
            return
        async with AsyncSessionLocal() as session:
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.exception(
            "No se pudo guardar historial import %s (status=%s): %s",
            fuente,
            status,
            exc,
        )


async def ejecutar_import_con_historial(
    fuente: FuenteBonoHistorico,
    ejecutar: Callable[[], Awaitable[_ImportStatsLike]],
    *,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
    db: AsyncSession | None = None,
) -> _ImportStatsLike | None:
    """
    Ejecuta un import, registra resultado en BD y mantiene el comportamiento previo
    (None si bono no disponible; re-lanza excepciones fatales).
    """
    started_at = datetime.now(timezone.utc)
    stats: _ImportStatsLike | None = None
    status: ImportStatus = "ok"
    error_msg: str | None = None

    try:
        stats = await ejecutar()
    except ConnectionError as exc:
        status = "skipped"
        error_msg = str(exc)
        logger.warning("Import %s omitido (bono no disponible): %s", fuente, exc)
        return None
    except Exception as exc:
        status = "error"
        error_msg = str(exc)
        logger.error("Error en import %s: %s", fuente, exc, exc_info=True)
        raise
    finally:
        finished_at = datetime.now(timezone.utc)
        await registrar_corrida_importacion(
            fuente,
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            origen_ejecucion=origen_ejecucion,
            corrida_id=corrida_id,
            stats=stats,
            error_msg=error_msg,
            db=db,
        )

    if stats:
        logger.info(
            "Import %s completado | leidos=%s insertados=%s omitidos=%s errores=%s",
            fuente,
            stats.leidos,
            stats.insertados,
            stats.omitidos,
            stats.errores,
        )
        if stats.mensajes_error:
            for msg in stats.mensajes_error[:20]:
                logger.warning("Import %s detalle: %s", fuente, msg)
            if len(stats.mensajes_error) > 20:
                logger.warning(
                    "Import %s: %s errores adicionales no listados",
                    fuente,
                    len(stats.mensajes_error) - 20,
                )
    return stats
