"""Job programado: sincronización bono.empleados → empleados (BD principal)."""

from __future__ import annotations

import logging

from app.scripts.import_empleados_bono import ImportStats, ejecutar_importacion

logger = logging.getLogger(__name__)


async def importar_empleados_bono_job() -> ImportStats | None:
    """
    Ejecuta la sincronización con persistencia (equivalente a ``--execute`` del script CLI).

    Returns:
        Estadísticas del corrido, o None si bono no está configurado (solo warning en log).
    """
    try:
        stats = await ejecutar_importacion(execute=True, limit=None)
    except ConnectionError as exc:
        logger.warning(
            "Import empleados bono omitido (bono no disponible): %s",
            exc,
        )
        return None
    except Exception as exc:
        logger.error(
            "Error en import empleados bono: %s",
            exc,
            exc_info=True,
        )
        raise

    logger.info(
        "Import empleados bono completado | leidos=%s creados=%s actualizados=%s "
        "omitidos=%s errores=%s columnas=%s",
        stats.leidos,
        stats.creados,
        stats.actualizados,
        stats.omitidos,
        stats.errores,
        stats.columnas_importadas,
    )
    if stats.mensajes_error:
        for msg in stats.mensajes_error[:20]:
            logger.warning("Import empleados bono detalle: %s", msg)
        if len(stats.mensajes_error) > 20:
            logger.warning(
                "Import empleados bono: %s errores adicionales no listados",
                len(stats.mensajes_error) - 20,
            )
    return stats
