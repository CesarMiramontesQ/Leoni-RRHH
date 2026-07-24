"""El Dashboard de Talento filtra los agregados de PDI por los empleado_ids que
resolvio SU scope, no por area. Este test cubre ese parametro nuevo."""
from datetime import date, timedelta

import pytest

from app.models.talento import PlanDesarrolloIndividual
from app.repositories.pdi_repository import PDIRepository
from tests.conftest import make_empleado
from tests.conftest_talento import make_competencia


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
