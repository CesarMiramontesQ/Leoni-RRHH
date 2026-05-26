"""Job programado: importación evaluacion_historica_gral → incidencias."""

from __future__ import annotations

import logging

from app.scripts.import_evaluacion_historica_gral import ImportStats, ejecutar_importacion

logger = logging.getLogger(__name__)


async def importar_evaluacion_historica_gral_job() -> ImportStats | None:
    """Ejecuta la importación con persistencia (equivalente a ``--execute`` del script CLI)."""
    try:
        stats = await ejecutar_importacion(execute=True, limit=None)
    except ConnectionError as exc:
        logger.warning(
            "Import evaluacion_historica_gral omitido (bono no disponible): %s",
            exc,
        )
        return None
    except Exception as exc:
        logger.error(
            "Error en import evaluacion_historica_gral: %s",
            exc,
            exc_info=True,
        )
        raise

    logger.info(
        "Import evaluacion_historica_gral completado | leidos=%s insertados=%s omitidos=%s errores=%s",
        stats.leidos,
        stats.insertados,
        stats.omitidos,
        stats.errores,
    )
    if stats.mensajes_error:
        for msg in stats.mensajes_error[:20]:
            logger.warning("Import evaluacion_historica_gral detalle: %s", msg)
        if len(stats.mensajes_error) > 20:
            logger.warning(
                "Import evaluacion_historica_gral: %s errores adicionales no listados",
                len(stats.mensajes_error) - 20,
            )
    return stats
