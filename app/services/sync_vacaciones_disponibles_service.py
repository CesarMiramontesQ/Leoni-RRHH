"""Sincroniza el saldo de vacaciones de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_vacaciones_disponibles`, la **única** fuente que consultan dashboards,
Vista 360 y el formulario de nueva solicitud. Se dispara desde tres lugares, todos contra
esta misma función:

- el job diario de las 06:00 (`app/main.py`),
- la aprobación de una solicitud de vacaciones (solo el empleado afectado),
- el CLI `python -m app.scripts.sync_vacaciones_disponibles`.

Lee con `dbo.GET_SALDOS_VACACION(cb)` empleado por empleado (~5 ms cada uno) reusando un
solo motor para toda la corrida: crear uno por empleado multiplicaría el costo de conexión,
que es lo caro de esta integración.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.vacaciones_disponibles import VacacionesDisponibles
from app.repositories.datos_analisis_vacaciones_repository import (
    DatosAnalisisVacacionesRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.vacaciones_disponibles_repository import (
    VacacionesDisponiblesRepository,
)

logger = logging.getLogger(__name__)

# Evita que dos corridas masivas se pisen (job diario + CLI + botón manual). Mismo
# mecanismo que `app/api/v1/faltas_retardos/router.py`. El sync de un solo empleado no lo
# toma: escribe una fila y es idempotente.
_sync_masivo_lock = asyncio.Lock()

# Si la BD externa se cae a mitad de la corrida, cada empleado restante pagaría su timeout
# de conexión. Tras esta racha de fallos se aborta y se deja lo ya escrito.
_MAX_FALLOS_CONSECUTIVOS = 5
_MAX_MENSAJES_ERROR = 50


@dataclass
class SyncVacacionesStats:
    """Resultado de una corrida, para logs y para el resumen del CLI."""

    consultados: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)

    def registrar_error(self, mensaje: str) -> None:
        self.errores += 1
        if len(self.mensajes_error) < _MAX_MENSAJES_ERROR:
            self.mensajes_error.append(mensaje)


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _dec(valor: float | Decimal | None) -> Decimal | None:
    """Normaliza a 2 decimales para que la comparación con lo guardado no dé falsos cambios."""
    if valor is None:
        return None
    return Decimal(str(valor)).quantize(Decimal("0.01"))


async def sincronizar_vacaciones_disponibles(
    db: AsyncSession,
    *,
    no_empleado: int | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncVacacionesStats:
    """Refresca la caché de saldos. Con `no_empleado`, solo ese empleado; si no, los activos.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde: en ese
    caso no se escribe nada. Los fallos de un empleado concreto se cuentan y la corrida
    continúa con los demás.
    """
    if no_empleado is not None:
        return await _sincronizar(db, [int(no_empleado)], origen=origen, execute=execute)

    # Solo la corrida masiva serializa: es la que puede solaparse consigo misma.
    async with _sync_masivo_lock:
        no_empleados = await EmpleadoRepository(db).list_no_empleados_activos(
            settings.ESTADOS_ACTIVOS_IDS
        )
        return await _sincronizar(db, no_empleados, origen=origen, execute=execute)


async def sincronizar_vacaciones_empleado_background(no_empleado: int) -> None:
    """Refresca el saldo de un empleado tras aprobar sus vacaciones, con sesión propia.

    **Nunca levanta.** La aprobación ya está guardada cuando esto corre: si la
    sincronización falla, se registra el error y el saldo se corrige en la corrida diaria
    de las 06:00. Revertir una aprobación por esto sería peor que una caché rancia.
    """
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            await sincronizar_vacaciones_disponibles(
                db, no_empleado=no_empleado, origen="aprobacion"
            )
    except Exception:
        logger.exception(
            "Fallo el sync de vacaciones tras aprobación | no_empleado=%s", no_empleado
        )


async def _sincronizar(
    db: AsyncSession,
    no_empleados: list[int],
    *,
    origen: str,
    execute: bool,
) -> SyncVacacionesStats:
    stats = SyncVacacionesStats()
    alcance = (
        f"empleado={no_empleados[0]}"
        if len(no_empleados) == 1
        else f"activos={len(no_empleados)}"
    )
    logger.info(
        "Sync vacaciones disponibles | inicio | origen=%s | %s | execute=%s",
        origen,
        alcance,
        execute,
    )

    if not no_empleados:
        logger.info("Sync vacaciones disponibles | fin | sin empleados que sincronizar")
        return stats

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se puede sincronizar el saldo de vacaciones."
        )

    repo_cache = VacacionesDisponiblesRepository(db)
    existentes = await repo_cache.map_existentes(no_empleados)
    repo_tress = DatosAnalisisVacacionesRepository(engine)
    fallos_consecutivos = 0

    try:
        for numero in no_empleados:
            try:
                kpis = await repo_tress.get_kpis_ciclo(cb_codigo=numero)
            except SQLAlchemyError as exc:
                fallos_consecutivos += 1
                # Con el detalle del driver: sin él, un timeout de red y un error de
                # permisos se ven idénticos en el CLI.
                stats.registrar_error(
                    f"empleado {numero}: {type(exc).__name__}: {exc}"
                )
                logger.warning(
                    "Sync vacaciones disponibles | error de lectura | no_empleado=%s | %s: %s",
                    numero,
                    type(exc).__name__,
                    exc,
                )
                if fallos_consecutivos >= _MAX_FALLOS_CONSECUTIVOS:
                    logger.error(
                        "Sync vacaciones disponibles | abortada tras %d fallos consecutivos",
                        fallos_consecutivos,
                    )
                    break
                continue

            fallos_consecutivos = 0
            stats.consultados += 1
            _aplicar(existentes.get(numero), numero, kpis, db=db, stats=stats)

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise
    finally:
        await engine.dispose()

    logger.info(
        "Sync vacaciones disponibles | fin | origen=%s | %s | consultados=%d | insertados=%d "
        "| actualizados=%d | omitidos=%d | errores=%d",
        origen,
        alcance,
        stats.consultados,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.errores,
    )
    return stats


def _aplicar(
    fila: VacacionesDisponibles | None,
    no_empleado: int,
    kpis,
    *,
    db: AsyncSession,
    stats: SyncVacacionesStats,
) -> None:
    """Inserta, actualiza o solo refresca la marca de tiempo de un empleado."""
    valores = {
        "dias_disponibles": _dec(kpis.disponibles) or Decimal("0.00"),
        "derecho_ciclo": _dec(kpis.derecho_ciclo),
        "tomados_ciclo": _dec(kpis.tomados_ciclo),
        "aniversario": kpis.aniversario,
        "fecha_vence": kpis.vence,
    }

    if fila is None:
        db.add(
            VacacionesDisponibles(
                no_empleado=no_empleado, actualizado_en=_ahora(), **valores
            )
        )
        stats.insertados += 1
        return

    cambio = any(_dec_attr(fila, campo) != valor for campo, valor in valores.items())
    for campo, valor in valores.items():
        setattr(fila, campo, valor)
    # `actualizado_en` marca la última sincronización exitosa, cambie o no el saldo, para
    # poder distinguir «saldo estable» de «caché rancia».
    fila.actualizado_en = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1


def _dec_attr(fila: VacacionesDisponibles, campo: str):
    """Valor guardado, con los numéricos normalizados igual que los entrantes."""
    valor = getattr(fila, campo)
    if campo in ("dias_disponibles", "derecho_ciclo", "tomados_ciclo"):
        return _dec(valor)
    return valor
