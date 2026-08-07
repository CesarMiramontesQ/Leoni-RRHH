"""Sincroniza los días de home office tomados de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_homeoffice_tomados`, la **única** fuente que consulta el dashboard. Se
dispara desde tres lugares, todos contra esta misma función:

- el job diario de las 06:00 (`app/main.py`),
- la aprobación de una solicitud de home office (solo el empleado afectado),
- el CLI `python -m app.scripts.sync_homeoffice_tomados`.

Lee con **una sola** consulta agregada sobre `dbo.PERMISO` (`GROUP BY CB_CODIGO`) y recorta
en memoria. Por eso la corrida de un empleado y la de toda la plantilla comparten camino:
lo caro de esta integración es la conexión, no las filas.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.homeoffice_tomados import HomeOfficeTomados
from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.homeoffice_tomados_repository import HomeOfficeTomadosRepository

logger = logging.getLogger(__name__)

# Evita que dos corridas masivas se pisen (job diario + CLI). Mismo mecanismo que el sync
# de vacaciones. El sync de un solo empleado no lo toma: escribe una fila y es idempotente.
_sync_masivo_lock = asyncio.Lock()

_CERO = Decimal("0.00")


@dataclass
class SyncHomeOfficeStats:
    """Resultado de una corrida, para logs y para el resumen del CLI.

    Sin contador de errores: aquí hay una sola consulta a TRESS, así que un fallo aborta la
    corrida como excepción en vez de contarse por empleado.
    """

    consultados: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0


def rango_anio(anio: int) -> tuple[date, date]:
    """``[1-ene del año, 1-ene del siguiente)`` — rango semiabierto para la consulta."""
    return date(anio, 1, 1), date(anio + 1, 1, 1)


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _dec(valor: float | Decimal | None) -> Decimal:
    """Normaliza a 2 decimales para que la comparación con lo guardado no dé falsos cambios."""
    if valor is None:
        return _CERO
    return Decimal(str(valor)).quantize(Decimal("0.01"))


async def sincronizar_homeoffice_tomados(
    db: AsyncSession,
    *,
    no_empleado: int | None = None,
    anio: int | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncHomeOfficeStats:
    """Refresca la caché. Con `no_empleado`, solo ese empleado; si no, todos los activos.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde: en ese
    caso no se escribe nada.
    """
    anio = anio or date.today().year

    if no_empleado is not None:
        return await _sincronizar(
            db, [int(no_empleado)], anio=anio, origen=origen, execute=execute
        )

    # Solo la corrida masiva serializa: es la que puede solaparse consigo misma.
    async with _sync_masivo_lock:
        no_empleados = await EmpleadoRepository(db).list_no_empleados_activos(
            settings.ESTADOS_ACTIVOS_IDS
        )
        return await _sincronizar(
            db, no_empleados, anio=anio, origen=origen, execute=execute
        )


async def sincronizar_homeoffice_empleado_background(
    no_empleado: int, solicitud_id: int | None = None
) -> None:
    """Refresca el home office de un empleado tras aprobar su solicitud, con sesión propia.

    **Nunca levanta.** La aprobación ya está guardada cuando esto corre: si la
    sincronización falla, se registra el error y el dato se corrige en la corrida diaria de
    las 06:00. Revertir una aprobación por esto sería peor que una caché rancia.
    """
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            await sincronizar_homeoffice_tomados(
                db, no_empleado=no_empleado, origen="aprobacion"
            )
    except Exception:
        logger.exception(
            "Falló el sync de home office tras aprobación | no_empleado=%s | solicitud_id=%s",
            no_empleado,
            solicitud_id,
        )


async def _sincronizar(
    db: AsyncSession,
    no_empleados: list[int],
    *,
    anio: int,
    origen: str,
    execute: bool,
) -> SyncHomeOfficeStats:
    stats = SyncHomeOfficeStats()
    inicio = time.monotonic()
    alcance = (
        f"empleado={no_empleados[0]}"
        if len(no_empleados) == 1
        else f"activos={len(no_empleados)}"
    )
    logger.info(
        "Sync home office | inicio | origen=%s | anio=%d | %s | execute=%s",
        origen,
        anio,
        alcance,
        execute,
    )

    if not no_empleados:
        logger.info("Sync home office | fin | sin empleados que sincronizar")
        return stats

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar los días de "
            "home office."
        )

    desde, hasta = rango_anio(anio)
    try:
        dias_por_empleado = await DatosAnalisisHomeOfficeReadRepository(
            engine
        ).get_dias_por_empleado(desde=desde, hasta=hasta)
    except SQLAlchemyError as exc:
        logger.error(
            "Sync home office | error de lectura en datos-analisis | origen=%s | %s: %s",
            origen,
            type(exc).__name__,
            exc,
        )
        # Con el detalle del driver: sin él, un "Login timeout expired" y un error de
        # permisos sobre dbo.PERMISO se ven idénticos en el CLI.
        raise ConnectionError(
            f"Error al leer home office de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    existentes = await HomeOfficeTomadosRepository(db).map_existentes(anio, no_empleados)

    try:
        for numero in no_empleados:
            stats.consultados += 1
            _aplicar(
                existentes.get(numero),
                numero,
                anio,
                _dec(dias_por_empleado.get(numero)),
                db=db,
                stats=stats,
            )

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync home office | fin | origen=%s | anio=%d | %s | consultados=%d | "
        "insertados=%d | actualizados=%d | omitidos=%d | duracion=%.2fs",
        origen,
        anio,
        alcance,
        stats.consultados,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        time.monotonic() - inicio,
    )
    return stats


def _aplicar(
    fila: HomeOfficeTomados | None,
    no_empleado: int,
    anio: int,
    dias: Decimal,
    *,
    db: AsyncSession,
    stats: SyncHomeOfficeStats,
) -> None:
    """Inserta, actualiza o solo refresca la marca de tiempo de un empleado."""
    if fila is None:
        db.add(
            HomeOfficeTomados(
                no_empleado=no_empleado,
                anio=anio,
                dias_tomados=dias,
                actualizado_en=_ahora(),
            )
        )
        stats.insertados += 1
        return

    cambio = _dec(fila.dias_tomados) != dias
    fila.dias_tomados = dias
    # `actualizado_en` marca la última sincronización exitosa, cambien o no los días, para
    # poder distinguir «sin movimiento» de «caché rancia».
    fila.actualizado_en = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1
