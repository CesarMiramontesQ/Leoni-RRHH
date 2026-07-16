# app/integrations/tress/queue.py
"""
DEPRECATED — no usar en features nuevas.

La integración con nómina TRESS es **escritura directa** a DATOS_ANALISIS
(``DATOS_ANALISIS_DB_*``), no vía cola RPA / robot GUI.

Este módulo y ``levelup_tress_robot_queue`` se conservan temporalmente por
llamadas legacy en solicitudes/actas; el scheduler APScheduler ya no procesa
la cola. Cleanup total = follow-up.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tress import TressRobotQueue


async def encolar_tress(
    db: AsyncSession,
    accion: str,
    payload: dict,
) -> TressRobotQueue:
    """
    DEPRECATED: inserta en levelup_tress_robot_queue (sin consumidor activo).

    Preferir INSERT síncrono a DATOS_ANALISIS (ver tress_suspension_service,
    tress_goce_service, home office, vacaciones).
    """
    entrada = TressRobotQueue(
        accion=accion,
        payload=payload,
        estado="pending",
    )
    db.add(entrada)
    await db.flush()
    return entrada
