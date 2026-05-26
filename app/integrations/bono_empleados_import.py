"""Job programado: importación empleados desde bono_productividad.empleados."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.integrations.bono_empleados_sync import BonoEmpleadosImportStats, BonoEmpleadosSyncService
from app.integrations.bono_historico_import_log import (
    OrigenEjecucion,
    ImportStatus,
    _ImportStatsLike,
    registrar_corrida_importacion,
)

logger = logging.getLogger(__name__)


def _stats_to_log_like(stats: BonoEmpleadosImportStats) -> _ImportStatsLike:
    mensajes = list(stats.mensajes_error)
    if stats.actualizados and not any(m.startswith("actualizados=") for m in mensajes):
        mensajes.insert(0, f"actualizados={stats.actualizados}")
    return _ImportStatsLike(
        leidos=stats.leidos,
        insertados=stats.insertados,
        omitidos=stats.omitidos,
        errores=stats.errores,
        mensajes_error=mensajes,
    )


async def _ejecutar_con_sesion(
    db: AsyncSession,
    *,
    origen_ejecucion: OrigenEjecucion,
    corrida_id: str | None,
) -> BonoEmpleadosImportStats | None:
    started_at = datetime.now(timezone.utc)
    stats: BonoEmpleadosImportStats | None = None
    status: ImportStatus = "ok"
    error_msg: str | None = None

    try:
        service = BonoEmpleadosSyncService(db)
        stats = await service.sincronizar_empleados(execute=True, commit=False)
        await db.commit()
    except ConnectionError as exc:
        status = "skipped"
        error_msg = str(exc)
        await db.rollback()
        return None
    except Exception as exc:
        status = "error"
        error_msg = str(exc)
        await db.rollback()
        raise
    finally:
        finished_at = datetime.now(timezone.utc)
        await registrar_corrida_importacion(
            "empleados",
            status=status,
            started_at=started_at,
            finished_at=finished_at,
            origen_ejecucion=origen_ejecucion,
            corrida_id=corrida_id,
            stats=_stats_to_log_like(stats) if stats else None,
            error_msg=error_msg,
            db=db,
        )

    if stats:
        log_like = _stats_to_log_like(stats)
        logger.info(
            "Import empleados completado | leidos=%s insertados=%s actualizados=%s omitidos=%s errores=%s",
            log_like.leidos,
            log_like.insertados,
            stats.actualizados,
            log_like.omitidos,
            log_like.errores,
        )
    return stats


async def importar_bono_empleados_job(
    *,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
    db: AsyncSession | None = None,
) -> BonoEmpleadosImportStats | None:
    """Ejecuta sync de empleados con persistencia y registro en bono_historico_import_log."""
    if db is not None:
        return await _ejecutar_con_sesion(
            db, origen_ejecucion=origen_ejecucion, corrida_id=corrida_id
        )
    async with AsyncSessionLocal() as session:
        return await _ejecutar_con_sesion(
            session, origen_ejecucion=origen_ejecucion, corrida_id=corrida_id
        )
