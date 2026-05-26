"""Importaciones nocturnas desde tablas históricas de bono_productividad."""

from __future__ import annotations

import logging
import uuid

from app.integrations.bono_empleados_import import importar_bono_empleados_job
from app.integrations.bono_calidad_historico_import import importar_calidad_historico_job
from app.integrations.bono_evaluacion_historica_gral_import import (
    importar_evaluacion_historica_gral_job,
)
from app.integrations.bono_importadas_historico_import import importar_importadas_historico_job
from app.integrations.bono_seguridad_historico_import import importar_seguridad_historico_job

logger = logging.getLogger(__name__)


async def ejecutar_importaciones_bono_historico() -> None:
    """Importaciones históricas de bono en secuencia (mismo horario en APScheduler)."""
    corrida_id = str(uuid.uuid4())
    await importar_bono_empleados_job(corrida_id=corrida_id)
    await importar_calidad_historico_job(corrida_id=corrida_id)
    await importar_seguridad_historico_job(corrida_id=corrida_id)
    await importar_importadas_historico_job(corrida_id=corrida_id)
    await importar_evaluacion_historica_gral_job(corrida_id=corrida_id)
    logger.info(
        "Importaciones bono (empleados, calidad, seguridad, importadas, evaluación) finalizadas"
    )
