"""Tests de orquestacion de TalentoService: que el scope se resuelva UNA vez y
se pase explicito a cada building block, y que la agregacion por area cuadre."""
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from app.services.operaciones_service import AreaResumen
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_bloque_polivalencia_agrega_org_ponderado(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_pol@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    areas = [
        AreaResumen(1, "Arneses A", 100.0, 90.0, 0, 90),
        AreaResumen(2, "Arneses B", 0.0, 10.0, 3, 10),
    ]
    with patch(
        "app.services.talento_service.OperacionesService.listar_areas_con_scope",
        AsyncMock(return_value=areas),
    ):
        bloque = await svc.bloque_polivalencia(rh, None)

    assert bloque.disponible is True
    # Ponderado por personal: 90 personas al 100 y 10 al 0 -> 90.0, no 50.0
    assert bloque.org.pol_pct == 90.0
    assert bloque.org.n_criticas == 3
    assert bloque.org.n_empleados == 100
    assert [a.area_id for a in bloque.areas] == [1, 2]


@pytest.mark.asyncio
async def test_bloque_polivalencia_area_sin_dato_no_arrastra_el_org(db):
    """Un area sin polivalencia calculable (`None`) sale como n/d y NO entra al
    promedio del org como 0: si entrara, 50 personas al 80% darian 40%."""
    rh = await make_empleado(
        db, rol="rh", email="tal_pol_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    areas = [
        AreaResumen(1, "Arneses A", 80.0, 90.0, 0, 50),
        AreaResumen(2, "Almacen", None, 0.0, 0, 50),
    ]
    with patch(
        "app.services.talento_service.OperacionesService.listar_areas_con_scope",
        AsyncMock(return_value=areas),
    ):
        bloque = await svc.bloque_polivalencia(rh, None)

    assert bloque.org.pol_pct == 80.0
    assert bloque.areas[1].pol_pct is None
    assert bloque.areas[1].semaforo is None


@pytest.mark.asyncio
async def test_bloque_desempeno_sin_ciclo_no_disponible(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_sinciclo@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[]),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    assert bloque.disponible is False
    assert bloque.motivo == "sin_ciclo"
    assert bloque.areas == []


@pytest.mark.asyncio
async def test_bloque_desempeno_promedia_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_desemp@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    emp_a = await make_empleado(db, email="tal_d_a@leoni.test")
    emp_a.area_id = 7
    emp_b = await make_empleado(db, email="tal_d_b@leoni.test")
    emp_b.area_id = 7
    await db.flush()
    svc = TalentoService(db)

    ciclo = _ciclo_stub(ciclo_id=3)
    resultados = [
        _resultado_stub(emp_a.empleado_id, calificacion=80, banda="alto", metas=90),
        _resultado_stub(emp_b.empleado_id, calificacion=40, banda="bajo", metas=50),
    ]
    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[ciclo]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=resultados),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.construir_9box",
        AsyncMock(return_value=_9box_stub()),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    assert bloque.disponible is True
    area = next(a for a in bloque.areas if a.area_id == 7)
    assert area.calificacion_promedio == 60.0
    assert area.cumplimiento_metas_pct == 70.0
    assert area.distribucion == {"bajo": 1, "medio": 0, "alto": 1}
    assert area.con_resultado_pct == 100.0


@pytest.mark.asyncio
async def test_bloque_desempeno_area_sin_calificaciones_es_none(db):
    """Empleados en el ciclo pero sin calificacion -> n/d, NO 0.0."""
    rh = await make_empleado(
        db, rol="rh", email="tal_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    emp = await make_empleado(db, email="tal_nd_e@leoni.test")
    emp.area_id = 9
    await db.flush()
    svc = TalentoService(db)

    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[_ciclo_stub(ciclo_id=1)]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=[_resultado_stub(emp.empleado_id, calificacion=None, banda=None, metas=None)]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.construir_9box",
        AsyncMock(return_value=_9box_stub()),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    area = next(a for a in bloque.areas if a.area_id == 9)
    assert area.calificacion_promedio is None
    assert area.semaforo is None
    assert area.con_resultado_pct == 0.0


@pytest.mark.asyncio
async def test_bloque_desempeno_con_resultado_pct_usa_poblacion_del_scope(db):
    """El denominador de `con_resultado_pct` es la poblacion del area EN
    SCOPE, no solo quienes tienen fila de resultado en el ciclo -- si no, un
    area con cobertura incompleta del ciclo puede reportar 100% igual."""
    jefe = await make_empleado(db, rol="supervisor", email="tal_cr_jefe@leoni.test")
    emp_a = await make_empleado(db, email="tal_cr_a@leoni.test", lider_id=jefe.empleado_id)
    emp_b = await make_empleado(db, email="tal_cr_b@leoni.test", lider_id=jefe.empleado_id)
    emp_c = await make_empleado(db, email="tal_cr_c@leoni.test", lider_id=jefe.empleado_id)
    emp_a.area_id = 7
    emp_b.area_id = 7
    emp_c.area_id = 7
    await db.flush()
    svc = TalentoService(db)

    ciclo = _ciclo_stub(ciclo_id=5)
    # Solo Ana y Beto tienen fila de resultado en el ciclo; Caro (en el area,
    # en el scope del jefe) no aparece -- el ciclo aun no la evaluo.
    resultados = [
        _resultado_stub(emp_a.empleado_id, calificacion=80, banda="alto", metas=90),
        _resultado_stub(emp_b.empleado_id, calificacion=60, banda="medio", metas=70),
    ]
    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[ciclo]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=resultados),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.construir_9box",
        AsyncMock(return_value=_9box_stub()),
    ):
        bloque = await svc.bloque_desempeno(jefe, None, None)

    area = next(a for a in bloque.areas if a.area_id == 7)
    # Denominador del ciclo (2 filas de resultado): 2/2 = 100%. Denominador
    # correcto (3 empleados del area en el scope del jefe): 2/3 = 66.7%.
    assert area.con_resultado_pct == 66.7


@pytest.mark.asyncio
async def test_scope_supervisor_es_su_equipo(db):
    """El scope se resuelve con el module_key del dashboard, no con el de cada bloque."""
    jefe = await make_empleado(db, rol="supervisor", email="tal_jefe@leoni.test")
    sub = await make_empleado(db, email="tal_sub@leoni.test", lider_id=jefe.empleado_id)
    svc = TalentoService(db)

    ids = await svc.scope(jefe, None)
    assert ids is not None
    assert set(ids) == {jefe.empleado_id, sub.empleado_id}


# ── stubs ─────────────────────────────────────────────────────────────────
def _ciclo_stub(ciclo_id: int, estado: str = "activo"):
    from types import SimpleNamespace

    return SimpleNamespace(
        id=ciclo_id, nombre=f"Ciclo {ciclo_id}", estado=estado,
        fecha_inicio=None, fecha_fin=None,
        umbral_medio=Decimal("50"), umbral_alto=Decimal("75"),
    )


def _resultado_stub(empleado_id: int, calificacion, banda, metas):
    from types import SimpleNamespace

    return SimpleNamespace(
        empleado_id=empleado_id,
        empleado_nombre=f"Emp {empleado_id}",
        calificacion_desempeno=None if calificacion is None else Decimal(str(calificacion)),
        cumplimiento_metas=None if metas is None else Decimal(str(metas)),
        banda_desempeno_efectiva=banda,
        banda_potencial=None,
        segmento_9box=None,
    )


def _9box_stub():
    from types import SimpleNamespace

    return SimpleNamespace(ciclo_id=1, celdas=[])
