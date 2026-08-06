"""
KPIs personales de nómina para las tarjetas del dashboard (empleado, supervisor, gerente).

- Días disponibles y días tomados del ciclo salen de `levelup_vacaciones_disponibles`, la
  caché en Bono que el sync alimenta desde ``dbo.GET_SALDOS_VACACION``. Ambas tarjetas
  vienen de la misma fila, así que no pueden contradecirse, y el dashboard ya no espera a
  la BD externa para pintarlas.
- Los días de home office del año siguen leyéndose de ``dbo.PERMISO`` (``PM_TIPO = 'HO'``)
  en DATOS_ANALISIS, en su propio try/except: si esa BD no responde, las vacaciones se
  devuelven igual y solo el home office queda en ``None``.

**Degrada en vez de bloquear.** El resto de consumidores del saldo levanta 503 porque opera
sobre él (crear/validar solicitudes); un dashboard no puede romperse por eso, así que ante
un fallo devuelve ``disponible=False`` con los valores en ``None`` y la UI pinta «—».
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
)
from app.repositories.vacaciones_disponibles_repository import (
    VacacionesDisponiblesRepository,
)
from app.schemas.dashboard_kpis import DashboardKpisResponse

logger = logging.getLogger(__name__)


def _sin_datos(anio: int) -> DashboardKpisResponse:
    return DashboardKpisResponse(disponible=False, anio=anio)


def rango_anio_en_curso(hoy: date) -> tuple[date, date]:
    """``[1-ene del año, 1-ene del siguiente)`` — rango semiabierto para la consulta."""
    return date(hoy.year, 1, 1), date(hoy.year + 1, 1, 1)


async def _home_office_dias_anio(*, no_empleado: int, desde: date, hasta: date) -> int | None:
    """Días de home office del año. ``None`` si datos-analisis no responde."""
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception:  # noqa: BLE001 — driver ausente o URL inválida
        logger.warning("KPIs de dashboard sin home office (no se pudo crear el motor)")
        return None
    if engine is None:
        return None
    try:
        return await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_en_rango(
            cb_codigo=no_empleado, desde=desde, hasta=hasta
        )
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudieron leer los días de home office del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return None
    finally:
        await engine.dispose()


async def obtener_kpis_dashboard(
    db: AsyncSession, *, no_empleado: int, hoy: date | None = None
) -> DashboardKpisResponse:
    """KPIs de un empleado. Nunca levanta: ante un fallo devuelve el payload degradado."""
    hoy = hoy or date.today()
    desde, hasta = rango_anio_en_curso(hoy)

    try:
        vacaciones = await VacacionesDisponiblesRepository(db).get_by_no_empleado(no_empleado)
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudo leer el saldo de vacaciones del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return _sin_datos(hoy.year)

    if vacaciones is None:
        # Empleado aún no sincronizado: la UI pinta «—» en vez de un 0 engañoso.
        return _sin_datos(hoy.year)

    home_office = await _home_office_dias_anio(
        no_empleado=no_empleado, desde=desde, hasta=hasta
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
        anio=hoy.year,
    )
