"""Orquestación del sync FI/RE (dbo.AUSENCIA → importadas_historico) con historial."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, timezone

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

# Candado de concurrencia del mirror FI/RE. Vivía en el router de faltas-retardos, que
# era su único consumidor; al automatizarse el sync se movió aquí para que el job del
# scheduler siga usando el mismo mecanismo. Es por proceso: dos corridas dentro del
# backend no se enciman. La CLI corre en otro proceso y no lo comparte, pero el sync es
# un mirror en una sola transacción de Bono, así que reejecutarlo no duplica filas.
sync_ausencias_lock = asyncio.Lock()

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
        + stats.omitidos_sin_cambio
    )
    detalle = (
        f"dup={stats.omitidos_duplicado} "
        f"upd={stats.actualizados} "
        f"del={stats.eliminados} "
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
        # Solo persistir historial en ejecuciones reales (--execute) o error.
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
        "actualizados=%d eliminados=%d dup=%d sin_emp=%d sin_semana=%d "
        "incompletos=%d errores=%d | log=%s",
        tipo_inc,
        fecha_inicio.isoformat(),
        fecha_fin.isoformat(),
        stats.leidos,
        stats.insertados,
        stats.actualizados,
        stats.eliminados,
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
    origen_ejecucion: OrigenEjecucion = "manual",
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


async def sync_semana_anterior_con_historial(
    *,
    execute: bool = True,
    origen_ejecucion: OrigenEjecucion = "manual",
    corrida_id: str | None = None,
) -> SyncAusenciasStats:
    """Mirror FI+RE de la semana anterior; una corrida de log por fuente (FI y RE)."""
    cid = corrida_id or str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    stats: SyncAusenciasStats | None = None
    status: ImportStatus = "ok"
    error_msg: str | None = None

    try:
        async with AsyncSessionLocal() as db:
            stats = await SyncAusenciasService(db).sincronizar_semana_anterior(
                execute=execute,
            )
        status, error_msg = _status_desde_stats(stats)
    except Exception as exc:
        status = "error"
        error_msg = str(exc)
        logger.error("Error en sync semana anterior FI/RE: %s", exc, exc_info=True)
        raise
    finally:
        finished_at = datetime.now(timezone.utc)
        if execute or status == "error":
            log_stats = (
                ausencias_stats_to_log_like(stats) if stats is not None else None
            )
            for fuente in ("ausencias_fi", "ausencias_re"):
                await registrar_corrida_importacion(
                    fuente,  # type: ignore[arg-type]
                    status=status,
                    started_at=started_at,
                    finished_at=finished_at,
                    origen_ejecucion=origen_ejecucion,
                    corrida_id=cid,
                    stats=log_stats,
                    error_msg=error_msg,
                )

    assert stats is not None
    return stats
