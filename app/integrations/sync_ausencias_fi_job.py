"""Job programado: sync diario FI + RE (dbo.AUSENCIA → importadas_historico)."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.integrations.bono_historico_import_log import (
    FuenteBonoHistorico,
    ImportStatus,
    OrigenEjecucion,
    _ImportStatsLike,
    registrar_corrida_importacion,
)
from app.services.sync_ausencias_fi_service import SyncAusenciasService, SyncAusenciasStats

logger = logging.getLogger(__name__)

_FUENTE_POR_TIPO: dict[str, FuenteBonoHistorico] = {
    "FI": "ausencias_fi",
    "RE": "ausencias_re",
}


def ausencias_stats_to_log_like(stats: SyncAusenciasStats) -> _ImportStatsLike:
    """Adapta stats del sync al contrato de levelup_bono_historico_import_log."""
    omitidos = (
        stats.omitidos_duplicado
        + stats.omitidos_sin_empleado
        + stats.omitidos_sin_semana
        + stats.omitidos_incompletos
    )
    detalle = (
        f"dup={stats.omitidos_duplicado} "
        f"sin_emp={stats.omitidos_sin_empleado} "
        f"sin_semana={stats.omitidos_sin_semana} "
        f"incompletos={stats.omitidos_incompletos}"
    )
    mensajes = [detalle, *list(stats.mensajes_error)]
    return _ImportStatsLike(
        leidos=stats.leidos,
        insertados=stats.insertados,
        omitidos=omitidos,
        errores=stats.errores,
        mensajes_error=mensajes,
    )


def _status_desde_stats(stats: SyncAusenciasStats) -> tuple[ImportStatus, str | None]:
    """skipped si faltan motores; ok en el resto (errores van en columnas)."""
    if stats.leidos == 0 and stats.errores and stats.mensajes_error:
        msg = stats.mensajes_error[0]
        if "no configurado" in msg.lower():
            return "skipped", msg
    return "ok", None


async def sync_tipo_con_historial(
    *,
    tipo_inc: str,
    fecha_inicio: date,
    fecha_fin: date,
    execute: bool,
    origen_ejecucion: OrigenEjecucion,
    corrida_id: str,
) -> SyncAusenciasStats:
    """Corre un tipo (FI|RE) y deja registro en levelup_bono_historico_import_log."""
    fuente = _FUENTE_POR_TIPO[tipo_inc]
    started_at = datetime.now(timezone.utc)
    stats: SyncAusenciasStats | None = None
    status: ImportStatus = "ok"
    error_msg: str | None = None

    try:
        async with AsyncSessionLocal() as db:
            stats = await SyncAusenciasService(db).sincronizar(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                tipo_inc=tipo_inc,
                execute=execute,
            )
        status, error_msg = _status_desde_stats(stats)
    except Exception as exc:
        status = "error"
        error_msg = str(exc)
        logger.error(
            "Error en sync ausencias %s: %s", tipo_inc, exc, exc_info=True
        )
        raise
    finally:
        finished_at = datetime.now(timezone.utc)
        # Solo persistir historial en ejecuciones reales (scheduler / --execute).
        # Dry-run no debe dejar filas engañosas en levelup_bono_historico_import_log.
        if execute or status == "error":
            await registrar_corrida_importacion(
                fuente,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
                origen_ejecucion=origen_ejecucion,
                corrida_id=corrida_id,
                stats=ausencias_stats_to_log_like(stats) if stats is not None else None,
                error_msg=error_msg,
            )

    assert stats is not None
    logger.info(
        "Sync ausencias %s | rango=%s..%s | leidos=%d insertados=%d "
        "dup=%d sin_emp=%d sin_semana=%d incompletos=%d errores=%d | log=%s",
        tipo_inc,
        fecha_inicio.isoformat(),
        fecha_fin.isoformat(),
        stats.leidos,
        stats.insertados,
        stats.omitidos_duplicado,
        stats.omitidos_sin_empleado,
        stats.omitidos_sin_semana,
        stats.omitidos_incompletos,
        stats.errores,
        fuente,
    )
    return stats


async def sync_ausencias_con_historial(
    *,
    fecha_inicio: date,
    fecha_fin: date,
    tipos: tuple[str, ...] = ("FI", "RE"),
    execute: bool = True,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
) -> list[tuple[str, SyncAusenciasStats]]:
    """Ejecuta FI/RE y persiste cada corrida en levelup_bono_historico_import_log."""
    cid = corrida_id or str(uuid.uuid4())
    out: list[tuple[str, SyncAusenciasStats]] = []
    for tipo in tipos:
        stats = await sync_tipo_con_historial(
            tipo_inc=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            execute=execute,
            origen_ejecucion=origen_ejecucion,
            corrida_id=cid,
        )
        out.append((tipo, stats))
    return out


async def sync_ausencias_fi_job() -> None:
    """Carga FI y RE del día calendario actual (APP_TIMEZONE) en importadas_historico."""
    fecha = datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()
    await sync_ausencias_con_historial(
        fecha_inicio=fecha,
        fecha_fin=fecha,
        tipos=("FI", "RE"),
        execute=True,
        origen_ejecucion="scheduler",
    )
