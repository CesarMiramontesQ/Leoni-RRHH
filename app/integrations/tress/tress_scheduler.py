# app/integrations/tress/tress_scheduler.py
"""
DEPRECATED — no usar.

Scheduler de la cola TRESS (levelup_tress_robot_queue / robot GUI).

La integración con nómina es escritura directa a DATOS_ANALISIS; el job
APScheduler ``tress_scheduler`` ya no se registra en main.py.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_INTENTOS = 3


async def procesar_cola_tress() -> None:
    """
    Job principal del scheduler TRESS.
    Importa dependencias aqui para evitar import circular con main.py.
    """
    from app.core.database import AsyncSessionLocal
    from app.integrations.tress.tress_gui_robot import TressGuiRobot
    from app.models.tress import TressRobotQueue

    robot = TressGuiRobot()

    try:
        async with AsyncSessionLocal() as db:
            # Obtener registros pendientes ordenados por creacion
            result = await db.execute(
                select(TressRobotQueue)
                .where(
                    TressRobotQueue.estado == "pending",
                    TressRobotQueue.intentos < _MAX_INTENTOS,
                )
                .order_by(TressRobotQueue.created_at)
                .limit(10)
            )
            pendientes = list(result.scalars().all())

            if not pendientes:
                logger.debug("Cola TRESS vacia — nada que procesar")
                return

            logger.info("Procesando %d items de la cola TRESS", len(pendientes))

            for item in pendientes:
                await _procesar_item(db, robot, item)

            await db.commit()

    except Exception as exc:
        logger.error("Error en procesar_cola_tress: %s", str(exc), exc_info=True)


async def _procesar_item(db, robot, item) -> None:
    """Procesa un item de la cola y actualiza su estado."""
    from app.models.tress import TressRobotQueue

    item.intentos = (item.intentos or 0) + 1
    item.processed_at = datetime.now(timezone.utc)

    try:
        exito = False

        if item.accion == "REGISTRAR_INCIDENCIA":
            exito = await robot.registrar_incidencia(item.payload or {})
        elif item.accion == "SOLICITUD_VACACIONES":
            exito = await robot.registrar_solicitud_vacaciones(item.payload or {})
        elif item.accion == "ACCION_DISCIPLINARIA":
            exito = await robot.aplicar_accion_disciplinaria(item.payload or {})
        else:
            logger.warning("Accion TRESS desconocida: %s (id=%d)", item.accion, item.id)
            exito = False

        if exito:
            item.estado = "done"
            logger.info("Cola TRESS item id=%d accion=%s → done", item.id, item.accion)
        else:
            if item.intentos >= _MAX_INTENTOS:
                item.estado = "error"
                logger.error(
                    "Cola TRESS item id=%d accion=%s FALLIDO tras %d intentos",
                    item.id, item.accion, item.intentos,
                )
            else:
                # Reintentar en siguiente ciclo
                item.estado = "pending"
                logger.warning(
                    "Cola TRESS item id=%d accion=%s falló (intento %d/%d)",
                    item.id, item.accion, item.intentos, _MAX_INTENTOS,
                )

    except Exception as exc:
        logger.error(
            "Excepcion procesando cola TRESS id=%d: %s", item.id, str(exc), exc_info=True
        )
        if item.intentos >= _MAX_INTENTOS:
            item.estado = "error"
        # else queda pending para reintento
