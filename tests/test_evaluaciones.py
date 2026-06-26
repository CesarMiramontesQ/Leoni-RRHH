# tests/test_evaluaciones.py
"""
Tests para Evaluaciones de Competencias — Fase 2.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_area, make_competencia


# ── Helpers ──────────────────────────────────────────────────────────────────

from tests.conftest_talento import make_puesto_perfil, make_competencia_requisito as make_requisito


# ── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_evaluacion_rh(client: AsyncClient, db: AsyncSession):
    """RH crea evaluacion → 201."""
    area = await make_area(db, descripcion="Manufactura")
    rh = await make_empleado(db, rol="rh", email="ev_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp@leoni.test")
    comp = await make_competencia(db, nombre="Soldadura", area_id=area.area_id)

    headers = await auth_headers(client, rh)
    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 3,
        "observaciones": "Buen desempeno",
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["nivel_actual"] == 3
    assert data["empleado_id"] == emp.id
    assert data["competencia_id"] == comp.id
    assert data["evaluador_id"] == rh.id
    assert data["observaciones"] == "Buen desempeno"


@pytest.mark.asyncio
async def test_crear_evaluacion_supervisor_su_area(client: AsyncClient, db: AsyncSession):
    """Supervisor evalua empleado de su area → 201."""
    area = await make_area(db, descripcion="Logistica")
    sup = await make_empleado(db, rol="supervisor", email="ev_sup@leoni.test")
    sup.area_id = area.area_id
    emp = await make_empleado(db, rol="empleado", email="ev_emp2@leoni.test")
    emp.area_id = area.area_id
    await db.flush()

    comp = await make_competencia(db, nombre="Montacargas", area_id=area.area_id)
    headers = await auth_headers(client, sup)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 2,
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["nivel_actual"] == 2


@pytest.mark.asyncio
async def test_crear_evaluacion_supervisor_otra_area(client: AsyncClient, db: AsyncSession):
    """Supervisor evalua empleado de otra area → 403."""
    area1 = await make_area(db, descripcion="Area Sup")
    area2 = await make_area(db, descripcion="Area Emp")
    sup = await make_empleado(db, rol="supervisor", email="ev_sup3@leoni.test")
    sup.area_id = area1.area_id
    emp = await make_empleado(db, rol="empleado", email="ev_emp3@leoni.test")
    emp.area_id = area2.area_id
    await db.flush()

    comp = await make_competencia(db, nombre="Calidad")
    headers = await auth_headers(client, sup)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 1,
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_crear_evaluacion_empleado_autoevaluacion(client: AsyncClient, db: AsyncSession):
    """Empleado puede crear autoevaluacion (para si mismo) → 201 borrador."""
    emp = await make_empleado(db, rol="empleado", email="ev_emp4@leoni.test")
    comp = await make_competencia(db, nombre="Python")
    headers = await auth_headers(client, emp)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 2,
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["estado"] == "borrador"


@pytest.mark.asyncio
async def test_upsert_evaluacion(client: AsyncClient, db: AsyncSession):
    """Crear dos veces misma combinacion → actualiza, no duplica."""
    rh = await make_empleado(db, rol="rh", email="ev_rh2@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp5@leoni.test")
    comp = await make_competencia(db, nombre="Excel")
    headers = await auth_headers(client, rh)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 1,
    }
    resp1 = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp1.status_code == 201
    id1 = resp1.json()["id"]

    payload["nivel_actual"] = 3
    resp2 = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp2.status_code == 201
    id2 = resp2.json()["id"]
    assert id1 == id2
    assert resp2.json()["nivel_actual"] == 3


@pytest.mark.asyncio
async def test_nivel_fuera_rango(client: AsyncClient, db: AsyncSession):
    """nivel=5 → 422."""
    rh = await make_empleado(db, rol="rh", email="ev_rh3@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp6@leoni.test")
    comp = await make_competencia(db, nombre="SAP")
    headers = await auth_headers(client, rh)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 5,
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_listar_evaluaciones(client: AsyncClient, db: AsyncSession):
    """Listar con filtros."""
    rh = await make_empleado(db, rol="rh", email="ev_rh4@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp7@leoni.test")
    comp = await make_competencia(db, nombre="Lean Manufacturing")
    headers = await auth_headers(client, rh)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 2,
    }
    await client.post("/api/v1/evaluaciones", json=payload, headers=headers)

    resp = await client.get(
        f"/api/v1/evaluaciones?empleado_id={emp.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["items"][0]["empleado_id"] == emp.id


@pytest.mark.asyncio
async def test_ver_propias_evaluaciones(client: AsyncClient, db: AsyncSession):
    """Empleado ve solo sus evaluaciones."""
    rh = await make_empleado(db, rol="rh", email="ev_rh5@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp8@leoni.test")
    comp = await make_competencia(db, nombre="Kaizen")
    rh_headers = await auth_headers(client, rh)
    emp_headers = await auth_headers(client, emp)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 2,
    }
    await client.post("/api/v1/evaluaciones", json=payload, headers=rh_headers)

    resp = await client.get(
        f"/api/v1/evaluaciones/empleado/{emp.id}",
        headers=emp_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_bulk_evaluacion(client: AsyncClient, db: AsyncSession):
    """POST /bulk con multiples evaluaciones."""
    rh = await make_empleado(db, rol="rh", email="ev_rh6@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="ev_emp9@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="ev_emp10@leoni.test")
    comp1 = await make_competencia(db, nombre="Inyeccion")
    comp2 = await make_competencia(db, nombre="Extrusion")
    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones": [
            {"empleado_id": emp1.id, "competencia_id": comp1.id, "nivel_actual": 3},
            {"empleado_id": emp1.id, "competencia_id": comp2.id, "nivel_actual": 2},
            {"empleado_id": emp2.id, "competencia_id": comp1.id, "nivel_actual": 1},
        ]
    }
    resp = await client.post("/api/v1/evaluaciones/bulk", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["creadas"] == 3
    assert data["errores"] == []


@pytest.mark.asyncio
async def test_brechas_con_evaluaciones(client: AsyncClient, db: AsyncSession):
    """Crear requisito nivel 3, evaluar nivel 1 → gap real reflejado."""
    area = await make_area(db, descripcion="Produccion")
    rh = await make_empleado(db, rol="rh", email="ev_rh7@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp11@leoni.test")
    emp.area_id = area.area_id
    emp.estado_id = 1
    await db.flush()

    puesto = await make_puesto_perfil(db, nombre="Operador", area_id=area.area_id)
    comp = await make_competencia(db, nombre="CNC", area_id=area.area_id)
    await make_requisito(db, competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=3)

    headers = await auth_headers(client, rh)

    # Evaluar con nivel 1 (gap = 2)
    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 1,
    }
    await client.post("/api/v1/evaluaciones", json=payload, headers=headers)

    # Consultar brechas
    resp = await client.get(
        f"/api/v1/competencias/brechas?area_id={area.area_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["brechas"]) >= 1
    brecha = next(b for b in data["brechas"] if b["competencia_id"] == comp.id)
    assert brecha["empleados_afectados"] == 1
    assert brecha["gap_porcentaje"] == 100.0


@pytest.mark.asyncio
async def test_cumplimiento_con_evaluaciones(client: AsyncClient, db: AsyncSession):
    """Evaluar todos al nivel requerido → 100% cumplimiento."""
    area = await make_area(db, descripcion="Calidad Total")
    rh = await make_empleado(db, rol="rh", email="ev_rh8@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp12@leoni.test")
    emp.area_id = area.area_id
    emp.estado_id = 1
    await db.flush()

    puesto = await make_puesto_perfil(db, nombre="Inspector", area_id=area.area_id)
    comp = await make_competencia(db, nombre="ISO 9001", area_id=area.area_id)
    await make_requisito(db, competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=3)

    headers = await auth_headers(client, rh)

    # Evaluar al nivel requerido
    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 3,
    }
    await client.post("/api/v1/evaluaciones", json=payload, headers=headers)

    # Consultar resumen
    resp = await client.get(
        f"/api/v1/competencias/resumen-area?area_id={area.area_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cumplimiento_porcentaje"] == 100.0


@pytest.mark.asyncio
async def test_eliminar_evaluacion(client: AsyncClient, db: AsyncSession):
    """DELETE → 204."""
    rh = await make_empleado(db, rol="rh", email="ev_rh9@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_emp13@leoni.test")
    comp = await make_competencia(db, nombre="PLC")
    headers = await auth_headers(client, rh)

    payload = {
        "empleado_id": emp.id,
        "competencia_id": comp.id,
        "nivel_actual": 2,
    }
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    ev_id = resp.json()["id"]

    resp_del = await client.delete(f"/api/v1/evaluaciones/{ev_id}", headers=headers)
    assert resp_del.status_code == 204

    resp_get = await client.get(f"/api/v1/evaluaciones/{ev_id}", headers=headers)
    assert resp_get.status_code == 404
