"""Sincroniza las incidencias de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_incidencias_tress`, la **única** fuente que consulta la página
Incidencias (módulo `faltas-retardos`). Se dispara desde dos lugares, ambos contra esta
misma función:

- el job semanal de los miércoles a las 10:00 (`app/main.py`),
- el CLI `python -m app.scripts.sync_incidencias_tress` (carga inicial y corridas
  manuales).

Lee TRESS con el mismo SQL que ya usaba la página
(`sql/datos_analisis_faltas_retardos_base.sql`), en tramos anuales, y **solo lee**: en
DATOS_ANALISIS no se escribe nada desde aquí.

Además refleja los eventos de `levelup_faltas_retardos` que TRESS no tiene
(`incapacidad_interna` siempre; permisos con goce viejos que nunca llegaron a nómina) y
estampa sobre las filas de TRESS la atribución local —quién registró y el motivo— que
TRESS no guarda.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS, FALTA_RETARDO_TIPOS_GOCE
from app.models.incidencias_tress import IncidenciaTress
from app.repositories.datos_analisis_faltas_retardos_repository import (
    DatosAnalisisFaltasRetardosRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.repositories.incidencias_tress_cache_repository import (
    IncidenciasTressCacheRepository,
)
from app.services.faltas_retardos.constants import ORIGEN_MANUAL

logger = logging.getLogger(__name__)

# Evita que se pisen el job semanal y el CLI. Mismo mecanismo que el sync de home office.
_sync_lock = asyncio.Lock()

# Sin `desde`, el barrido arranca aquí: el AU_FECHA más viejo de TRESS es de 1999.
_INICIO_HISTORIA = date(1990, 1, 1)

# Sin `hasta`, el barrido llega hasta aquí. No termina en «hoy» porque nómina captura
# permisos con goce por adelantado (matrimonio, paternidad) y esas filas ya existen en
# `dbo.PERMISO` con `fecha_evento` futura: con el corte en hoy no entrarían a la caché
# hasta que llegara su fecha de inicio, y la página dejaría de mostrarlas por adelantado
# como sí hacía leyendo TRESS en vivo.
_HORIZONTE_FUTURO_DIAS = 365

# Freno al borrado: si en una corrida desaparece más de esta fracción de las filas de
# TRESS que había en el rango, se asume lectura mutilada (datos-analisis es una réplica y
# un ETL puede vaciarla sin que la consulta falle) en vez de un borrado real en nómina.
_UMBRAL_BORRADO_MASIVO = 0.5


@dataclass
class SyncIncidenciasTressStats:
    """Resultado de una corrida, para los logs y el resumen del CLI."""

    desde: date | None = None
    hasta: date | None = None
    leidos: int = 0
    empleados: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    eliminados: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)
    duracion_segundos: float = 0.0

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


def _hoy_app() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def hasta_efectivo(hasta: date | None, hoy: date | None = None) -> date:
    """Cota superior concreta del rango; `None` ⇒ hoy + `_HORIZONTE_FUTURO_DIAS`.

    Las tres piezas de una corrida —la lectura de TRESS, `map_existentes` y la
    reconciliación de bajas— tienen que usar exactamente esta misma cota. Si la lectura
    abarcara el futuro y `map_existentes` no (o al revés), las filas futuras se borrarían
    y reinsertarían en cada corrida, o chocarían contra el UNIQUE (origen, origen_id).
    """
    if hasta is not None:
        return hasta
    return (hoy or _hoy_app()) + timedelta(days=_HORIZONTE_FUTURO_DIAS)


def rango_semanas(semanas: int, hoy: date | None = None) -> tuple[date, date]:
    """Ventana móvil: del lunes de hace `semanas` semanas al horizonte futuro.

    El fin no es hoy a propósito: lo ya capturado en TRESS con fecha futura (un permiso
    de matrimonio dentro de tres semanas, una paternidad) tiene que entrar a la caché en
    la corrida siguiente a su captura, no cuando llegue su fecha de inicio.
    """
    dia = hoy or _hoy_app()
    lunes_actual = dia - timedelta(days=dia.weekday())
    return (
        lunes_actual - timedelta(weeks=max(1, int(semanas)) - 1),
        hasta_efectivo(None, dia),
    )


def rango_carga_inicial(hoy: date | None = None) -> tuple[None, date]:
    """Histórico completo hasta el domingo anterior: excluye la semana en curso.

    Esta cota se queda en el pasado a propósito. Un rango contiguo no puede a la vez
    excluir la semana en curso y llegar al horizonte futuro, y partir el rango en dos
    con un hueco en medio rompería la simetría entre lectura, `map_existentes` y
    reconciliación (lo que hay en el hueco se vería como obsoleto y se borraría). Por eso
    la carga inicial se hace en **dos pasadas contiguas**, cada una internamente
    simétrica (ver `app/scripts/sync_incidencias_tress.py`): este histórico congelado y
    después `rango_semanas(...)`, la misma ventana viva que relee el job y que sí llega
    al futuro. Así nada queda fuera de la caché al terminar el backfill.
    """
    dia = hoy or _hoy_app()
    lunes_actual = dia - timedelta(days=dia.weekday())
    return None, lunes_actual - timedelta(days=1)


def _tramos_anuales(desde: date | None, hasta: date | None) -> list[tuple[date, date]]:
    """Parte el rango en tramos de año calendario para no leer 27 años de una vez."""
    inicio = desde or _INICIO_HISTORIA
    fin = hasta_efectivo(hasta)
    if fin < inicio:
        return []
    tramos: list[tuple[date, date]] = []
    anio = inicio.year
    while anio <= fin.year:
        tramo_ini = max(inicio, date(anio, 1, 1))
        tramo_fin = min(fin, date(anio, 12, 31))
        tramos.append((tramo_ini, tramo_fin))
        anio += 1
    return tramos


async def _leer_tress(desde: date | None, hasta: date | None) -> list[dict[str, Any]]:
    """Lee todas las filas del rango. Solo lectura; levanta ConnectionError si falla."""
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar las incidencias."
        )

    repo = DatosAnalisisFaltasRetardosRepository(engine)
    filas: list[dict[str, Any]] = []
    try:
        for tramo_ini, tramo_fin in _tramos_anuales(desde, hasta):
            filas.extend(
                await repo.list_todos(fecha_inicio=tramo_ini, fecha_fin=tramo_fin)
            )
    except SQLAlchemyError as exc:
        logger.error(
            "Sync incidencias | error de lectura en datos-analisis | %s",
            type(exc).__name__,
        )
        raise ConnectionError(
            f"Error al leer incidencias de datos-analisis: {type(exc).__name__}"
        ) from exc
    finally:
        await engine.dispose()
    return filas


def _motivo_para_frenar_borrado(
    *, leidos: int, obsoletas: int, no_manual_previas: int
) -> str | None:
    """Devuelve el motivo por el que NO se debe borrar, o `None` si el borrado es creíble.

    La reconciliación borra «lo que estaba en la caché y ya no vino de TRESS», así que
    una lectura vacía o mutilada —datos-analisis es una réplica de análisis y un ETL
    recargándola a las 10:00 de un miércoles es exactamente ese escenario— vaciaría la
    ventana entera, o la tabla completa en una carga inicial. `_leer_tress` solo detecta
    el fallo si la conexión revienta; estos dos frenos cubren el caso en que responde.
    """
    if obsoletas == 0:
        return None
    if leidos == 0:
        return (
            f"borrado omitido: TRESS devolvió 0 filas y la caché tenía "
            f"{no_manual_previas} filas de TRESS en el rango; se asume lectura fallida"
        )
    if obsoletas > no_manual_previas * _UMBRAL_BORRADO_MASIVO:
        return (
            f"borrado omitido: desaparecieron {obsoletas} de {no_manual_previas} filas "
            f"de TRESS en el rango, más del {_UMBRAL_BORRADO_MASIVO:.0%}; si la baja es "
            "real, relanzar el sync acotando el rango a lo que sí cambió"
        )
    return None


def _clave_evento(fila: IncidenciaTress) -> tuple[int, date, str] | None:
    if fila.empleado_id is None:
        return None
    return (fila.empleado_id, fila.fecha_evento, fila.tipo)


async def sincronizar_incidencias_tress(
    db: AsyncSession,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncIncidenciasTressStats:
    """Refresca la caché para el rango indicado (`fecha_evento`, ambos inclusive).

    `hasta=None` no significa «hasta hoy» sino hasta el horizonte futuro
    (`hasta_efectivo`), para que lo capturado por adelantado en TRESS también entre.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde: en ese
    caso no se escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(
            db, desde=desde, hasta=hasta, origen=origen, execute=execute
        )


