"""Sincroniza los datos generales del colaborador desde DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_empleados_tress`: la fecha de ingreso que lee la Vista 360 y el contrato
actual (tipo, duración, inicio y vencimiento) que lee la página Contratos. Se dispara desde
dos lugares, ambos contra esta misma función:

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

Del contrato se guarda el vencimiento ya calculado (`fecha_contrato + contrato_dias`) y
**no** el estatus: vigente/por vencer/vencido depende de «hoy» y lo resuelve
`contratos_service` al leer. Un contrato con duración (`TB_DIAS > 0`) pero sin fecha de
inicio real (NULL o el «vacío» 1899-12-30 de TRESS) queda con vencimiento NULL y se
cuenta en `contratos_dato_incompleto`, que el sync reporta como advertencia.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.models.empleados_tress import EmpleadoTress
from app.repositories.datos_analisis_catalogos_read_repository import (
    DatosAnalisisCatalogosReadRepository,
    DatosGeneralesColabora,
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
    # TB_DIAS > 0 pero CB_FEC_CON vacío: no se puede calcular el vencimiento.
    contratos_dato_incompleto: int = 0
    # CB_CONTRAT sin fila en dbo.CONTRATO.
    contratos_sin_catalogo: int = 0


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def calcular_fecha_vencimiento(datos: DatosGeneralesColabora) -> date | None:
    """`fecha_contrato + contrato_dias`; None si es indefinido (0 días) o falta un dato."""
    if not datos.contrato_dias or datos.contrato_dias <= 0 or datos.fecha_contrato is None:
        return None
    return datos.fecha_contrato + timedelta(days=datos.contrato_dias)


_CAMPOS_CONTRATO = (
    "contrato_codigo",
    "contrato_descripcion",
    "contrato_dias",
    "fecha_contrato",
)


def _aplicar_datos(fila: EmpleadoTress, datos: DatosGeneralesColabora) -> bool:
    """Copia los datos a la fila y devuelve si algo cambió."""
    nuevos = {campo: getattr(datos, campo) for campo in _CAMPOS_CONTRATO}
    nuevos["fecha_ingreso"] = datos.fecha_ingreso
    nuevos["fecha_vencimiento_contrato"] = calcular_fecha_vencimiento(datos)
    cambio = any(getattr(fila, campo) != valor for campo, valor in nuevos.items())
    for campo, valor in nuevos.items():
        setattr(fila, campo, valor)
    return cambio


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


async def _leer_origen(*, origen: str) -> dict[int, DatosGeneralesColabora]:
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
        for no_empleado, datos in por_empleado.items():
            fila = existentes.get(no_empleado)
            if fila is None:
                if no_empleado not in conocidos:
                    stats.sin_empleado_en_bono += 1
                    continue
                fila = EmpleadoTress(no_empleado=no_empleado, sincronizado_en=_ahora())
                _aplicar_datos(fila, datos)
                db.add(fila)
                stats.insertados += 1
                _contar_contrato(stats, datos)
                continue

            cambio = _aplicar_datos(fila, datos)
            fila.sincronizado_en = _ahora()
            _contar_contrato(stats, datos)
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

    if stats.contratos_dato_incompleto or stats.contratos_sin_catalogo:
        logger.warning(
            "Sync datos generales | contratos sin vencimiento calculable | origen=%s | "
            "dato_incompleto=%d | sin_catalogo=%d",
            origen,
            stats.contratos_dato_incompleto,
            stats.contratos_sin_catalogo,
        )
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


def _contar_contrato(stats: SyncEmpleadosTressStats, datos: DatosGeneralesColabora) -> None:
    if datos.contrato_codigo and datos.contrato_dias is None:
        stats.contratos_sin_catalogo += 1
    elif datos.contrato_dias and datos.contrato_dias > 0 and datos.fecha_contrato is None:
        stats.contratos_dato_incompleto += 1
