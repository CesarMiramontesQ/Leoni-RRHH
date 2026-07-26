"""El Dashboard de Talento filtra los agregados de PDI por los empleado_ids que
resolvio SU scope, no por area. Este test cubre ese parametro nuevo."""
from datetime import date, timedelta

import pytest

from app.models.talento import PlanDesarrolloIndividual
from app.repositories.pdi_repository import PDIRepository
from tests.conftest import make_empleado
from tests.conftest_talento import make_area, make_competencia, make_perfil_funciones, make_puesto_perfil


async def _pdi(db, empleado_id: int, competencia_id: int, estado: str) -> None:
    hoy = date.today()
    db.add(
        PlanDesarrolloIndividual(
            empleado_id=empleado_id,
            competencia_id=competencia_id,
            accion=f"PDI {empleado_id} {estado}",
            tipo="curso",
            fecha_inicio=hoy,
            fecha_fin=hoy + timedelta(days=30),
            responsable="Responsable Test",
            estado=estado,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_equipo_pdi_aggregates_filtra_por_empleado_ids(db):
    comp = await make_competencia(db)
    a = await make_empleado(db, email="pdi_scope_a@leoni.test")
    b = await make_empleado(db, email="pdi_scope_b@leoni.test")
    await _pdi(db, a.empleado_id, comp.id, "completado")
    await _pdi(db, b.empleado_id, comp.id, "pendiente")

    repo = PDIRepository(db)

    todos = await repo.equipo_pdi_aggregates()
    assert {r.empleado_id for r in todos} >= {a.empleado_id, b.empleado_id}

    solo_a = await repo.equipo_pdi_aggregates(empleado_ids=[a.empleado_id])
    assert [r.empleado_id for r in solo_a] == [a.empleado_id]
    assert solo_a[0].total == 1 and solo_a[0].completadas == 1


@pytest.mark.asyncio
async def test_equipo_pdi_aggregates_lista_vacia_devuelve_nada(db):
    """Scope vacio = no ve a nadie. NO debe interpretarse como 'sin filtro'."""
    comp = await make_competencia(db)
    a = await make_empleado(db, email="pdi_scope_c@leoni.test")
    await _pdi(db, a.empleado_id, comp.id, "pendiente")

    repo = PDIRepository(db)
    assert await repo.equipo_pdi_aggregates(empleado_ids=[]) == []


@pytest.mark.asyncio
async def test_equipo_pdi_aggregates_cuenta_cancelados(db):
    """El agregado expone `cancelados` por separado: el Dashboard de Talento
    lo necesita para no tratar un PDI cancelado como activo ni dejar que
    castigue el cumplimiento."""
    comp = await make_competencia(db)
    a = await make_empleado(db, email="pdi_scope_d@leoni.test")
    await _pdi(db, a.empleado_id, comp.id, "completado")
    await _pdi(db, a.empleado_id, comp.id, "cancelado")
    await _pdi(db, a.empleado_id, comp.id, "cancelado")
    await _pdi(db, a.empleado_id, comp.id, "pendiente")

    repo = PDIRepository(db)
    filas = await repo.equipo_pdi_aggregates(empleado_ids=[a.empleado_id])

    assert len(filas) == 1
    fila = filas[0]
    assert fila.total == 4
    assert fila.completadas == 1
    assert fila.pendientes == 1
    assert fila.cancelados == 2


@pytest.mark.asyncio
async def test_list_consolidated_filtra_por_puesto_perfil(db):
    """puesto_perfil_id limita a empleados con asignación activa a ese perfil."""
    area = await make_area(db, descripcion="Area PDI Puesto")
    perfil_a = await make_puesto_perfil(db, nombre="Perfil A PDI", area_id=area.area_id)
    perfil_b = await make_puesto_perfil(db, nombre="Perfil B PDI", area_id=area.area_id)
    comp = await make_competencia(db)
    emp_a = await make_empleado(db, email="pdi_puesto_a@leoni.test")
    emp_b = await make_empleado(db, email="pdi_puesto_b@leoni.test")
    await make_perfil_funciones(
        db, empleado_id=emp_a.empleado_id, puesto_perfil_id=perfil_a.id
    )
    await make_perfil_funciones(
        db, empleado_id=emp_b.empleado_id, puesto_perfil_id=perfil_b.id
    )
    await _pdi(db, emp_a.empleado_id, comp.id, "pendiente")
    await _pdi(db, emp_b.empleado_id, comp.id, "pendiente")

    repo = PDIRepository(db)
    items, total = await repo.list_consolidated(
        offset=0, limit=50, puesto_perfil_id=perfil_a.id
    )
    assert total == 1
    assert items[0].empleado_id == emp_a.empleado_id

    agregados = await repo.equipo_pdi_aggregates(puesto_perfil_id=perfil_a.id)
    assert [r.empleado_id for r in agregados] == [emp_a.empleado_id]
