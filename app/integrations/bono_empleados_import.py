"""Job programado: sincronización bono.empleados → empleados (BD principal)."""

from __future__ import annotations

from app.integrations.bono_historico_import_log import (
    OrigenEjecucion,
    _ImportStatsLike,
    ejecutar_import_con_historial,
)
from app.scripts.import_empleados_bono import ImportStats, ejecutar_importacion


def _empleados_stats_to_log_like(stats: ImportStats) -> _ImportStatsLike:
    mensajes = list(stats.mensajes_error)
    if stats.actualizados and not any(m.startswith("actualizados=") for m in mensajes):
        mensajes.insert(0, f"actualizados={stats.actualizados}")
    if stats.creados and not any(m.startswith("creados=") for m in mensajes):
        mensajes.insert(0, f"creados={stats.creados}")
    return _ImportStatsLike(
        leidos=stats.leidos,
        insertados=stats.creados,
        omitidos=stats.omitidos,
        errores=stats.errores,
        mensajes_error=mensajes,
    )


async def importar_empleados_bono_job(
    *,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
) -> ImportStats | None:
    """
    Ejecuta la sincronización con persistencia y registro en bono_historico_import_log.

    Returns:
        Estadísticas del corrido, o None si bono no está configurado.
    """
    raw_stats: ImportStats | None = None

    async def _ejecutar() -> _ImportStatsLike:
        nonlocal raw_stats
        raw_stats = await ejecutar_importacion(execute=True, limit=None)
        return _empleados_stats_to_log_like(raw_stats)

    await ejecutar_import_con_historial(
        "empleados",
        _ejecutar,
        origen_ejecucion=origen_ejecucion,
        corrida_id=corrida_id,
    )
    return raw_stats
