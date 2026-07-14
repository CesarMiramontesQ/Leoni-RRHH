# app/integrations/tress/queue.py
"""
Adaptador de encolamiento TRESS.

Unica responsabilidad: insertar en tress_robot_queue y retornar inmediatamente.
El scheduler APScheduler en main.py procesa la cola cada 5 minutos.

Acciones validas:
  - "REGISTRAR_VACACIONES"   payload: {empleado_num, fecha_inicio, fecha_fin, referencia_id}
  - "REGISTRAR_HOME_OFFICE"  (legado; home office aprueba con INSERT sincrono a DATOS_ANALISIS)
  - "REGISTRAR_INCIDENCIA"   payload: {empleado_num, tipo, descripcion, fecha, referencia_id}
  - "CANCELAR_SOLICITUD"     payload: {empleado_num, tipo, referencia_id}
"""

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tress import TressRobotQueue


async def encolar_tress(
    db: AsyncSession,
    accion: str,
    payload: dict,
) -> TressRobotQueue:
    """
    Inserta una tarea en tress_robot_queue dentro de la transaccion activa.

    IMPORTANTE: Esta funcion debe llamarse dentro de la misma transaccion que la
    operacion de negocio principal. Si la transaccion hace rollback (ej. falla
    una validacion posterior), el encolamiento tambien se revierte — garantia
    de consistencia entre el estado RH y la cola TRESS.

    Retorna el objeto TressRobotQueue creado (con id asignado tras flush).
    """
    entrada = TressRobotQueue(
        accion=accion,
        payload=payload,
        estado="pending",
        intentos=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entrada)
    await db.flush()
    return entrada
