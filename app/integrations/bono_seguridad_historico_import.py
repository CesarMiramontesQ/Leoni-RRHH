"""Job programado: importación seguridad_historico → incidencias (BD principal)."""

from __future__ import annotations

import logging

from app.scripts.import_seguridad_historico import ImportStats, ejecutar_importacion

logger = logging.getLogger(__name__)


async def importar_seguridad_historico_job() -> ImportStats | None:
    """Ejecuta la importación con persistencia (equivalente a ``--execute`` del script CLI)."""
    try:
        stats = await ejecutar_importacion(execute=True, limit=None)
    except ConnectionError as exc:
        logger.warning(
            "Import seguridad_historico omitido (bono no disponible): %s",
            exc,
        )
        return None
    except Exception as exc:
        logger.error(
            "Error en import seguridad_historico: %s",
            exc,
            exc_info=True,
        )
        raise

    logger.info(
        "Import seguridad_historico completado | leidos=%s insertados=%s omitidos=%s errores=%s",
        stats.leidos,
        stats.insertados,
        stats.omitidos,
        stats.errores,
    )
    if stats.mensajes_error:
        for msg in stats.mensajes_error[:20]:
            logger.warning("Import seguridad_historico detalle: %s", msg)
        if len(stats.mensajes_error) > 20:
            logger.warning(
                "Import seguridad_historico: %s errores adicionales no listados",
                len(stats.mensajes_error) - 20,
            )
    return stats
