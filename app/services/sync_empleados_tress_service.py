"""Sincroniza los datos generales del colaborador desde DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_empleados_tress.fecha_ingreso`, que es de donde la Vista 360 lee la fecha
de ingreso. Se dispara desde dos lugares, ambos contra esta misma función:

- el job diario de las 04:10 (`app/main.py`), en la misma ventana que los syncs de turnos,
- el CLI `python -m app.scripts.sync_empleados_tress`.

Antes de esto la Vista 360 abría un motor ODBC contra SQL Server en **cada** apertura del
detalle de un empleado, para un dato que no cambia nunca.

Tres reglas que conviene no revertir:

- **Se lee toda `dbo.COLABORA`, sin filtrar `CB_ACTIVO`.** La Vista 360 se abre también
  sobre bajas, y la fecha de ingreso de quien se fue sigue siendo cierta. Es la diferencia
  deliberada frente al sync de turnos, que sí filtra porque el turno de una baja no sirve
  para nada.
- **Nunca borra.** No hay reconciliación de bajas: si un `CB_CODIGO` deja de venir, su fila
  se queda. Borrarla destruiría el dato sin ganar nada.
- **Solo se crean filas para números que existan en `empleados`.** Sembrar filas huérfanas
  llenaría la caché de gente que Bono no conoce.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.models.empleados_tress import EmpleadoTress
from app.repositories.datos_analisis_catalogos_read_repository import (
    DatosAnalisisCatalogosReadRepository,
)
from app.repositories.empleados_tress_repository import EmpleadosTressRepository

logger = logging.getLogger(__name__)

# Evita que dos corridas se pisen (job diario + CLI).
_sync_lock = asyncio.Lock()


@dataclass
class SyncEmpleadosTressStats:
    """Resultado de una corrida, para logs y para el resumen del CLI."""

    empleados_origen: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    # Viene en COLABORA pero Bono no lo conoce: no se crea fila.
    sin_empleado_en_bono: int = 0


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def sincronizar_empleados_tress(
    db: AsyncSession,
    *,
    origen: str = "scheduler",
    execute: bool = True,
    solo_no_empleado: int | None = None,
) -> SyncEmpleadosTressStats:
    """Refresca los datos generales por empleado.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde, y
    `ValueError` si TRESS devuelve cero colaboradores. En ambos casos no se escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(
            db, origen=origen, execute=execute, solo_no_empleado=solo_no_empleado
        )


async def _leer_origen(*, origen: str) -> dict[int, date | None]:
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar los datos "
            "generales del colaborador."
        )
    try:
        return await DatosAnalisisCatalogosReadRepository(
            engine
        ).get_datos_generales_por_empleado()
    except SQLAlchemyError as exc:
        logger.error(
            "Sync datos generales | error de lectura en datos-analisis | origen=%s | %s: %s",
            origen,
            type(exc).__name__,
            exc,
        )
        raise ConnectionError(
            f"Error al leer dbo.COLABORA de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()


async def _sincronizar(
    db: AsyncSession,
    *,
    origen: str,
    execute: bool,
    solo_no_empleado: int | None,
) -> SyncEmpleadosTressStats:
    stats = SyncEmpleadosTressStats()
    inicio = time.monotonic()
    logger.info(
        "Sync datos generales | inicio | origen=%s | execute=%s", origen, execute
    )

    por_empleado = await _leer_origen(origen=origen)
    stats.empleados_origen = len(por_empleado)

    # Freno de seguridad: dbo.COLABORA nunca está vacía en una planta en marcha. Cero
    # filas es señal de consulta rota, no de que no haya colaboradores.
    if not por_empleado:
        raise ValueError(
            "datos-analisis devolvió 0 colaboradores; no se escribe nada."
        )

    if solo_no_empleado is not None:
        clave = int(solo_no_empleado)
        por_empleado = {k: v for k, v in por_empleado.items() if k == clave}

    conocidos = {
        int(no)
        for (no,) in (
            await db.execute(
                select(Empleado.no_empleado).where(Empleado.no_empleado.isnot(None))
            )
        ).all()
        if no is not None
    }
    existentes = await EmpleadosTressRepository(db).map_existentes()

    try:
        for no_empleado, fecha_ingreso in por_empleado.items():
            fila = existentes.get(no_empleado)
            if fila is None:
                if no_empleado not in conocidos:
                    stats.sin_empleado_en_bono += 1
                    continue
                db.add(
                    EmpleadoTress(
                        no_empleado=no_empleado,
                        fecha_ingreso=fecha_ingreso,
                        sincronizado_en=_ahora(),
                    )
                )
                stats.insertados += 1
                continue

            cambio = fila.fecha_ingreso != fecha_ingreso
            fila.fecha_ingreso = fecha_ingreso
            fila.sincronizado_en = _ahora()
            if cambio:
                stats.actualizados += 1
            else:
                stats.omitidos += 1

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync datos generales | fin | origen=%s | origen_filas=%d | insertados=%d | "
        "actualizados=%d | omitidos=%d | sin_empleado_en_bono=%d | duracion=%.2fs",
        origen,
        stats.empleados_origen,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.sin_empleado_en_bono,
        time.monotonic() - inicio,
    )
    return stats
