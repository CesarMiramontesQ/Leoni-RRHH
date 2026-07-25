"""Tests de `resumen_por_area`, el agregador de capacitacion que consume el
Dashboard de Talento. Verifica agregacion, scope y el manejo de obligatorios."""
from unittest.mock import AsyncMock, patch

import pytest

from app.services.level_up_cursos_dashboard import LevelUpCursosDashboardService


class _Curso:
    def __init__(self, id_: int, obligatorio: bool):
        self.id = id_
        self.obligatorio = obligatorio


class _Par:
    def __init__(self, empleado_id: int, curso_id: int):
        self.empleado_id = empleado_id
        self.curso_id = curso_id


class _Emp:
    def __init__(self, empleado_id: int, area_id: int | None):
        self.empleado_id = empleado_id
        self.area_id = area_id


@pytest.mark.asyncio
async def test_resumen_por_area_agrega_y_marca_obligatorios(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=True), 2: _Curso(2, obligatorio=False)}
    pares = {
        (10, 1): _Par(10, 1),  # obligatorio, pendiente
        (10, 2): _Par(10, 2),  # opcional, completado
        (11, 1): _Par(11, 1),  # obligatorio, completado
    }
    estados = {(10, 1): "pendiente", (10, 2): "completado", (11, 1): "completado"}
    empleados = {10: _Emp(10, 7), 11: _Emp(11, 7)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: estados[(p.empleado_id, p.curso_id)]), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area(None)

    agg = resumen[7]
    assert agg.total_pares == 3
    assert agg.completados == 2
    assert agg.empleados_obligatorio_pendiente == {10}


@pytest.mark.asyncio
async def test_resumen_por_area_respeta_scope(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=False)}
    pares = {(10, 1): _Par(10, 1), (11, 1): _Par(11, 1)}
    empleados = {10: _Emp(10, 7), 11: _Emp(11, 7)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: "completado"), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area([10])

    assert resumen[7].total_pares == 1


@pytest.mark.asyncio
async def test_resumen_por_area_empleado_sin_area_va_a_none(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=False)}
    pares = {(10, 1): _Par(10, 1)}
    empleados = {10: _Emp(10, None)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: "completado"), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area(None)

    assert None in resumen and resumen[None].total_pares == 1


@pytest.mark.asyncio
async def test_resumen_por_area_sin_datos_devuelve_vacio(db):
    svc = LevelUpCursosDashboardService(db)
    with patch.object(svc, "_build_pares", AsyncMock(return_value=({}, {}))), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value={})):
        assert await svc.resumen_por_area(None) == {}
