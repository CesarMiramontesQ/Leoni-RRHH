"""Sincroniza el personal activo por turno de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_turnos_uso`, la **única** fuente que consulta Ajustes Comedor para saber
qué turnos están en uso. Se dispara desde dos lugares, ambos contra esta misma función:

- el job diario de las 04:00 (`app/main.py`), antes del primer turno de la planta,
- el CLI `python -m app.scripts.sync_turnos_uso`.

Lee con **una sola** consulta agregada sobre `dbo.COLABORA` (`GROUP BY CB_TURNO`), así que
la corrida completa cuesta una conexión y una consulta, no una por empleado.

Un turno que se queda sin personal **conserva su fila con 0**, no se borra: así la
pantalla distingue «turno sin gente» de «turno que nunca se sincronizó».
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.turnos_uso import TurnoUso
from app.repositories.datos_analisis_turnos_uso_read_repository import (
    DatosAnalisisTurnosUsoReadRepository,
)
from app.repositories.turnos_uso_repository import TurnosUsoRepository

logger = logging.getLogger(__name__)

# Evita que dos corridas se pisen (job diario + CLI).
_sync_lock = asyncio.Lock()


@dataclass
class SyncTurnosUsoStats:
    """Resultado de una corrida, para logs y para el resumen del CLI.

    Sin contador de errores: hay una sola consulta a TRESS, así que un fallo aborta la
    corrida como excepción en vez de contarse por turno.
    """

    turnos_origen: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    puestos_a_cero: int = 0


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def sincronizar_turnos_uso(
    db: AsyncSession,
    *,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncTurnosUsoStats:
    """Refresca la caché de personal activo por turno.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde, y
    `ValueError` si TRESS devuelve cero turnos (ver el freno más abajo). En ambos casos no
    se escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(db, origen=origen, execute=execute)


async def _sincronizar(
    db: AsyncSession, *, origen: str, execute: bool
) -> SyncTurnosUsoStats:
    stats = SyncTurnosUsoStats()
    inicio = time.monotonic()
    logger.info("Sync turnos en uso | inicio | origen=%s | execute=%s", origen, execute)

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se puede sincronizar el uso de turnos."
        )

    try:
        por_turno = await DatosAnalisisTurnosUsoReadRepository(
            engine
        ).get_empleados_por_turno()
    except SQLAlchemyError as exc:
        logger.error(
            "Sync turnos en uso | error de lectura en datos-analisis | origen=%s | %s: %s",
            origen,
            type(exc).__name__,
            exc,
        )
        # Con el detalle del driver: sin él, un "Login timeout expired" y un error de
        # permisos sobre dbo.COLABORA se ven idénticos en el CLI.
        raise ConnectionError(
            f"Error al leer el uso de turnos de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    stats.turnos_origen = len(por_turno)

    # Freno de seguridad, mismo criterio que el sync de incidencias: una planta en marcha
    # siempre tiene turnos con personal. Cero filas es señal de consulta rota o de una
    # conexión a la BD equivocada, no de que nadie trabaje; poner toda la caché a cero
    # dejaría la pantalla sin turnos que mostrar.
    if not por_turno:
        raise ValueError(
            "datos-analisis devolvió 0 turnos con personal activo; no se escribe nada."
        )

    repo = TurnosUsoRepository(db)
    existentes = await repo.map_existentes()

    try:
        for codigo, empleados in por_turno.items():
            _aplicar(existentes.get(codigo), codigo, empleados, db=db, stats=stats)

        # Los turnos que ya no vienen de TRESS se quedan en cero, no se borran.
        for codigo, fila in existentes.items():
            if codigo in por_turno:
                continue
            if fila.empleados_activos != 0:
                fila.empleados_activos = 0
                stats.puestos_a_cero += 1
            fila.actualizado_en = _ahora()

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync turnos en uso | fin | origen=%s | turnos_origen=%d | insertados=%d | "
        "actualizados=%d | omitidos=%d | puestos_a_cero=%d | duracion=%.2fs",
        origen,
        stats.turnos_origen,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.puestos_a_cero,
        time.monotonic() - inicio,
    )
    return stats


def _aplicar(
    fila: TurnoUso | None,
    tu_codigo: str,
    empleados: int,
    *,
    db: AsyncSession,
    stats: SyncTurnosUsoStats,
) -> None:
    """Inserta, actualiza o solo refresca la marca de tiempo de un turno."""
    if fila is None:
        db.add(
            TurnoUso(
                tu_codigo=tu_codigo,
                empleados_activos=empleados,
                actualizado_en=_ahora(),
            )
        )
        stats.insertados += 1
        return

    cambio = fila.empleados_activos != empleados
    fila.empleados_activos = empleados
    # `actualizado_en` marca la última sincronización exitosa, cambie o no el conteo, para
    # poder distinguir «sin movimiento» de «caché rancia».
    fila.actualizado_en = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1
