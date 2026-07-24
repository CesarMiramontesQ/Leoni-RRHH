"""Bloques de capacitacion y PDI: agregacion por area, semaforo y la regla de
que 'sin datos' es None y no 0%."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.level_up_cursos_dashboard import CursosAreaAgg
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_bloque_capacitacion_agrega_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_cap@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    resumen = {
        7: CursosAreaAgg(total_pares=10, completados=9, empleados_obligatorio_pendiente={1}),
        8: CursosAreaAgg(total_pares=10, completados=2, empleados_obligatorio_pendiente={2, 3}),
    }
    with patch(
        "app.services.talento_service.LevelUpCursosDashboardService.resumen_por_area",
        AsyncMock(return_value=resumen),
    ), patch.object(
        TalentoService, "nombres_de_areas",
        AsyncMock(return_value={7: "Arneses A", 8: "Arneses B"}),
    ):
        bloque = await svc.bloque_capacitacion(rh, None)

    por_id = {a.area_id: a for a in bloque.areas}
    assert por_id[7].cumplimiento_pct == 90.0
    assert por_id[7].semaforo == "verde"
    assert por_id[8].cumplimiento_pct == 20.0
    assert por_id[8].semaforo == "rojo"
    assert por_id[8].n_obligatorio_pendiente == 2
    assert bloque.org.cumplimiento_pct == 55.0  # 11 completados de 20 pares


@pytest.mark.asyncio
async def test_bloque_capacitacion_area_sin_pares_es_none(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_cap_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    resumen = {7: CursosAreaAgg(total_pares=0, completados=0, empleados_obligatorio_pendiente=set())}
    with patch(
        "app.services.talento_service.LevelUpCursosDashboardService.resumen_por_area",
        AsyncMock(return_value=resumen),
    ), patch.object(TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})):
        bloque = await svc.bloque_capacitacion(rh, None)

    assert bloque.areas[0].cumplimiento_pct is None
    assert bloque.areas[0].semaforo is None


@pytest.mark.asyncio
async def test_bloque_pdi_agrega_y_cuenta_vencidos(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_pdi@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    filas = [
        SimpleNamespace(
            empleado_id=1, total=4, completadas=2, en_proceso=1, pendientes=1,
            vencidas=1, cancelados=0,
        ),
        SimpleNamespace(
            empleado_id=2, total=2, completadas=2, en_proceso=0, pendientes=0,
            vencidas=0, cancelados=0,
        ),
    ]
    with patch(
        "app.services.talento_service.PDIRepository.equipo_pdi_aggregates",
        AsyncMock(return_value=filas),
    ), patch.object(
        TalentoService, "areas_de_empleados", AsyncMock(return_value={1: 7, 2: 7})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        bloque = await svc.bloque_pdi(rh, None)

    area = bloque.areas[0]
    assert area.cumplimiento_pct == 66.7  # 4 completadas de 6
    assert area.n_vencidos == 1
    assert area.n_activos == 1  # 1 en_proceso + 1 pendiente - 1 vencida


@pytest.mark.asyncio
async def test_bloque_pdi_cancelado_no_cuenta_activo_ni_castiga_cumplimiento(db):
    """Un PDI cancelado deja de existir para el dashboard: ni suma a activos,
    ni castiga el cumplimiento. Antes del fix, `n_activos` se calculaba como
    `total - completados - vencidos`, lo que contaba el cancelado como activo
    (en_proceso + pendientes + cancelados - vencidos), y `cumplimiento_pct`
    dividia entre `total` incluyendo el cancelado en el denominador."""
    rh = await make_empleado(
        db, rol="rh", email="tal_pdi_cancel@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    filas = [
        SimpleNamespace(
            empleado_id=1, total=4, completadas=2, en_proceso=0, pendientes=0,
            vencidas=0, cancelados=2,
        ),
    ]
    with patch(
        "app.services.talento_service.PDIRepository.equipo_pdi_aggregates",
        AsyncMock(return_value=filas),
    ), patch.object(
        TalentoService, "areas_de_empleados", AsyncMock(return_value={1: 7})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        bloque = await svc.bloque_pdi(rh, None)

    area = bloque.areas[0]
    # Sin el fix: n_activos = max(4 - 2 - 0, 0) = 2 (contaba los cancelados).
    assert area.n_activos == 0
    # Sin el fix: cumplimiento_pct = 2 / 4 = 50.0 (el denominador incluia
    # los 2 cancelados). Con el fix, el denominador efectivo es 4 - 2 = 2.
    assert area.cumplimiento_pct == 100.0
    assert area.cancelados == 2
    assert bloque.org.n_activos == 0
    assert bloque.org.cumplimiento_pct == 100.0


@pytest.mark.asyncio
async def test_bloque_pdi_sin_planes_es_none(db):
    """'No hay planes' != 'los planes van al 0%'."""
    rh = await make_empleado(
        db, rol="rh", email="tal_pdi_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.PDIRepository.equipo_pdi_aggregates",
        AsyncMock(return_value=[]),
    ):
        bloque = await svc.bloque_pdi(rh, None)

    assert bloque.disponible is True
    assert bloque.areas == []
    assert bloque.org is None
