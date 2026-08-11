"""Sincroniza el turno de cada colaborador activo de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_turnos_empleados.tu_codigo`, que es de donde sale el turno con el que
Ajustes Comedor resuelve la ventana de comida de una persona. Se dispara desde dos
lugares, ambos contra esta misma función:

- el job diario de las 04:20 (`app/main.py`), después del sync de catálogos,
- el CLI `python -m app.scripts.sync_turnos_empleados`.

Antes de esto la tabla se llenaba con un seed de Excel dentro de una migración y la
asignación manual de comedor escribía `turno="G1"` fijo, así que el turno no era
utilizable para calcular nada.

Tres reglas que conviene no revertir:

- **El sync nunca escribe la columna `comedor`.** Es dato propio de la app, no de TRESS;
  un upsert descuidado borraría en silencio la asignación de comedor de toda la planta.
- **Solo se crean filas para números que existan en `empleados`.** Sembrar filas
  huérfanas dejaría la pantalla contando gente que Bono no conoce.
- **Una baja no se borra**, se marca `activo = False`: conserva el comedor asignado por
  si la persona reingresa y distingue «causó baja» de «nunca se sincronizó».

Es una foto del turno de hoy: TRESS guarda el histórico de cambios en el kardex, no en
`dbo.COLABORA`. Por eso la API expone `sincronizado_en`, para que consultar una fecha
pasada de alguien que cambió de rotación no se lea como un dato histórico.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.datos_analisis_catalogos_read_repository import (
    DatosAnalisisCatalogosReadRepository,
)

logger = logging.getLogger(__name__)

# Evita que dos corridas se pisen (job diario + CLI).
_sync_lock = asyncio.Lock()


@dataclass
class SyncTurnosEmpleadosStats:
    """Resultado de una corrida, para logs y para el resumen del CLI."""

    empleados_origen: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    # Viene en COLABORA pero Bono no lo conoce: no se crea fila.
    sin_empleado_en_bono: int = 0
    # Tenía fila y ya no viene de TRESS: se marca inactivo, no se borra.
    bajas_marcadas: int = 0


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def sincronizar_turnos_empleados(
    db: AsyncSession,
    *,
    origen: str = "scheduler",
    execute: bool = True,
    solo_no_empleado: int | None = None,
) -> SyncTurnosEmpleadosStats:
    """Refresca el turno por empleado.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde, y
    `ValueError` si TRESS devuelve cero colaboradores activos. En ambos casos no se
    escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(
            db, origen=origen, execute=execute, solo_no_empleado=solo_no_empleado
        )


async def _sincronizar(
    db: AsyncSession,
    *,
    origen: str,
    execute: bool,
    solo_no_empleado: int | None,
) -> SyncTurnosEmpleadosStats:
    stats = SyncTurnosEmpleadosStats()
    inicio = time.monotonic()
    logger.info(
        "Sync turno por empleado | inicio | origen=%s | execute=%s", origen, execute
    )

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se puede sincronizar el turno por empleado."
        )

    try:
        por_empleado = await DatosAnalisisCatalogosReadRepository(
            engine
        ).get_turno_por_empleado()
    except SQLAlchemyError as exc:
        logger.error(
            "Sync turno por empleado | error de lectura en datos-analisis | origen=%s | %s: %s",
            origen,
            type(exc).__name__,
            exc,
        )
        raise ConnectionError(
            f"Error al leer el turno por empleado de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    stats.empleados_origen = len(por_empleado)

    # Freno de seguridad: una planta en marcha siempre tiene colaboradores activos con
    # turno. Cero filas es señal de consulta rota, no de que nadie trabaje; marcar toda
    # la plantilla como baja dejaría a todo el mundo sin ventana de comida.
    if not por_empleado:
        raise ValueError(
            "datos-analisis devolvió 0 colaboradores activos con turno; no se escribe nada."
        )

    if solo_no_empleado is not None:
        clave = str(int(solo_no_empleado))
        por_empleado = {k: v for k, v in por_empleado.items() if k == clave}

    empleados = {
        str(int(no)): (emp_id, nombre)
        for no, emp_id, nombre in (
            await db.execute(
                select(Empleado.no_empleado, Empleado.empleado_id, Empleado.nombre).where(
                    Empleado.no_empleado.isnot(None)
                )
            )
        ).all()
        if no is not None
    }

    result = await db.execute(select(TurnoEmpleado))
    # El seed viejo de Excel dejó números con sufijo ".0" ("553.0"). Indexar solo por el
    # número desnudo crearía una segunda fila contra un UNIQUE(no_empleado).
    existentes: dict[str, TurnoEmpleado] = {}
    for fila in result.scalars().all():
        clave = (fila.no_empleado or "").strip()
        if clave.endswith(".0"):
            clave = clave[:-2]
        existentes[clave] = fila

    try:
        for no_empleado, tu_codigo in por_empleado.items():
            fila = existentes.get(no_empleado)
            if fila is None:
                datos = empleados.get(no_empleado)
                if datos is None:
                    stats.sin_empleado_en_bono += 1
                    continue
                db.add(
                    TurnoEmpleado(
                        no_empleado=no_empleado,
                        nombre=datos[1] or "",
                        tu_codigo=tu_codigo,
                        turno=tu_codigo,
                        activo=True,
                        sincronizado_en=_ahora(),
                    )
                )
                stats.insertados += 1
                continue

            cambio = fila.tu_codigo != tu_codigo or not fila.activo
            fila.tu_codigo = tu_codigo
            # Se escribe también la columna heredada para que no se separen: hay
            # consumidores previos que leen `turno` y no `tu_codigo`.
            fila.turno = tu_codigo
            fila.activo = True
            fila.sincronizado_en = _ahora()
            # `comedor` NO se toca: es dato de la app, no de TRESS.
            if cambio:
                stats.actualizados += 1
            else:
                stats.omitidos += 1

        if solo_no_empleado is None:
            for clave, fila in existentes.items():
                if clave in por_empleado:
                    continue
                if fila.activo:
                    fila.activo = False
                    fila.sincronizado_en = _ahora()
                    stats.bajas_marcadas += 1

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync turno por empleado | fin | origen=%s | origen_filas=%d | insertados=%d | "
        "actualizados=%d | omitidos=%d | sin_empleado_en_bono=%d | bajas=%d | duracion=%.2fs",
        origen,
        stats.empleados_origen,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.sin_empleado_en_bono,
        stats.bajas_marcadas,
        time.monotonic() - inicio,
    )
    return stats
