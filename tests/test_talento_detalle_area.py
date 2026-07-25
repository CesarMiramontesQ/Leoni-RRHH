"""Detalle de area: agregados del area + empleados en foco. Cubre la regla de
que una senal no evaluable no cuenta como riesgo."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import ForbiddenError, NotFoundError
from app.services.level_up_cursos_dashboard import CursosAreaAgg
from app.services.operaciones_service import PolivalenciaEmpleado
from app.services.talento.types import SenalesEmpleado
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_detalle_area_marca_empleados_en_foco(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_det@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    polivalencia = [
        PolivalenciaEmpleado(1, 101, "Ana", "Crimpado", 20.0),   # baja
        PolivalenciaEmpleado(2, 102, "Beto", "Crimpado", 95.0),  # ok
    ]
    resultados = [
        SimpleNamespace(empleado_id=1, empleado_nombre="Ana", calificacion_desempeno=None,
                        cumplimiento_metas=None, banda_desempeno_efectiva="bajo",
                        banda_potencial=None, segmento_9box=None),
        SimpleNamespace(empleado_id=2, empleado_nombre="Beto", calificacion_desempeno=None,
                        cumplimiento_metas=None, banda_desempeno_efectiva="alto",
                        banda_potencial=None, segmento_9box=None),
    ]
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(return_value=polivalencia),
    ), patch.object(
        TalentoService, "ciclo_vigente",
        AsyncMock(return_value=SimpleNamespace(id=1, nombre="C1", estado="activo",
                                               umbral_medio=50, umbral_alto=75)),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=resultados),
    ), patch.object(
        TalentoService, "_pdi_vencido_por_empleado", AsyncMock(return_value={1: True, 2: False})
    ), patch.object(
        TalentoService, "_obligatorio_pendiente_por_empleado",
        AsyncMock(return_value={1: False, 2: False}),
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        detalle = await svc.detalle_area(rh, None, 7, None)

    # Ana: desempeno_bajo + polivalencia_baja + pdi_vencido = 3 senales -> en foco
    assert [e.empleado_id for e in detalle.empleados_foco] == [1]
    assert set(detalle.empleados_foco[0].senales) == {
        "desempeno_bajo", "polivalencia_baja", "pdi_vencido"
    }


@pytest.mark.asyncio
async def test_detalle_area_sin_ciclo_no_inventa_senal_de_desempeno(db):
    """Sin ciclo, `desempeno_bajo` queda en None y Ana solo suma 2 senales."""
    rh = await make_empleado(
        db, rol="rh", email="tal_det2@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(return_value=[PolivalenciaEmpleado(1, 101, "Ana", "Crimpado", 10.0)]),
    ), patch.object(
        TalentoService, "ciclo_vigente", AsyncMock(return_value=None)
    ), patch.object(
        TalentoService, "_pdi_vencido_por_empleado", AsyncMock(return_value={1: True})
    ), patch.object(
        TalentoService, "_obligatorio_pendiente_por_empleado", AsyncMock(return_value={1: False})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        detalle = await svc.detalle_area(rh, None, 7, None)

    foco = detalle.empleados_foco[0]
    assert set(foco.senales) == {"polivalencia_baja", "pdi_vencido"}
    assert "desempeno_bajo" not in foco.senales


@pytest.mark.asyncio
async def test_detalle_area_fuera_de_scope_403(db):
    jefe = await make_empleado(db, rol="supervisor", email="tal_jefe2@leoni.test")
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(side_effect=ForbiddenError(detail="Area fuera de tu alcance")),
    ):
        with pytest.raises(ForbiddenError):
            await svc.detalle_area(jefe, None, 99, None)


@pytest.mark.asyncio
async def test_detalle_area_inexistente_404(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_det404@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(side_effect=NotFoundError(entidad="Area", id=99)),
    ):
        with pytest.raises(NotFoundError):
            await svc.detalle_area(rh, None, 99, None)


@pytest.mark.asyncio
async def test_obligatorio_pendiente_empleado_sin_cursos_es_none(db):
    """Un empleado que no aparece en NINGUN par (empleado, curso) del resumen
    de cursos no es evaluable en capacitacion: la senal debe quedar en None,
    nunca en False (False significa 'se evaluo y no tiene pendientes').
    None jamas suma como senal activa."""
    svc = TalentoService(db)
    resumen = {
        7: CursosAreaAgg(
            total_pares=1,
            completados=0,
            empleados_obligatorio_pendiente={1},
            empleados={1},
        ),
    }
    with patch(
        "app.services.talento_service.LevelUpCursosDashboardService.resumen_por_area",
        AsyncMock(return_value=resumen),
    ):
        resultado = await svc._obligatorio_pendiente_por_empleado([1, 2])

    assert resultado[1] is True  # aparecio en un par y tiene un obligatorio pendiente
    assert resultado[2] is None  # no aparecio en ningun par -> no evaluable

    senal_sin_cursos = SenalesEmpleado(
        empleado_id=2, no_empleado=2, nombre="Sin Cursos",
        capacitacion_pendiente=resultado[2],
    )
    assert senal_sin_cursos.n_senales == 0
    assert "capacitacion_pendiente" not in senal_sin_cursos.senales_activas


@pytest.mark.asyncio
async def test_detalle_area_polivalencia_sin_dato_no_inventa_riesgo(db):
    """`PolivalenciaEmpleado.pol_pct = None` (polivalencia no evaluable para
    el empleado) debe dejar `polivalencia_baja` en None, no en True: la
    ausencia de dato no es riesgo."""
    rh = await make_empleado(
        db, rol="rh", email="tal_det_polnone@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    capturado: dict = {}

    def _spy(*args, **kwargs):
        senal = SenalesEmpleado(*args, **kwargs)
        if senal.empleado_id == 1:
            capturado["polivalencia_baja"] = senal.polivalencia_baja
        return senal

    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(return_value=[PolivalenciaEmpleado(1, 101, "Ana", "Crimpado", None)]),
    ), patch.object(
        TalentoService, "ciclo_vigente", AsyncMock(return_value=None)
    ), patch.object(
        TalentoService, "_pdi_vencido_por_empleado", AsyncMock(return_value={1: None})
    ), patch.object(
        TalentoService, "_obligatorio_pendiente_por_empleado", AsyncMock(return_value={1: None})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ), patch(
        "app.services.talento_service.SenalesEmpleado", side_effect=_spy,
    ):
        await svc.detalle_area(rh, None, 7, None)

    assert capturado["polivalencia_baja"] is None


@pytest.mark.asyncio
async def test_bloque_objetivo_promedia_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_obj@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    items = (
        SimpleNamespace(empleado_id=1, resultado=SimpleNamespace(indice=80.0)),
        SimpleNamespace(empleado_id=2, resultado=SimpleNamespace(indice=60.0)),
    )
    resp = SimpleNamespace(items=items, bono_disponible=True)
    with patch(
        "app.services.talento_service.HistorialObjetivoService.indice_equipo_con_scope",
        AsyncMock(return_value=resp),
    ), patch.object(
        TalentoService, "areas_de_empleados", AsyncMock(return_value={1: 7, 2: 7})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        bloque = await svc.bloque_objetivo(rh, None, None, None, None)

    assert bloque.disponible is True
    assert bloque.areas[0].indice_promedio == 70.0
    assert bloque.org.indice_promedio == 70.0
