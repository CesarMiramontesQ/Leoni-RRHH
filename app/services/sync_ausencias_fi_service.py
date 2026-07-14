"""Sincroniza ausencias (FI / RE) desde datos-analisis → importadas_historico."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.bono_importadas_historico_repository import BonoImportadasHistoricoRepository
from app.repositories.datos_analisis_ausencias_repository import DatosAnalisisAusenciasRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.faltas_retardos.constants import TIPO_A_PONDERACION

logger = logging.getLogger(__name__)

TipoAusenciaSync = Literal["FI", "RE"]

_TIPO_API_POR_CODIGO: dict[str, str] = {
    "FI": "falta_injustificada",
    "RE": "retardo",
}


@dataclass
class SyncAusenciasStats:
    leidos: int = 0
    insertados: int = 0
    omitidos_duplicado: int = 0
    omitidos_sin_empleado: int = 0
    omitidos_sin_semana: int = 0
    omitidos_incompletos: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)
    tipo_inc: str = ""

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


# Compat alias
SyncAusenciasFiStats = SyncAusenciasStats


def _ponderacion_para(tipo_inc: str) -> tuple[str, int]:
    codigo = str(tipo_inc).strip().upper()
    api = _TIPO_API_POR_CODIGO.get(codigo)
    if api is None:
        raise ValueError(f"tipo_inc no soportado para sync: {tipo_inc!r}")
    tipo_codigo, inc_id = TIPO_A_PONDERACION[api]
    return tipo_codigo, int(inc_id)


class SyncAusenciasService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    async def sincronizar(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        tipo_inc: TipoAusenciaSync | str,
        execute: bool = False,
    ) -> SyncAusenciasStats:
        tipo_codigo, inc_id = _ponderacion_para(tipo_inc)
        stats = SyncAusenciasStats(tipo_inc=tipo_codigo)

        da_engine = DatosAnalisisReadClient.create_read_engine()
        if da_engine is None:
            stats.registrar_error(
                "DATOS_ANALISIS_DB_* no configurado; no se puede leer dbo.AUSENCIA"
            )
            return stats

        bono_engine = BonoProductividadReadClient.create_read_engine()
        if bono_engine is None:
            await da_engine.dispose()
            stats.registrar_error(
                "BONO_DB_* no configurado; no se puede escribir importadas_historico"
            )
            return stats

        try:
            da_repo = DatosAnalisisAusenciasRepository(da_engine)
            bono_repo = BonoImportadasHistoricoRepository(bono_engine)

            try:
                filas = await da_repo.list_ausencias(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    tipo_inc=tipo_codigo,
                )
            except Exception as exc:  # noqa: BLE001 — batch no debe tumbar el scheduler
                stats.registrar_error(
                    f"Error leyendo dbo.AUSENCIA ({tipo_codigo}): {type(exc).__name__}: {exc}"
                )
                return stats

            stats.leidos = len(filas)
            for fila in filas:
                await self._procesar_fila(
                    fila,
                    bono_repo=bono_repo,
                    stats=stats,
                    execute=execute,
                    tipo_inc=tipo_codigo,
                    inc_id=inc_id,
                )
        finally:
            await da_engine.dispose()
            await bono_engine.dispose()

        return stats

    async def _procesar_fila(
        self,
        fila: dict[str, Any],
        *,
        bono_repo: BonoImportadasHistoricoRepository,
        stats: SyncAusenciasStats,
        execute: bool,
        tipo_inc: str,
        inc_id: int,
    ) -> None:
        no_empleado = fila.get("no_empleado")
        fecha_incidencia = fila.get("fecha_incidencia")
        llave = fila.get("ausencia_llave")

        if no_empleado is None or fecha_incidencia is None:
            stats.omitidos_incompletos += 1
            logger.warning(
                "%s omitida (datos incompletos) | llave=%s | no_empleado=%s | fecha=%s",
                tipo_inc,
                llave,
                no_empleado,
                fecha_incidencia,
            )
            return

        try:
            if await bono_repo.exists_evento(
                no_empleado=int(no_empleado),
                fecha_incidencia=fecha_incidencia,
                tipo_inc=tipo_inc,
            ):
                stats.omitidos_duplicado += 1
                return

            empleado = await self.empleado_repo.get_by_no_empleado(str(no_empleado))
            if empleado is None:
                stats.omitidos_sin_empleado += 1
                logger.warning(
                    "%s omitida (empleado no encontrado) | no_empleado=%s | fecha=%s | llave=%s",
                    tipo_inc,
                    no_empleado,
                    fecha_incidencia,
                    llave,
                )
                return

            semana_id = await bono_repo.resolve_semana_id(fecha_incidencia)
            if semana_id is None:
                stats.omitidos_sin_semana += 1
                logger.warning(
                    "%s omitida (sin semana_historico) | no_empleado=%s | fecha=%s | llave=%s",
                    tipo_inc,
                    no_empleado,
                    fecha_incidencia,
                    llave,
                )
                return

            if not execute:
                stats.insertados += 1
                return

            await bono_repo.insert_evento(
                no_empleado=int(no_empleado),
                tipo_inc=tipo_inc,
                inc_id=inc_id,
                id_semana=semana_id,
                area_empleado=empleado.area_id,
                subarea_empleado=empleado.subarea_id,
                fecha_incidencia=fecha_incidencia,
            )
            stats.insertados += 1
        except Exception as exc:  # noqa: BLE001 — continuar con el resto del batch
            stats.registrar_error(
                f"Error procesando {tipo_inc} no_empleado={no_empleado} "
                f"fecha={fecha_incidencia} llave={llave}: {type(exc).__name__}: {exc}"
            )
            logger.exception(
                "Error procesando %s | no_empleado=%s | fecha=%s | llave=%s",
                tipo_inc,
                no_empleado,
                fecha_incidencia,
                llave,
            )


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