async def _sincronizar(
    db: AsyncSession,
    *,
    desde: date | None,
    hasta: date | None,
    origen: str,
    execute: bool,
) -> SyncIncidenciasTressStats:
    # Una sola cota superior para las tres piezas de la corrida.
    hasta = hasta_efectivo(hasta)
    stats = SyncIncidenciasTressStats(desde=desde, hasta=hasta)
    inicio = time.monotonic()
    logger.info(
        "Sync incidencias | inicio | origen=%s | desde=%s | hasta=%s | execute=%s",
        origen,
        desde,
        hasta,
        execute,
    )

    filas_tress = await _leer_tress(desde, hasta)
    stats.leidos = len(filas_tress)

    nos = [f["no_empleado"] for f in filas_tress if f.get("no_empleado") is not None]
    empleados = await EmpleadoRepository(db).map_por_no_empleados(nos)
    stats.empleados = len({n for n in nos})

    cache_repo = IncidenciasTressCacheRepository(db)
    existentes = await cache_repo.map_existentes(desde, hasta)
    # Foto previa: `existentes` crece con los upserts de esta corrida, y el umbral de
    # borrado se mide contra lo que había antes de empezar.
    no_manual_previas = sum(
        1 for fila in existentes.values() if fila.origen != ORIGEN_MANUAL
    )

    try:
        vistas: set[tuple[str, int]] = set()
        # (empleado_id, fecha_evento, tipo) -> fila de TRESS ya en la caché.
        por_clave: dict[tuple[int, date, str], IncidenciaTress] = {}

        for fila in filas_tress:
            aplicada = _aplicar_fila_tress(
                fila, existentes=existentes, empleados=empleados, db=db, stats=stats
            )
            if aplicada is None:
                continue
            vistas.add((aplicada.origen, aplicada.origen_id))
            clave = _clave_evento(aplicada)
            if clave is not None:
                por_clave.setdefault(clave, aplicada)

        # Bajas: lo que estaba en la caché dentro del rango y ya no viene de TRESS.
        obsoletas = {
            llave
            for llave, fila in existentes.items()
            if fila.origen != ORIGEN_MANUAL and llave not in vistas
        }

        # El freno se mide sobre las bajas de TRESS, antes de sumar las llaves `manual`.
        freno = _motivo_para_frenar_borrado(
            leidos=len(filas_tress),
            obsoletas=len(obsoletas),
            no_manual_previas=no_manual_previas,
        )

        manuales_obsoletos = await _reflejar_locales(
            db,
            desde=desde,
            hasta=hasta,
            existentes=existentes,
            por_clave=por_clave,
            stats=stats,
        )
        obsoletas |= manuales_obsoletos

        await db.flush()
        if freno is None:
            stats.eliminados = await cache_repo.delete_llaves(obsoletas)
        else:
            logger.warning(
                "Sync incidencias | borrado omitido | origen=%s | desde=%s | hasta=%s | "
                "leidos=%d | candidatas=%d | %s",
                origen,
                desde,
                hasta,
                stats.leidos,
                len(obsoletas),
                freno,
            )
            stats.registrar_error(freno)

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    stats.duracion_segundos = time.monotonic() - inicio
    logger.info(
        "Sync incidencias | fin | origen=%s | desde=%s | hasta=%s | leidos=%d | "
        "empleados=%d | insertados=%d | actualizados=%d | omitidos=%d | eliminados=%d | "
        "errores=%d | duracion=%.2fs",
        origen,
        desde,
        hasta,
        stats.leidos,
        stats.empleados,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.eliminados,
        stats.errores,
        stats.duracion_segundos,
    )
    return stats


