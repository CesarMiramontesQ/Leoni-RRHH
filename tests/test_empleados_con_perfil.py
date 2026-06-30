# tests/test_empleados_con_perfil.py
"""
Tests para GET /api/v1/evaluaciones/empleados-con-perfil — selector de empleados
ligados a un perfil de puesto (asignacion PerfilFunciones activa).

Cubre:
  - RH lista todos los empleados con perfil, enriquecidos (puesto, grado, nivel).
  - Solo aparecen asignaciones activas.
  - Un empleado sin scope amplio no ve a otros (scope == solo self).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    get_default_grado,
    make_area,
    make_competencia,
    make_competencia_requisito,
    make_grado_puesto,
    make_puesto_perfil,
)


async def _asignar(db: AsyncSession, *, perfil_id: int, empleado_id: int, grado_id: int, activo: bool = True):
    from app.models.talento import PerfilFunciones

    asignacion = PerfilFunciones(
        puesto_perfil_id=perfil_id,
        empleado_id=empleado_id,
        grado_id=grado_id,
        departamento="Calidad",
        activo=activo,
    )
    db.add(asignacion)
    await db.flush()
    return asignacion


async def _eval_cerrada(db: AsyncSession, *, empleado_id: int, competencia_id: int, nivel: int):
    from app.models.talento import EvaluacionCompetencia

    ev = EvaluacionCompetencia(
        empleado_id=empleado_id,
        competencia_id=competencia_id,
        nivel_actual=nivel,
        estado="cerrado",
    )
    db.add(ev)
    await db.flush()
    return ev


async def _pf_competencia(
    db: AsyncSession, *, perfil_funciones_id: int, competencia_requisito_id: int, situacion_actual: str
):
    """Calificación capturada desde el módulo de Puestos (PerfilFuncionesCompetencia)."""
    from app.models.talento import PerfilFuncionesCompetencia

    pfc = PerfilFuncionesCompetencia(
        perfil_funciones_id=perfil_funciones_id,
        competencia_requisito_id=competencia_requisito_id,
        situacion_actual=situacion_actual,
    )
    db.add(pfc)
    await db.flush()
    return pfc


@pytest.mark.asyncio
async def test_rh_lista_empleados_con_perfil(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad CP")
    rh = await make_empleado(db, rol="rh", email="cp_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado = await get_default_grado(db)

    emp1 = await make_empleado(db, rol="empleado", email="cp_e1@leoni.test", nombre="Empleado Uno")
    emp2 = await make_empleado(db, rol="empleado", email="cp_e2@leoni.test", nombre="Empleado Dos")
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp1.id, grado_id=grado.id)
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp2.id, grado_id=grado.id)

    headers = await auth_headers(client, rh)
    res = await client.get("/api/v1/evaluaciones/empleados-con-perfil", headers=headers)

    assert res.status_code == 200
    data = res.json()
    ids = {item["empleado_id"] for item in data}
    assert {emp1.id, emp2.id} <= ids

    item = next(i for i in data if i["empleado_id"] == emp1.id)
    assert item["empleado_nombre"] == "Empleado Uno"
    assert item["puesto_perfil_id"] == perfil.id
    assert item["puesto_nombre"] is not None
    assert item["grado_id"] == grado.id
    assert item["grado_nombre"] is not None


@pytest.mark.asyncio
async def test_asignacion_inactiva_no_aparece(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad Inactiva")
    rh = await make_empleado(db, rol="rh", email="inact_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado = await get_default_grado(db)

    emp = await make_empleado(db, rol="empleado", email="inact_e@leoni.test", nombre="Inactivo")
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp.id, grado_id=grado.id, activo=False)

    headers = await auth_headers(client, rh)
    res = await client.get("/api/v1/evaluaciones/empleados-con-perfil", headers=headers)

    assert res.status_code == 200
    ids = {item["empleado_id"] for item in res.json()}
    assert emp.id not in ids


@pytest.mark.asyncio
async def test_orden_por_readiness_desc_con_metricas(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad Ranking")
    rh = await make_empleado(db, rol="rh", email="rank_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="Auditoría Rank", categoria="tecnica")
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, grado_id=grado.id, nivel_requerido=4
    )

    emp_alto = await make_empleado(db, rol="empleado", email="rank_alto@leoni.test", nombre="Empleado Alto")
    emp_bajo = await make_empleado(db, rol="empleado", email="rank_bajo@leoni.test", nombre="Empleado Bajo")
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp_alto.id, grado_id=grado.id)
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp_bajo.id, grado_id=grado.id)
    # Alto cumple el requisito (sin brecha); bajo tiene nivel 1 contra requerido 4.
    await _eval_cerrada(db, empleado_id=emp_alto.id, competencia_id=comp.id, nivel=4)
    await _eval_cerrada(db, empleado_id=emp_bajo.id, competencia_id=comp.id, nivel=1)

    headers = await auth_headers(client, rh)
    res = await client.get("/api/v1/evaluaciones/empleados-con-perfil", headers=headers)
    assert res.status_code == 200
    data = res.json()

    relevantes = [d for d in data if d["empleado_id"] in {emp_alto.id, emp_bajo.id}]
    # El de mayor readiness debe aparecer primero entre estos dos.
    assert relevantes[0]["empleado_id"] == emp_alto.id

    alto = next(d for d in data if d["empleado_id"] == emp_alto.id)
    bajo = next(d for d in data if d["empleado_id"] == emp_bajo.id)
    assert alto["readiness_score"] == 100.0
    assert alto["brechas_identificadas"] == 0
    assert alto["competencias_evaluadas"] == 1
    assert bajo["readiness_score"] < alto["readiness_score"]
    assert bajo["brechas_identificadas"] == 1
    assert bajo["total_competencias"] == 1


@pytest.mark.asyncio
async def test_empleado_sin_scope_no_ve_otros(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad Scope")
    rh = await make_empleado(db, rol="rh", email="scope_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado = await get_default_grado(db)

    asignado = await make_empleado(db, rol="empleado", email="scope_a@leoni.test", nombre="Asignado")
    await _asignar(db, perfil_id=perfil.id, empleado_id=asignado.id, grado_id=grado.id)

    # Un empleado distinto, sin perfil, no debe ver a 'asignado'.
    otro = await make_empleado(db, rol="empleado", email="scope_otro@leoni.test", nombre="Otro")
    headers = await auth_headers(client, otro)
    res = await client.get("/api/v1/evaluaciones/empleados-con-perfil", headers=headers)

    assert res.status_code == 200
    ids = {item["empleado_id"] for item in res.json()}
    assert asignado.id not in ids


@pytest.mark.asyncio
async def test_resumen_lee_nivel_capturado_en_puestos(client: AsyncClient, db):
    """El Nivel Actual debe reflejar la calificación capturada en Puestos
    (PerfilFuncionesCompetencia.situacion_actual), no solo EvaluacionCompetencia."""
    area = await make_area(db, descripcion="Calidad PFC")
    rh = await make_empleado(db, rol="rh", email="pfc_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="Auditoría PFC", categoria="tecnica")
    req = await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, grado_id=grado.id, nivel_requerido=4
    )

    emp = await make_empleado(db, rol="empleado", email="pfc_emp@leoni.test", nombre="Empleado PFC")
    asignacion = await _asignar(db, perfil_id=perfil.id, empleado_id=emp.id, grado_id=grado.id)
    # Calificación capturada desde Puestos: nivel 3 (texto).
    await _pf_competencia(
        db, perfil_funciones_id=asignacion.id, competencia_requisito_id=req.id, situacion_actual="3"
    )

    headers = await auth_headers(client, rh)
    res = await client.get(f"/api/v1/evaluaciones/empleado/{emp.id}/resumen", headers=headers)
    assert res.status_code == 200
    item = next(c for c in res.json()["competencias"] if c["competencia_id"] == comp.id)

    assert item["nivel_actual"] == 3
    assert item["nivel_requerido"] == 4
    assert item["brecha_pct"] == 25.0  # (4-3)/4

    list_res = await client.get("/api/v1/evaluaciones/empleados-con-perfil", headers=headers)
    assert list_res.status_code == 200
    row = next(i for i in list_res.json() if i["empleado_id"] == emp.id)
    assert row["competencias_evaluadas"] == 1


@pytest.mark.asyncio
async def test_resumen_incluye_niveles_por_grado(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad Grados")
    rh = await make_empleado(db, rol="rh", email="grados_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    grado1 = await get_default_grado(db)  # orden 1
    grado2 = await make_grado_puesto(db, nombre="Grado 2", orden=2)
    comp = await make_competencia(db, nombre="Inglés Grados", categoria="tecnica")
    # Requisito distinto por grado: G1=2, G2=4.
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, grado_id=grado1.id, nivel_requerido=2
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, grado_id=grado2.id, nivel_requerido=4
    )

    emp = await make_empleado(db, rol="empleado", email="grados_emp@leoni.test", nombre="Empleado Grados")
    await _asignar(db, perfil_id=perfil.id, empleado_id=emp.id, grado_id=grado1.id)
    await _eval_cerrada(db, empleado_id=emp.id, competencia_id=comp.id, nivel=1)

    headers = await auth_headers(client, rh)
    res = await client.get(f"/api/v1/evaluaciones/empleado/{emp.id}/resumen", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["grado_actual_id"] == grado1.id
    grados_ids = [g["grado_id"] for g in data["grados"]]
    assert grados_ids == [grado1.id, grado2.id]  # ordenados por 'orden'

    item = next(c for c in data["competencias"] if c["competencia_id"] == comp.id)
    # niveles_por_grado tiene claves string en JSON.
    assert item["niveles_por_grado"][str(grado1.id)] == 2
    assert item["niveles_por_grado"][str(grado2.id)] == 4
    # nivel_requerido y brecha son vs el grado actual (G1 = 2): (2-1)/2 = 50%.
    assert item["nivel_requerido"] == 2
    assert item["nivel_actual"] == 1
    assert item["brecha_pct"] == 50.0
