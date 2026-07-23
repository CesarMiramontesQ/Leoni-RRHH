"""
Servicio agregador del índice de Historial Objetivo.

Junta las fuentes de un empleado (actas de la BD principal + incidencias y
faltas/retardos de la BD externa ``bono_productividad``), aplica la fórmula
pura de ``app.services.historial_objetivo.formula`` y produce el índice +
semáforo + desglose por fuente. El scope de equipo (quién puede ver a quién)
usa el helper centralizado ``empleado_ids_scope_por_modulo``.

Capas: este servicio consume el paquete de cálculo puro (Tarea 1),
``ActaRepository`` (Tarea 2), ``empleado_ids_scope_por_modulo`` (Tarea 3) y
los repos de bono existentes (incidencias/faltas). No define endpoints ni
schemas Pydantic -- eso es responsabilidad de la Tarea 5, que mapea las
estructuras devueltas aquí (``HistorialObjetivoResponse`` /
``HistorialObjetivoEquipoResponse``, dataclasses propias) a los schemas de
respuesta HTTP.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.core.exceptions import (
    DomainValidationError,
    ForbiddenError,
    LeoniException,
    NotFoundError,
    ServiceUnavailableError,
)
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.repositories.acta_repository import ActaRepository
from app.repositories.bono_faltas_retardos_repository import BonoFaltasRetardosRepository
from app.repositories.bono_historico_incidencias_repository import (
    BonoHistoricoIncidenciasRepository,
)
from app.repositories.bono_progresivo_repository import BonoProgresivoRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.faltas_retardos.constants import CODIGO_PONDERACION_A_TIPO
from app.services.historial_objetivo.constants import (
    FUENTE_ACTAS,
    FUENTE_FALTAS,
    FUENTE_INCIDENCIAS,
    FUENTE_PROGRESIVO,
    PESOS_POR_FUENTE,
    TIPO_PROGRESIVO_PIERDE_BONO,
)
from app.services.historial_objetivo.formula import calcular_indice
from app.services.historial_objetivo.types import (
    ConteosFuente,
    ConteosHistorial,
    ResultadoIndiceObjetivo,
)
from app.services.incidencia_fuentes.types import IncidenciaFuenteFilters

logger = logging.getLogger(__name__)

# Clave de módulo usada por `effective_data_scope_for_module` / `user_has_module`
# (permiso RH otorgado sobre este módulo eleva el scope a "rh" -- vista global).
MODULE_KEY = "historial-objetivo"

# Tope duro para `indice_equipo` cuando el scope efectivo es universo (RH/director
# sin equipo delimitado): jamás se agrega la organización completa sin límite.
# Se aplica tanto al `limit` pasado a las agregaciones de bono (que ya ordenan
# por conteo descendente y truncan) como al tamaño final del ranking devuelto.
TOPE_ALTO_EQUIPO = 500


@dataclass(frozen=True)
class HistorialObjetivoResponse:
    """Resultado del índice objetivo de un solo empleado (`indice_empleado`)."""

    empleado_id: int
    resultado: ResultadoIndiceObjetivo
    bono_disponible: bool


@dataclass(frozen=True)
class HistorialObjetivoEquipoItem:
    """Una fila del ranking de equipo (`indice_equipo`)."""

    empleado_id: int
    no_empleado: str | None
    nombre: str | None
    resultado: ResultadoIndiceObjetivo


@dataclass(frozen=True)
class HistorialObjetivoEquipoResponse:
    """Ranking de equipo, peor índice primero (`indice_equipo`)."""

    items: tuple[HistorialObjetivoEquipoItem, ...]
    bono_disponible: bool


@dataclass(frozen=True)
class _BonoAgregado:
    """Resultado interno de agregar ambas fuentes de bono sobre un único engine."""

    disponible: bool
    faltas_por_empleado: dict[int, ConteosFuente]
    incidencias_por_empleado: dict[int, ConteosFuente]
    progresivo_por_empleado: dict[int, ConteosFuente]
    info_por_empleado: dict[int, tuple[str | None, str | None]]


class HistorialObjetivoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)
        self.acta_repo = ActaRepository(db)

    # ── Validaciones / scope ────────────────────────────────────────────────

    def _validar_rango_fechas(self, fecha_inicio: date | None, fecha_fin: date | None) -> None:
        if fecha_inicio is not None and fecha_fin is not None and fecha_inicio > fecha_fin:
            raise DomainValidationError("fecha_inicio no puede ser posterior a fecha_fin")

    async def _ensure_puede_ver_empleado(
        self,
        empleado_id: int,
        scope_ids: list[int] | None,
    ) -> Empleado:
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if empleado is None:
            raise NotFoundError("Empleado", empleado_id)
        if scope_ids is not None and empleado_id not in scope_ids:
            raise ForbiddenError(
                "No tiene permiso para ver el historial objetivo de este empleado"
            )
        return empleado

    # ── Conteos por fuente (con blindaje anti-tipo-desconocido) ─────────────

    def _conteos_fuente_filtrados(self, fuente: str, conteos_raw: dict[str, int]) -> ConteosFuente:
        """Construye un `ConteosFuente` descartando claves que no pertenezcan a
        `PESOS_POR_FUENTE[fuente]`.

        Nota de revisión: `formula._desglose_fuente` ya trata un tipo
        desconocido como peso 0 (silencioso, documentado en
        `types.ConteosFuente`); aquí, un nivel antes -- al construir los
        conteos desde datos externos (bono) -- se valida explícitamente contra
        la tabla de pesos y se loguea cualquier tipo no reconocido en vez de
        dejarlo pasar en silencio. Así un `tipo_codigo`/`tipo_incidencia`/
        `estado` nuevo o corrupto en la BD externa queda visible en logs en
        vez de simplemente no penalizar sin que nadie se entere.
        """
        pesos = PESOS_POR_FUENTE.get(fuente, {})
        conteos: dict[str, int] = {}
        for tipo, cnt in conteos_raw.items():
            if not cnt:
                continue
            if tipo not in pesos:
                logger.warning(
                    "historial_objetivo: tipo %r desconocido para la fuente %r "
                    "(no está en PESOS_POR_FUENTE) -- se ignora, penaliza 0 explícitamente",
                    tipo,
                    fuente,
                )
                continue
            conteos[tipo] = conteos.get(tipo, 0) + int(cnt)
        return ConteosFuente(conteos=conteos)

    def _faltas_conteos_por_codigo_a_tipo(self, por_codigo: dict[str, int]) -> dict[str, int]:
        """Mapea conteos por código de ponderación bono (`FI`, `RE`, ...) a
        tipo de la API (`falta_injustificada`, `retardo`, ...), igual que
        `FaltasRetardosService._map_por_codigo_a_tipo`. Un código no mapeado se
        ignora y se loguea (no debería ocurrir salvo dato nuevo en bono)."""
        por_tipo: dict[str, int] = {}
        for codigo, count in por_codigo.items():
            if not count:
                continue
            tipo = CODIGO_PONDERACION_A_TIPO.get(codigo.upper())
            if tipo is None:
                logger.warning(
                    "historial_objetivo: código de ponderación %r desconocido "
                    "en faltas/retardos de bono -- se ignora",
                    codigo,
                )
                continue
            por_tipo[tipo] = por_tipo.get(tipo, 0) + int(count)
        return por_tipo

    # ── Bono: engine único + ambos repos ─────────────────────────────────────

    async def _agregar_bono(
        self,
        *,
        empleado_id: int | None,
        empleado_ids_scope: list[int] | None,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        limit: int,
    ) -> _BonoAgregado:
        """Abre UN engine de bono, instancia ambos repos (incidencias + faltas)
        sobre él y hace `dispose()` en `finally`. Si el engine no está
        configurado (`BONO_DB_*` ausente) degrada con gracia: el índice se
        calcula solo con actas y `bono_disponible=False` en la respuesta."""
        engine: AsyncEngine | None = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            logger.warning(
                "historial_objetivo: BONO_DB_* no configurado -- se degrada a "
                "solo actas (incidencias/faltas de bono no disponibles)"
            )
            return _BonoAgregado(
                disponible=False,
                faltas_por_empleado={},
                incidencias_por_empleado={},
                progresivo_por_empleado={},
                info_por_empleado={},
            )

        incidencias_repo = BonoHistoricoIncidenciasRepository(engine)
        faltas_repo = BonoFaltasRetardosRepository(engine)
        progresivo_repo = BonoProgresivoRepository(engine)
        try:
            incidencia_filters = IncidenciaFuenteFilters(
                empleado_id=empleado_id,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                empleado_ids_scope=empleado_ids_scope,
            )
            incidencias_raw = await incidencias_repo.aggregate_empleados_top_por_tipo(
                incidencia_filters, limit=limit
            )
            faltas_raw = await faltas_repo.aggregate_empleados_top_por_tipo(
                limit=limit,
                empleado_id=empleado_id,
                tipo=None,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                busqueda=None,
                area=None,
                empleado_ids_scope=empleado_ids_scope,
            )
            progresivo_raw = await progresivo_repo.aggregate_semanas_sin_bono_por_empleado(
                empleado_id=empleado_id,
                empleado_ids_scope=empleado_ids_scope,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar fuentes de bono para historial objetivo: "
                f"{type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

        incidencias_por_empleado = {
            eid: self._conteos_fuente_filtrados(FUENTE_INCIDENCIAS, por_tipo)
            for eid, _no, _nombre, _cnt, por_tipo in incidencias_raw
        }
        faltas_por_empleado = {
            eid: self._conteos_fuente_filtrados(
                FUENTE_FALTAS, self._faltas_conteos_por_codigo_a_tipo(por_codigo)
            )
            for eid, _no, _nombre, _cnt, por_codigo in faltas_raw
        }
        progresivo_por_empleado = {
            eid: self._conteos_fuente_filtrados(
                FUENTE_PROGRESIVO, {TIPO_PROGRESIVO_PIERDE_BONO: semanas}
            )
            for eid, semanas in progresivo_raw.items()
        }
        info_por_empleado: dict[int, tuple[str | None, str | None]] = {}
        for eid, no, nombre, _cnt, _por_tipo in incidencias_raw:
            info_por_empleado[eid] = (no, nombre)
        for eid, no, nombre, _cnt, _por_codigo in faltas_raw:
            info_por_empleado.setdefault(eid, (no, nombre))

        return _BonoAgregado(
            disponible=True,
            faltas_por_empleado=faltas_por_empleado,
            incidencias_por_empleado=incidencias_por_empleado,
            progresivo_por_empleado=progresivo_por_empleado,
            info_por_empleado=info_por_empleado,
        )

    # ── Cálculo compartido para un solo empleado ─────────────────────────────

    async def _calcular_resultado_empleado(
        self,
        empleado_id: int,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> tuple[ResultadoIndiceObjetivo, bool]:
        actas_counts = await self.acta_repo.count_por_empleado_por_estado(
            [empleado_id], fecha_inicio, fecha_fin
        )
        actas_fuente = self._conteos_fuente_filtrados(
            FUENTE_ACTAS, actas_counts.get(empleado_id, {})
        )
        bono = await self._agregar_bono(
            empleado_id=empleado_id,
            empleado_ids_scope=None,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            limit=1,
        )
        conteos = ConteosHistorial(
            actas=actas_fuente,
            faltas=bono.faltas_por_empleado.get(empleado_id, ConteosFuente()),
            incidencias=bono.incidencias_por_empleado.get(empleado_id, ConteosFuente()),
            progresivo=bono.progresivo_por_empleado.get(empleado_id, ConteosFuente()),
        )
        return calcular_indice(conteos), bono.disponible

    # ── API pública ──────────────────────────────────────────────────────────

    async def indice_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        rh_ui_mode: str | None = None,
    ) -> HistorialObjetivoResponse:
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
        scope_ids = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        await self._ensure_puede_ver_empleado(empleado_id, scope_ids)

        resultado, bono_disponible = await self._calcular_resultado_empleado(
            empleado_id, fecha_inicio, fecha_fin
        )
        return HistorialObjetivoResponse(
            empleado_id=empleado_id,
            resultado=resultado,
            bono_disponible=bono_disponible,
        )

    async def indice_equipo(
        self,
        current_user: Empleado,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        rh_ui_mode: str | None = None,
    ) -> HistorialObjetivoEquipoResponse:
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
        scope_ids = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )

        if scope_ids is not None:
            limit = len(scope_ids) or 1
            actas_empleado_ids: list[int] | None = scope_ids
            bono_scope: list[int] | None = scope_ids
        else:
            # RH/director sin equipo delimitado: universo. Requisito del plan --
            # nunca agregar toda la organización sin límite -- se aplica un tope
            # duro explícito tanto al `limit` de las agregaciones de bono como al
            # tamaño final del ranking devuelto (ver truncado más abajo). Además,
            # sin rango de fechas la consulta de actas (`count_por_empleado_por_estado`
            # con `empleado_ids=None`) queda sin acotar por empleado NI por fecha --
            # se exige un rango explícito para que TODAS las fuentes (incluidas
            # actas) queden acotadas. El default (últimos 12 meses) lo aplica la
            # API (Tarea 5); el service se protege y nunca agrega el universo sin
            # rango, sin importar quién llame.
            if fecha_inicio is None or fecha_fin is None:
                raise DomainValidationError(
                    "Para el ranking global de RH debes especificar un rango de fechas"
                )
            limit = TOPE_ALTO_EQUIPO
            actas_empleado_ids = None
            bono_scope = None

        actas_counts = await self.acta_repo.count_por_empleado_por_estado(
            actas_empleado_ids, fecha_inicio, fecha_fin
        )
        bono = await self._agregar_bono(
            empleado_id=None,
            empleado_ids_scope=bono_scope,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            limit=limit,
        )

        if scope_ids is not None:
            # Equipo delimitado: cubre TODO el equipo, no solo quienes tengan
            # eventos -- un empleado con historial limpio también debe aparecer
            # (índice 100). Se usa el scope directo, no la unión de fuentes.
            ids_universo: set[int] = set(scope_ids)
        else:
            # RH/director sin equipo delimitado (universo): no hay forma acotada
            # de enumerar "todos" sin un tope; se arma desde la unión de fuentes
            # (cada una ya truncada a TOPE_ALTO_EQUIPO) y se trunca de nuevo abajo.
            ids_universo = (
                set(actas_counts)
                | set(bono.faltas_por_empleado)
                | set(bono.incidencias_por_empleado)
            )

        # Empleados que solo aparecen en actas (sin eventos de bono en el
        # rango): no tenemos su no_empleado/nombre desde la agregación de
        # bono. Se resuelven en UNA sola query bulk (evita N+1 -- antes se
        # disparaba una consulta puntual por empleado dentro del loop).
        faltantes_ids = [eid for eid in ids_universo if eid not in bono.info_por_empleado]
        nombres_faltantes = await self.empleado_repo.get_nombres_por_empleado_ids(faltantes_ids)

        items: list[HistorialObjetivoEquipoItem] = []
        for eid in ids_universo:
            conteos = ConteosHistorial(
                actas=self._conteos_fuente_filtrados(FUENTE_ACTAS, actas_counts.get(eid, {})),
                faltas=bono.faltas_por_empleado.get(eid, ConteosFuente()),
                incidencias=bono.incidencias_por_empleado.get(eid, ConteosFuente()),
                progresivo=bono.progresivo_por_empleado.get(eid, ConteosFuente()),
            )
            resultado = calcular_indice(conteos)
            if eid in bono.info_por_empleado:
                no, nombre = bono.info_por_empleado[eid]
            else:
                no, nombre = nombres_faltantes.get(eid, (None, None))
            items.append(
                HistorialObjetivoEquipoItem(
                    empleado_id=eid, no_empleado=no, nombre=nombre, resultado=resultado
                )
            )

        # Peor índice primero: es lo más accionable para RH/supervisores.
        items.sort(key=lambda it: it.resultado.indice)
        if scope_ids is None:
            items = items[:TOPE_ALTO_EQUIPO]

        return HistorialObjetivoEquipoResponse(items=tuple(items), bono_disponible=bono.disponible)

    # ── Firmas-espejo fase 2 (consumo futuro desde Ciclo de Desempeño) ───────

    async def indices_historial_por_empleado(
        self,
        empleado_ids: list[int],
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> dict[int, float | None]:
        """Indice objetivo por empleado para el conjunto dado, con UN solo engine
        de bono (reusa `_agregar_bono`, que hace `dispose()` en `finally`).
        Pensado para consumo interno servicio-a-servicio (Ciclo de Desempeno),
        sin resolver scope de `current_user`. Si el bono no esta disponible o
        falla la consulta, degrada devolviendo `None` para todos (senal ausente,
        no crash). Lista vacia -> dict vacio."""
        if not empleado_ids:
            return {}
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
        try:
            actas_counts = await self.acta_repo.count_por_empleado_por_estado(
                empleado_ids, fecha_inicio, fecha_fin
            )
            bono = await self._agregar_bono(
                empleado_id=None,
                empleado_ids_scope=list(empleado_ids),
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                limit=len(empleado_ids) or 1,
            )
        except LeoniException:
            return {eid: None for eid in empleado_ids}

        out: dict[int, float | None] = {}
        for eid in empleado_ids:
            if not bono.disponible:
                out[eid] = None
                continue
            conteos = ConteosHistorial(
                actas=self._conteos_fuente_filtrados(FUENTE_ACTAS, actas_counts.get(eid, {})),
                faltas=bono.faltas_por_empleado.get(eid, ConteosFuente()),
                incidencias=bono.incidencias_por_empleado.get(eid, ConteosFuente()),
                progresivo=bono.progresivo_por_empleado.get(eid, ConteosFuente()),
            )
            out[eid] = calcular_indice(conteos).indice
        return out

    async def indice_historial_empleado(
        self,
        empleado_id: int,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> float:
        """Mismo cálculo que `indice_empleado`, sin resolver scope de usuario:
        pensado para una llamada interna servicio-a-servicio (p. ej. desde
        Ciclo de Desempeño), no para una petición HTTP con `current_user`. Aún
        no está conectada a ningún endpoint ni consumidor real -- firma lista
        para cuando exista ese consumidor."""
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if empleado is None:
            raise NotFoundError("Empleado", empleado_id)
        resultado, _bono_disponible = await self._calcular_resultado_empleado(
            empleado_id, fecha_inicio, fecha_fin
        )
        return resultado.indice

    async def indice_historial_empleado_o_none(
        self,
        empleado_id: int,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> float | None:
        """Igual que `indice_historial_empleado`, pero devuelve `None` en vez de
        propagar cualquier excepción de dominio (empleado inexistente, rango de
        fechas inválido, bono no disponible/con error) -- para consumidores que
        prefieren degradar en silencio en vez de fallar."""
        try:
            return await self.indice_historial_empleado(empleado_id, fecha_inicio, fecha_fin)
        except LeoniException:
            return None
