"""
KPIs personales de nómina para las tarjetas del dashboard (empleado, supervisor, gerente).

Los tres números salen de DATOS_ANALISIS, que es la fuente de verdad de nómina:
- días disponibles y días tomados del ciclo → ``dbo.GET_SALDOS_VACACION`` (una sola
  consulta, para que ambas tarjetas no puedan contradecirse);
- días de home office del año → ``dbo.PERMISO`` con ``PM_TIPO = 'HO'``.

**Degrada en vez de bloquear.** El resto de consumidores de TRESS levanta 503 porque
operan sobre el saldo (crear/validar solicitudes); un dashboard no puede romperse por eso,
así que ante cualquier fallo devuelve ``disponible=False`` con los valores en ``None`` y
la UI pinta «—».
"""

from __future__ import annotations

import logging
from datetime import date

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
)
from app.repositories.datos_analisis_vacaciones_repository import (
    DatosAnalisisVacacionesRepository,
)
from app.schemas.dashboard_kpis import DashboardKpisResponse

logger = logging.getLogger(__name__)


def _sin_datos(anio: int) -> DashboardKpisResponse:
    return DashboardKpisResponse(disponible=False, anio=anio)


def rango_anio_en_curso(hoy: date) -> tuple[date, date]:
    """``[1-ene del año, 1-ene del siguiente)`` — rango semiabierto para la consulta."""
    return date(hoy.year, 1, 1), date(hoy.year + 1, 1, 1)


async def obtener_kpis_dashboard(
    *, no_empleado: int, hoy: date | None = None
) -> DashboardKpisResponse:
    """KPIs de un empleado. Nunca levanta: ante un fallo devuelve el payload degradado."""
    hoy = hoy or date.today()
    desde, hasta = rango_anio_en_curso(hoy)

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception:  # noqa: BLE001 — driver ausente o URL inválida
        logger.warning("KPIs de dashboard sin datos-analisis (no se pudo crear el motor)")
        return _sin_datos(hoy.year)

    if engine is None:
        return _sin_datos(hoy.year)

    try:
        # Un solo motor para las dos consultas: crear/desechar uno por consulta duplica
        # el costo de conexión, que es lo caro de esta integración.
        vacaciones = await DatosAnalisisVacacionesRepository(engine).get_kpis_ciclo(
            cb_codigo=no_empleado
        )
        home_office = await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_en_rango(
            cb_codigo=no_empleado, desde=desde, hasta=hasta
        )
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudieron leer los KPIs de nómina del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return _sin_datos(hoy.year)
    finally:
        await engine.dispose()

    return DashboardKpisResponse(
        disponible=True,
        vacaciones_disponibles=vacaciones.disponibles,
        vacaciones_tomadas_ciclo=vacaciones.tomados_ciclo,
        vacaciones_derecho_ciclo=vacaciones.derecho_ciclo,
        ciclo_aniversario=vacaciones.aniversario,
        ciclo_vence=vacaciones.vence,
        home_office_dias_anio=home_office,
        anio=hoy.year,
    )