def _aplicar_fila_tress(
    fila: dict[str, Any],
    *,
    existentes: dict[tuple[str, int], IncidenciaTress],
    empleados: dict[int, tuple[int, str | None]],
    db: AsyncSession,
    stats: SyncIncidenciasTressStats,
) -> IncidenciaTress | None:
    """Inserta o actualiza una fila de TRESS. Devuelve la fila de caché resultante."""
    origen = str(fila.get("origen") or "").strip()
    origen_id = fila.get("origen_id")
    tipo = str(fila.get("tipo") or "").strip()
    fecha_evento = fila.get("fecha_evento")
    no_empleado = fila.get("no_empleado")

    if not origen or origen_id is None or fecha_evento is None or no_empleado is None:
        stats.registrar_error(f"fila incompleta: origen={origen!r} id={origen_id!r}")
        return None
    if tipo not in FALTA_RETARDO_TIPOS:
        stats.registrar_error(f"tipo no reconocido: {tipo!r} (origen_id={origen_id})")
        return None

    empleado_id = empleados.get(int(no_empleado), (None, None))[0]
    valores = {
        "no_empleado": int(no_empleado),
        "empleado_id": empleado_id,
        "tipo": tipo,
        "fecha_evento": fecha_evento,
        "fecha_fin": fila.get("fecha_fin"),
        "observaciones": fila.get("observaciones"),
        "fecha_registro": fila.get("fecha_registro"),
    }

    actual = existentes.get((origen, int(origen_id)))
    if actual is None:
        nueva = IncidenciaTress(
            origen=origen, origen_id=int(origen_id), synced_at=_ahora(), **valores
        )
        db.add(nueva)
        existentes[(origen, int(origen_id))] = nueva
        stats.insertados += 1
        return nueva

    cambio = any(getattr(actual, campo) != valor for campo, valor in valores.items())
    for campo, valor in valores.items():
        setattr(actual, campo, valor)
    # `synced_at` marca la última corrida que confirmó la fila, cambie o no, para poder
    # distinguir «sin movimiento» de «caché rancia».
    actual.synced_at = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1
    return actual


