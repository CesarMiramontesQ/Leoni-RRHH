"""Job programado: importación seguridad_historico → incidencias (BD principal)."""

from __future__ import annotations

from app.integrations.bono_historico_import_log import OrigenEjecucion, ejecutar_import_con_historial
from app.scripts.import_seguridad_historico import ImportStats, ejecutar_importacion


async def importar_seguridad_historico_job(
    *,
    origen_ejecucion: OrigenEjecucion = "scheduler",
    corrida_id: str | None = None,
) -> ImportStats | None:
    """Ejecuta la importación con persistencia (equivalente a ``--execute`` del script CLI)."""
    return await ejecutar_import_con_historial(
        "seguridad_historico",
        lambda: ejecutar_importacion(execute=True, limit=None),
        origen_ejecucion=origen_ejecucion,
        corrida_id=corrida_id,
    )
