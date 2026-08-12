"""
KPIs personales de nómina para las tarjetas del dashboard (empleado, supervisor, gerente).

Todo sale de cachés en Bono, ninguna carga de página espera a DATOS_ANALISIS:

- Días disponibles y días tomados del ciclo, de `levelup_vacaciones_disponibles`
  (`dbo.GET_SALDOS_VACACION`). Ambas tarjetas vienen de la misma fila, así que no pueden
  contradecirse.
- Días de home office del año, de `levelup_homeoffice_tomados` (`dbo.PERMISO`, `PM_TIPO = 'HO'`).
- Retardos del año, de `levelup_incidencias_tress` (`dbo.AUSENCIA`). El conteo reusa
  `IncidenciasTressCacheRepository.count`, no un `select` propio: el predicado
  `empleado_id IS NOT NULL` y la semántica de rango viven en el helper `_filtros` que
  comparten las seis lecturas de la caché, así que el número de la tarjeta es el mismo que
  RH ve en la página Incidencias. Esa caché se sincroniza los miércoles a las 10:00: un
  retardo reciente puede tardar hasta una semana en aparecer, igual que en esa página.

**Degrada en vez de bloquear.** El resto de consumidores del saldo levanta 503 porque opera
sobre él (crear/validar solicitudes); un dashboard no puede romperse por eso, así que ante
un fallo devuelve ``disponible=False`` con los valores en ``None`` y la UI pinta «—».
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.homeoffice_tomados_repository import HomeOfficeTomadosRepository
from app.repositories.incidencias_tress_cache_repository import (
    IncidenciasTressCacheRepository,
)
from app.repositories.vacaciones_disponibles_repository import (
    VacacionesDisponiblesRepository,
)
from app.schemas.dashboard_kpis import DashboardKpisResponse

logger = logging.getLogger(__name__)


def _sin_datos(anio: int, retardos: int | None) -> DashboardKpisResponse:
    """Payload degradado del bloque de vacaciones. Los retardos viajan igual: son un dato
    independiente y perderlos por un saldo sin sincronizar sería un daño colateral."""
    return DashboardKpisResponse(disponible=False, anio=anio, retardos_anio=retardos)


async def _home_office_dias_anio(
    db: AsyncSession, *, no_empleado: int, anio: int
) -> int | None:
    """Días de home office del año, desde la caché de Bono.

    Sin fila ⇒ ``0``: el empleado no tiene home office registrado en TRESS, que es un dato,
    no una ausencia. ``None`` solo si la propia lectura de Bono falla.
    """
    try:
        fila = await HomeOfficeTomadosRepository(db).get_by_no_empleado_anio(
            no_empleado, anio
        )
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudieron leer los días de home office del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return None
    return int(fila.dias_tomados) if fila is not None else 0


async def _retardos_anio(
    db: AsyncSession, *, no_empleado: int, hoy: date
) -> int | None:
    """Retardos del año en curso, desde la caché de incidencias en Bono.

    Sin filas ⇒ ``0``: el empleado no tuvo retardos, que es un dato y no una ausencia.
    ``None`` solo si la propia lectura de Bono falla.
    """
    try:
        return await IncidenciasTressCacheRepository(db).count(
            fecha_inicio=date(hoy.year, 1, 1),
            fecha_fin=hoy,
            cb_codigos=[no_empleado],
            tipo="retardo",
        )
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudieron contar los retardos del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return None


async def obtener_kpis_dashboard(
    db: AsyncSession, *, no_empleado: int, hoy: date | None = None
) -> DashboardKpisResponse:
    """KPIs de un empleado. Nunca levanta: ante un fallo devuelve el payload degradado."""
    hoy = hoy or date.today()

    # Antes del early-return de vacaciones: un ingreso reciente sin saldo sincronizado
    # igual debe ver sus retardos.
    retardos = await _retardos_anio(db, no_empleado=no_empleado, hoy=hoy)

    try:
        vacaciones = await VacacionesDisponiblesRepository(db).get_by_no_empleado(no_empleado)
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudo leer el saldo de vacaciones del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return _sin_datos(hoy.year, retardos)

    if vacaciones is None:
        # Empleado aún no sincronizado: la UI pinta «—» en vez de un 0 engañoso.
        return _sin_datos(hoy.year, retardos)

    home_office = await _home_office_dias_anio(
        db, no_empleado=no_empleado, anio=hoy.year
    )

    def _num(valor) -> float | None:
        return float(valor) if valor is not None else None

    return DashboardKpisResponse(
        disponible=True,
        vacaciones_disponibles=_num(vacaciones.dias_disponibles),
        vacaciones_tomadas_ciclo=_num(vacaciones.tomados_ciclo),
        vacaciones_derecho_ciclo=_num(vacaciones.derecho_ciclo),
        ciclo_aniversario=vacaciones.aniversario,
        ciclo_vence=vacaciones.fecha_vence,
        home_office_dias_anio=home_office,
        retardos_anio=retardos,
        anio=hoy.year,
    )