async def _reflejar_locales(
    db: AsyncSession,
    *,
    desde: date | None,
    hasta: date | None,
    existentes: dict[tuple[str, int], IncidenciaTress],
    por_clave: dict[tuple[int, date, str], IncidenciaTress],
    stats: SyncIncidenciasTressStats,
) -> set[tuple[str, int]]:
    """Refleja `levelup_faltas_retardos` en la caché. Los dos filos van por separado:

    - **Estampar** `registrado_por_id` / `observaciones` sobre la fila de TRESS que empata
      por (empleado, fecha, tipo): para **todos** los tipos, suspensión incluida. Es la
      atribución que TRESS no guarda, y en `main` el listado la empataba sin filtrar por
      tipo; restringirla perdería el "registrado por" de las suspensiones que capturó RH.
    - **Insertar** como fila `manual` cuando no empata: solo para
      `FALTA_RETARDO_TIPOS_GOCE` (incluye `incapacidad_interna`, que no existe en TRESS).
      Una suspensión sí vive en TRESS: su copia local existe solo para la atribución, y
      convertirla en renglón propio duplicaría lo que el sync traerá de nómina.

    Devuelve las llaves `manual` que ya no hacen falta: las de eventos que llegaron a
    TRESS y las de tipos que nunca debieron entrar como `manual`.
    """
    eventos = await FaltasRetardosRepository(db).list_levelup_filtered(
        fecha_inicio=desde, fecha_fin=hasta
    )
    obsoletos: set[tuple[str, int]] = set()

    for evento in eventos:
        clave = (evento.empleado_id, evento.fecha_evento, evento.tipo)
        gemela = por_clave.get(clave)
        if gemela is not None:
            gemela.registrado_por_id = evento.registrado_por_id
            if evento.observaciones is not None:
                gemela.observaciones = evento.observaciones
            if evento.fecha_fin is not None:
                gemela.fecha_fin = evento.fecha_fin
            # Si en una corrida previa entró como manual, ya sobra.
            if (ORIGEN_MANUAL, evento.id) in existentes:
                obsoletos.add((ORIGEN_MANUAL, evento.id))
            continue

        if evento.tipo not in FALTA_RETARDO_TIPOS_GOCE:
            # No empata todavía (la suspensión llega a TRESS por su propia vía). No se
            # inventa el renglón; si una corrida vieja lo creó, se retira.
            if (ORIGEN_MANUAL, evento.id) in existentes:
                obsoletos.add((ORIGEN_MANUAL, evento.id))
            continue

        valores = {
            "no_empleado": _no_empleado_de(evento),
            "empleado_id": evento.empleado_id,
            "tipo": evento.tipo,
            "fecha_evento": evento.fecha_evento,
            "fecha_fin": evento.fecha_fin,
            "observaciones": evento.observaciones,
            "fecha_registro": None,
            "registrado_por_id": evento.registrado_por_id,
        }
        actual = existentes.get((ORIGEN_MANUAL, evento.id))
        if actual is None:
            nueva = IncidenciaTress(
                origen=ORIGEN_MANUAL,
                origen_id=evento.id,
                synced_at=_ahora(),
                **valores,
            )
            db.add(nueva)
            existentes[(ORIGEN_MANUAL, evento.id)] = nueva
            stats.insertados += 1
            continue

        cambio = any(getattr(actual, campo) != valor for campo, valor in valores.items())
        for campo, valor in valores.items():
            setattr(actual, campo, valor)
        actual.synced_at = _ahora()
        if cambio:
            stats.actualizados += 1
        else:
            stats.omitidos += 1

    return obsoletos


def _no_empleado_de(evento) -> int:
    """`no_empleado` del evento local; 0 si el empleado no trae número."""
    empleado = getattr(evento, "empleado", None)
    numero = getattr(empleado, "no_empleado", None) if empleado is not None else None
    try:
        return int(numero) if numero is not None else 0
    except (TypeError, ValueError):
        return 0
