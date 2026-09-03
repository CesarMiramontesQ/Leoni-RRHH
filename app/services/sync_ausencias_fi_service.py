"""Sincroniza ausencias desde datos-analisis → importadas_historico.

Cubre los tipos de `ponderaciones` que viven en dbo.AUSENCIA: faltas, retardos,
incapacidades, suspensiones y vacaciones.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import DomainValidationError, ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.bono_importadas_historico_repository import (
    BonoImportadasHistoricoRepository,
    SemanaAnteriorRango,
)
from app.repositories.datos_analisis_ausencias_repository import DatosAnalisisAusenciasRepository
from app.repositories.empleado_repository import EmpleadoRepository

logger = logging.getLogger(__name__)

TipoAusenciaSync = Literal["FI", "RE"]

# Todos los tipos de `ponderaciones` (area_id=1). Los ocho primeros son AU_TIPO de
# dbo.AUSENCIA; `FJG` (Permiso con Goce) sale de dbo.PERMISO y se expande a dias.
_TIPOS_MIRROR: tuple[str, ...] = (
    "FI",
    "FJ",
    "RE",
    "INC",
    "IN1",
    "ITR",
    "IAC",
    "SUS",
    "VAC",
    "FJG",
)

# No es un AU_TIPO: se lee de dbo.PERMISO (PM_TIPO 'FJ', PM_CLASIFI 0).
_TIPO_PERMISO_GOCE = "FJG"

# El borrado de huérfanos sigue acotado a FI/RE, los únicos que nadie captura a mano.
# Extenderlo a SUS o INC haría que el mirror borrara lo que RH registró desde el modal y
# que nómina todavía no tiene en dbo.AUSENCIA.
_TIPOS_CON_BORRADO: frozenset[str] = frozenset({"FI", "RE"})

# Valor de importadas_historico.estado para los eventos que inserta el mirror.
ESTADO_SINCRONIZADO = 1


@dataclass
class SyncAusenciasStats:
    leidos: int = 0
    insertados: int = 0
    actualizados: int = 0
    eliminados: int = 0
    omitidos_duplicado: int = 0
    omitidos_sin_empleado: int = 0
    omitidos_sin_semana: int = 0
    omitidos_incompletos: int = 0
    omitidos_sin_cambio: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)
    tipo_inc: str = ""
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    id_semana: int | None = None

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


# Compat alias
SyncAusenciasFiStats = SyncAusenciasStats


def _ponderacion_para(tipo_inc: str, ponderaciones: dict[str, int]) -> tuple[str, int]:
    """Código normalizado e `inc_id`, tomando el id del catálogo `ponderaciones`."""
    codigo = str(tipo_inc).strip().upper()
    inc_id = ponderaciones.get(codigo)
    if inc_id is None:
        raise ValueError(
            f"tipo_inc sin ponderacion en Bono: {tipo_inc!r}. "
            f"Conocidos: {', '.join(sorted(ponderaciones))}"
        )
    return codigo, int(inc_id)


def _hoy_app() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _clave_evento(
    no_empleado: int, fecha_incidencia: date, tipo_inc: str
) -> tuple[int, date, str]:
    return (int(no_empleado), fecha_incidencia, str(tipo_inc).strip().upper())


async def _resolver_semana_evento(
    bono_repo: BonoImportadasHistoricoRepository,
    fecha: date,
    cache: dict[date, int | None],
    respaldo: int | None = None,
) -> int | None:
    """Semana de `semana_historico` que contiene `fecha`, memoizada por fecha.

    Es el valor que va tanto a `id_semana` como a `semana_incidencia`: las dos columnas
    guardan la semana del evento. Un rango de una semana trae a lo sumo 7 fechas
    distintas, así que la caché evita una consulta por evento.

    `respaldo` es la semana del rango sincronizado, que se usa solo si la fecha no cae en
    ninguna fila de `semana_historico`.
    """
    if fecha not in cache:
        cache[fecha] = await bono_repo.resolve_semana_id(fecha)
    return cache[fecha] if cache[fecha] is not None else respaldo


class SyncAusenciasService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    async def sincronizar_semana_anterior(
        self,
        *,
        execute: bool = True,
        hoy: date | None = None,
    ) -> SyncAusenciasStats:
        """Mirror de la semana anterior a ``hoy`` (APP_TIMEZONE por defecto)."""
        dia = hoy or _hoy_app()
        bono_engine = BonoProductividadReadClient.create_mirror_engine()
        if bono_engine is None:
            raise ServiceUnavailableError(
                "BONO_DB_* no configurado; no se puede sincronizar importadas_historico"
            )
        mirror = (settings.BONO_MIRROR_DB_NAME or "").strip()
        if mirror:
            logger.info(
                "Mirror importadas_historico → %s (app=%s)",
                mirror,
                settings.BONO_DB_NAME,
            )
        try:
            bono_repo = BonoImportadasHistoricoRepository(bono_engine)
            rango = await bono_repo.resolve_rango_semana_anterior(dia)
            if rango is None:
                raise DomainValidationError(
                    "No se encontró la semana anterior en semana_historico "
                    f"para la fecha {dia.isoformat()}."
                )
            return await self.sincronizar_mirror(
                fecha_inicio=rango.fecha_inicio,
                fecha_fin=rango.fecha_fin,
                id_semana=rango.id_semana,
                execute=execute,
                bono_engine=bono_engine,
                bono_repo=bono_repo,
            )
        finally:
            await bono_engine.dispose()

    async def sincronizar_mirror(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        id_semana: int | None = None,
        execute: bool = True,
        tipos: tuple[str, ...] = _TIPOS_MIRROR,
        bono_engine: Any | None = None,
        bono_repo: BonoImportadasHistoricoRepository | None = None,
    ) -> SyncAusenciasStats:
        """
        Deja importadas_historico igual a dbo.AUSENCIA para `tipos` en el rango.

        Inserta, actualiza y elimina en una sola transacción Bono.
        """
        stats = SyncAusenciasStats(
            tipo_inc="+".join(tipos),
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            id_semana=id_semana,
        )

        owns_bono = bono_engine is None
        da_engine = DatosAnalisisReadClient.create_read_engine()
        if da_engine is None:
            raise ServiceUnavailableError(
                "DATOS_ANALISIS_DB_* no configurado; no se puede leer dbo.AUSENCIA"
            )
        if bono_engine is None:
            bono_engine = BonoProductividadReadClient.create_mirror_engine()
        if bono_engine is None:
            await da_engine.dispose()
            raise ServiceUnavailableError(
                "BONO_DB_* no configurado; no se puede escribir importadas_historico"
            )

        if bono_repo is None:
            bono_repo = BonoImportadasHistoricoRepository(bono_engine)

        try:
            da_repo = DatosAnalisisAusenciasRepository(da_engine)
            ponderaciones = await bono_repo.map_ponderaciones_por_codigo()
            fuente: dict[tuple[int, date, str], dict[str, Any]] = {}
            for tipo in tipos:
                tipo_codigo, inc_id = _ponderacion_para(tipo, ponderaciones)
                origen_tabla = (
                    "dbo.PERMISO"
                    if tipo_codigo == _TIPO_PERMISO_GOCE
                    else "dbo.AUSENCIA"
                )
                try:
                    if tipo_codigo == _TIPO_PERMISO_GOCE:
                        filas = await da_repo.list_permisos_goce_dias(
                            fecha_inicio=fecha_inicio,
                            fecha_fin=fecha_fin,
                        )
                    else:
                        filas = await da_repo.list_ausencias(
                            fecha_inicio=fecha_inicio,
                            fecha_fin=fecha_fin,
                            tipo_inc=tipo_codigo,
                        )
                except Exception as exc:
                    raise ServiceUnavailableError(
                        f"Error leyendo {origen_tabla} ({tipo_codigo}): "
                        f"{type(exc).__name__}: {exc}"
                    ) from exc
                stats.leidos += len(filas)
                for fila in filas:
                    no_empleado = fila.get("no_empleado")
                    fecha_incidencia = fila.get("fecha_incidencia")
                    if no_empleado is None or fecha_incidencia is None:
                        stats.omitidos_incompletos += 1
                        continue
                    clave = _clave_evento(int(no_empleado), fecha_incidencia, tipo_codigo)
                    fuente[clave] = {
                        "no_empleado": int(no_empleado),
                        "fecha_incidencia": fecha_incidencia,
                        "tipo_inc": tipo_codigo,
                        "inc_id": inc_id,
                        "ausencia_llave": fila.get("ausencia_llave"),
                    }

            existentes = await bono_repo.list_eventos_en_rango(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                tipos=tipos,
            )
            dest: dict[tuple[int, date, str], dict[str, Any]] = {}
            for row in existentes:
                no_empleado = row.get("no_empleado")
                fecha_incidencia = row.get("fecha_incidencia")
                tipo_inc = str(row.get("tipo_inc") or "").strip().upper()
                if no_empleado is None or fecha_incidencia is None or not tipo_inc:
                    continue
                dest[_clave_evento(int(no_empleado), fecha_incidencia, tipo_inc)] = row

            if id_semana is None:
                id_semana = await bono_repo.resolve_semana_id(fecha_inicio)
                stats.id_semana = id_semana

            to_insert: list[dict[str, Any]] = []
            to_update: list[tuple[dict[str, Any], dict[str, Any]]] = []
            to_delete: list[dict[str, Any]] = []
            cache_semanas: dict[date, int | None] = {}

            for clave, src in fuente.items():
                existing = dest.get(clave)
                if existing is None:
                    empleado = await self.empleado_repo.get_by_no_empleado(
                        str(src["no_empleado"])
                    )
                    if empleado is None:
                        stats.omitidos_sin_empleado += 1
                        logger.warning(
                            "%s omitida (empleado no encontrado) | no_empleado=%s | fecha=%s",
                            src["tipo_inc"],
                            src["no_empleado"],
                            src["fecha_incidencia"],
                        )
                        continue
                    semana = await _resolver_semana_evento(
                        bono_repo, src["fecha_incidencia"], cache_semanas, id_semana
                    )
                    if semana is None:
                        stats.omitidos_sin_semana += 1
                        continue
                    to_insert.append(
                        {
                            **src,
                            # Las dos columnas llevan el mismo valor.
                            "id_semana": semana,
                            "semana_incidencia": semana,
                            "area_empleado": empleado.area_id,
                            "subarea_empleado": empleado.subarea_id,
                        }
                    )
                    continue

                empleado = await self.empleado_repo.get_by_no_empleado(
                    str(src["no_empleado"])
                )
                area = empleado.area_id if empleado else existing.get("area_empleado")
                subarea = (
                    empleado.subarea_id if empleado else existing.get("subarea_empleado")
                )
                # `id_semana` la administra el trigger de Bono: el sync ni la compara ni
                # la escribe. Compararla dispararía un UPDATE en cada corrida, porque el
                # valor del trigger no tiene por qué coincidir con el de la fecha.
                desired_inc = src["inc_id"]
                changed = (
                    int(existing.get("inc_id") or 0) != int(desired_inc)
                    or existing.get("area_empleado") != area
                    or existing.get("subarea_empleado") != subarea
                )
                if changed:
                    to_update.append(
                        (
                            existing,
                            {
                                "inc_id": desired_inc,
                                "area_empleado": area,
                                "subarea_empleado": subarea,
                            },
                        )
                    )
                else:
                    stats.omitidos_sin_cambio += 1
                    # Compat: mismos conteos que el sync insert-only trataba como duplicado.
                    stats.omitidos_duplicado += 1

            for clave, row in dest.items():
                if clave in fuente:
                    continue
                # `clave` es (no_empleado, fecha, tipo_inc).
                if clave[2] in _TIPOS_CON_BORRADO:
                    to_delete.append(row)

            if not execute:
                stats.insertados = len(to_insert)
                stats.actualizados = len(to_update)
                stats.eliminados = len(to_delete)
                return stats

            async with bono_engine.begin() as conn:
                for item in to_insert:
                    await bono_repo.insert_evento(
                        no_empleado=item["no_empleado"],
                        tipo_inc=item["tipo_inc"],
                        inc_id=item["inc_id"],
                        id_semana=item["id_semana"],
                        area_empleado=item["area_empleado"],
                        subarea_empleado=item["subarea_empleado"],
                        fecha_incidencia=item["fecha_incidencia"],
                        estado=ESTADO_SINCRONIZADO,
                        semana_incidencia=item["semana_incidencia"],
                        conn=conn,
                    )
                    stats.insertados += 1
                for existing, patch in to_update:
                    await bono_repo.update_evento(
                        evento_id=int(existing["id"]),
                        inc_id=patch["inc_id"],
                        area_empleado=patch["area_empleado"],
                        subarea_empleado=patch["subarea_empleado"],
                        conn=conn,
                    )
                    stats.actualizados += 1
                for row in to_delete:
                    await bono_repo.delete_evento_by_id(
                        evento_id=int(row["id"]),
                        conn=conn,
                    )
                    stats.eliminados += 1
        except (DomainValidationError, ServiceUnavailableError):
            raise
        except Exception as exc:
            logger.error(
                "Error en mirror sync ausencias FI/RE | rango=%s..%s: %s",
                fecha_inicio,
                fecha_fin,
                exc,
                exc_info=True,
            )
            raise ServiceUnavailableError(
                f"Error sincronizando faltas y retardos: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await da_engine.dispose()
            if owns_bono:
                await bono_engine.dispose()

        logger.info(
            "Mirror sync ausencias | rango=%s..%s semana=%s | leidos=%d "
            "insertados=%d actualizados=%d eliminados=%d sin_emp=%d",
            fecha_inicio.isoformat(),
            fecha_fin.isoformat(),
            id_semana,
            stats.leidos,
            stats.insertados,
            stats.actualizados,
            stats.eliminados,
            stats.omitidos_sin_empleado,
        )
        return stats

    async def sincronizar(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        tipo_inc: TipoAusenciaSync | str,
        execute: bool = False,
    ) -> SyncAusenciasStats:
        """Compat CLI/tests: mirror de un solo tipo en el rango dado."""
        tipo_codigo = str(tipo_inc).strip().upper()
        stats = await self.sincronizar_mirror(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            execute=execute,
            tipos=(tipo_codigo,),
        )
        stats.tipo_inc = tipo_codigo
        return stats


class SyncAusenciasFiService(SyncAusenciasService):
    """Compat: sync solo FI."""

    async def sincronizar(  # type: ignore[override]
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        execute: bool = False,
        tipo_inc: TipoAusenciaSync | str = "FI",
    ) -> SyncAusenciasStats:
        return await SyncAusenciasService.sincronizar(
            self,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            tipo_inc="FI",
            execute=execute,
        )
