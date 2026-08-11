"""Sincroniza los catálogos de turnos y jornadas de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_turnos` y `levelup_horarios`, que juntas son la **única** fuente con la
que Ajustes Comedor calcula la rotación: del turno salen el patrón del ciclo
(`tu_rit_pat`) y su fecha ancla (`tu_rit_ini`), y de la jornada salen las horas de entrada
y salida. Se dispara desde dos lugares, ambos contra estas mismas funciones:

- el job diario de las 03:40 (`app/main.py`), antes de los otros dos syncs de turnos,
- el CLI `python -m app.scripts.sync_turnos_catalogo`.

Antes existía solo la carga manual de `docs/sql/levelup_turnos_replica.sql`. Eso bastaba
cuando la réplica solo servía para listar nombres de turno; deja de bastar ahora que de
ella depende a qué hora come la gente: un turno nuevo o un ritmo editado en TRESS
desfasaría las proyecciones sin producir un solo error.

**Nunca se borran filas.** Un turno retirado de TRESS conserva la suya —hay referencias
históricas y configuración colgando— y solo se refleja su `tu_activo`.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.horarios import Horario
from app.models.turnos import Turno
from app.repositories.datos_analisis_catalogos_read_repository import (
    DatosAnalisisCatalogosReadRepository,
)

logger = logging.getLogger(__name__)

# Evita que dos corridas se pisen (job diario + CLI).
_sync_lock = asyncio.Lock()

# Cambiar cualquiera de estas dos columnas mueve el ciclo completo de todo el personal
# del turno de un día para otro, sin ningún error visible. Se registran aparte.
_COLUMNAS_DE_RITMO = ("tu_rit_pat", "tu_rit_ini")


@dataclass
class SyncCatalogoStats:
    """Resultado de una corrida, para logs y para el resumen del CLI."""

    tabla: str = ""
    filas_origen: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    # Turnos donde cambió el patrón o el ancla del ciclo.
    ritmo_cambiado: list[str] = field(default_factory=list)


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _crear_engine():
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar los catálogos."
        )
    return engine


async def _leer(metodo: str) -> list[dict[str, Any]]:
    engine = _crear_engine()
    try:
        repo = DatosAnalisisCatalogosReadRepository(engine)
        return await getattr(repo, metodo)()
    except SQLAlchemyError as exc:
        logger.error(
            "Sync catálogos TRESS | error de lectura | %s: %s", type(exc).__name__, exc
        )
        # Con el detalle del driver: sin él, un "Login timeout expired" y un error de
        # permisos sobre dbo.TURNO se ven idénticos en el CLI.
        raise ConnectionError(
            f"Error al leer los catálogos de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()


def _aplicar_fila(
    modelo: type,
    existente: Any | None,
    fila: dict[str, Any],
    *,
    db: AsyncSession,
    stats: SyncCatalogoStats,
    clave: str,
) -> None:
    """Inserta o actualiza una fila del catálogo comparando columna por columna.

    Recorre las columnas del modelo en vez de listarlas a mano para que agregar una
    columna a la réplica no exija tocar también este sync.
    """
    columnas = [c.name for c in modelo.__table__.columns if c.name in fila]

    if existente is None:
        db.add(modelo(**{c: fila[c] for c in columnas}))
        stats.insertados += 1
        return

    cambios: list[str] = []
    for col in columnas:
        if col == clave:
            continue
        if getattr(existente, col) != fila[col]:
            setattr(existente, col, fila[col])
            cambios.append(col)

    if cambios:
        stats.actualizados += 1
        if any(c in _COLUMNAS_DE_RITMO for c in cambios):
            stats.ritmo_cambiado.append(str(fila[clave]).strip())
    else:
        stats.omitidos += 1


async def _sincronizar_tabla(
    db: AsyncSession,
    *,
    modelo: type,
    clave: str,
    filas: list[dict[str, Any]],
    tabla: str,
    execute: bool,
) -> SyncCatalogoStats:
    stats = SyncCatalogoStats(tabla=tabla, filas_origen=len(filas))

    # Freno de seguridad, mismo criterio que el sync de uso de turnos: TRESS siempre
    # tiene catálogo. Cero filas es señal de consulta rota o de una conexión a la BD
    # equivocada, no de que el catálogo se haya vaciado.
    if not filas:
        raise ValueError(f"datos-analisis devolvió 0 filas para {tabla}; no se escribe nada.")

    result = await db.execute(select(modelo))
    existentes = {
        str(getattr(obj, clave)).strip(): obj for obj in result.scalars().all()
    }

    try:
        for fila in filas:
            codigo = str(fila[clave] or "").strip()
            if not codigo:
                continue
            _aplicar_fila(
                modelo, existentes.get(codigo), fila, db=db, stats=stats, clave=clave
            )
        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    return stats


async def sincronizar_turnos_catalogo(
    db: AsyncSession, *, origen: str = "scheduler", execute: bool = True
) -> SyncCatalogoStats:
    """Refresca `levelup_turnos` desde `dbo.TURNO`."""
    filas = await _leer("get_turnos_catalogo")
    stats = await _sincronizar_tabla(
        db,
        modelo=Turno,
        clave="tu_codigo",
        filas=filas,
        tabla="levelup_turnos",
        execute=execute,
    )
    if stats.ritmo_cambiado:
        logger.warning(
            "Sync catálogos TRESS | cambió el ritmo de %d turno(s): %s | "
            "esto mueve el ciclo de todo su personal",
            len(stats.ritmo_cambiado),
            ", ".join(sorted(stats.ritmo_cambiado)),
        )
    return stats


async def sincronizar_horarios_catalogo(
    db: AsyncSession, *, origen: str = "scheduler", execute: bool = True
) -> SyncCatalogoStats:
    """Refresca `levelup_horarios` desde `dbo.HORARIO`."""
    filas = await _leer("get_horarios_catalogo")
    for fila in filas:
        fila["sincronizado_en"] = _ahora()
    return await _sincronizar_tabla(
        db,
        modelo=Horario,
        clave="ho_codigo",
        filas=filas,
        tabla="levelup_horarios",
        execute=execute,
    )


async def sincronizar_catalogos_tress(
    db: AsyncSession, *, origen: str = "scheduler", execute: bool = True
) -> list[SyncCatalogoStats]:
    """Refresca los dos catálogos. Levanta `ConnectionError` o `ValueError` sin escribir."""
    async with _sync_lock:
        inicio = time.monotonic()
        logger.info(
            "Sync catálogos TRESS | inicio | origen=%s | execute=%s", origen, execute
        )
        resultado = [
            await sincronizar_turnos_catalogo(db, origen=origen, execute=execute),
            await sincronizar_horarios_catalogo(db, origen=origen, execute=execute),
        ]
        for stats in resultado:
            logger.info(
                "Sync catálogos TRESS | %s | origen=%d | insertados=%d | actualizados=%d "
                "| omitidos=%d",
                stats.tabla,
                stats.filas_origen,
                stats.insertados,
                stats.actualizados,
                stats.omitidos,
            )
        logger.info(
            "Sync catálogos TRESS | fin | origen=%s | duracion=%.2fs",
            origen,
            time.monotonic() - inicio,
        )
        return resultado
