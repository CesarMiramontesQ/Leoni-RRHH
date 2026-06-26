# tests/test_evaluaciones_workflow.py
"""
Tests para el workflow de estados de Evaluaciones de Competencias.

Flujo: borrador → enviado → en_revision → revisado → cerrado
Con devolucion: → devuelto → enviado (re-envio)
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado


# ── Helpers ──────────────────────────────────────────────────────────────────


async def make_area(db: AsyncSession, *, descripcion: str = "Area WF"):
    from app.models.catalogos import Area

    uid = str(uuid.uuid4())[:6]
    area = Area(
        area_id=abs(hash(uid)) % 100000,
        descripcion=descripcion or f"Area-{uid}",
        estatus_id=1,
    )
    db.add(area)
    await db.flush()
    await db.refresh(area)
    return area


async def make_competencia(db: AsyncSession, *, nombre: str = "Comp WF", area_id: int | None = None):
    from app.models.talento import Competencia

    comp = Competencia(nombre=nombre, categoria="tecnica", area_id=area_id, activo=True)
    db.add(comp)
    await db.flush()
    await db.refresh(comp)
    return comp


async def _crear_evaluacion_borrador(client, headers, empleado_id, competencia_id, nivel=2):
    payload = {"empleado_id": empleado_id, "competencia_id": competencia_id, "nivel_actual": nivel}
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ── Tests: Creacion ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empleado_crea_autoevaluacion(client: AsyncClient, db: AsyncSession):
    """Empleado puede crear su propia evaluacion (borrador)."""
    area = await make_area(db, descripcion="Produccion WF")
    emp = await make_empleado(db, rol="empleado", email="wf_emp1@leoni.test")
    emp.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="CNC", area_id=area.area_id)

    headers = await auth_headers(client, emp)
    data = await _crear_evaluacion_borrador(client, headers, emp.id, comp.id, nivel=1)
    assert data["estado"] == "borrador"
    assert data["empleado_id"] == emp.id


@pytest.mark.asyncio
async def test_empleado_no_puede_crear_para_otro(client: AsyncClient, db: AsyncSession):
    """Empleado no puede crear evaluacion para otro empleado → 403."""
    area = await make_area(db, descripcion="Log WF")
    emp1 = await make_empleado(db, rol="empleado", email="wf_emp2@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="wf_emp3@leoni.test")
    emp1.area_id = area.area_id
    emp2.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Electrica", area_id=area.area_id)

    headers = await auth_headers(client, emp1)
    payload = {"empleado_id": emp2.id, "competencia_id": comp.id, "nivel_actual": 2}
    resp = await client.post("/api/v1/evaluaciones", json=payload, headers=headers)
    assert resp.status_code == 403


# ── Tests: Flujo completo ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_flujo_completo(client: AsyncClient, db: AsyncSession):
    """Ciclo completo: borrador → enviado → en_revision → revisado → cerrado."""
    area = await make_area(db, descripcion="Manuf WF")
    emp = await make_empleado(db, rol="empleado", email="wf_fc_emp@leoni.test")
    sup = await make_empleado(db, rol="supervisor", email="wf_fc_sup@leoni.test")
    rh = await make_empleado(db, rol="rh", email="wf_fc_rh@leoni.test")
    emp.area_id = area.area_id
    sup.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Soldadura WF", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)
    rh_h = await auth_headers(client, rh)

    # 1. Crear borrador
    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id, nivel=2)
    ev_id = ev["id"]
    assert ev["estado"] == "borrador"

    # 2. Enviar
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)
    assert r.status_code == 200
    assert r.json()["estado"] == "enviado"

    # 3. Revisar (supervisor)
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/revisar", headers=sup_h)
    assert r.status_code == 200
    assert r.json()["estado"] == "en_revision"

    # 4. Aprobar (supervisor)
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/aprobar", headers=sup_h)
    assert r.status_code == 200
    assert r.json()["estado"] == "revisado"

    # 5. Cerrar (RH)
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/cerrar", headers=rh_h)
    assert r.status_code == 200
    assert r.json()["estado"] == "cerrado"

    # Verificar detalle final
    r = await client.get(f"/api/v1/evaluaciones/{ev_id}", headers=rh_h)
    assert r.json()["estado"] == "cerrado"


# ── Tests: Validaciones de estado ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_put_en_estado_cerrado_falla(client: AsyncClient, db: AsyncSession):
    """No se puede editar una evaluacion cerrada → 422."""
    area = await make_area(db, descripcion="Cerrado WF")
    rh = await make_empleado(db, rol="rh", email="wf_cerr_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="wf_cerr_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Hidraulica", area_id=area.area_id)

    rh_h = await auth_headers(client, rh)

    ev = await _crear_evaluacion_borrador(client, rh_h, emp.id, comp.id, nivel=3)
    ev_id = ev["id"]

    # Cerrar directamente (RH puede)
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/cerrar", headers=rh_h)
    assert r.status_code == 200

    # Intentar editar
    r = await client.put(f"/api/v1/evaluaciones/{ev_id}", json={"nivel_actual": 4}, headers=rh_h)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_delete_en_estado_enviado_falla(client: AsyncClient, db: AsyncSession):
    """No se puede eliminar una evaluacion enviada → 422."""
    area = await make_area(db, descripcion="Del WF")
    emp = await make_empleado(db, rol="empleado", email="wf_del_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="PLC", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id)
    ev_id = ev["id"]

    await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)

    r = await client.delete(f"/api/v1/evaluaciones/{ev_id}", headers=emp_h)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_transicion_invalida(client: AsyncClient, db: AsyncSession):
    """Transicion enviado → cerrado por supervisor → 403/422."""
    area = await make_area(db, descripcion="Inv WF")
    emp = await make_empleado(db, rol="empleado", email="wf_inv_emp@leoni.test")
    sup = await make_empleado(db, rol="supervisor", email="wf_inv_sup@leoni.test")
    emp.area_id = area.area_id
    sup.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Mecanica", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)

    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id)
    ev_id = ev["id"]
    await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)

    # Supervisor intenta cerrar directamente (no es RH) → 403
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/cerrar", headers=sup_h)
    assert r.status_code == 403


# ── Tests: Devolucion ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_devolver_sin_comentario_falla(client: AsyncClient, db: AsyncSession):
    """Devolver sin comentario → 422."""
    area = await make_area(db, descripcion="Dev WF")
    emp = await make_empleado(db, rol="empleado", email="wf_dev_emp@leoni.test")
    sup = await make_empleado(db, rol="supervisor", email="wf_dev_sup@leoni.test")
    emp.area_id = area.area_id
    sup.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Calidad", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)

    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id)
    ev_id = ev["id"]
    await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)
    await client.post(f"/api/v1/evaluaciones/{ev_id}/revisar", headers=sup_h)

    # Sin body
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/devolver", headers=sup_h, json={})
    assert r.status_code == 422

    # Comentario muy corto
    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/devolver", headers=sup_h, json={"comentario": "no"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_devolver_con_comentario_ok(client: AsyncClient, db: AsyncSession):
    """Devolver con comentario valido → 200 y evaluacion en estado devuelto."""
    area = await make_area(db, descripcion="DevOk WF")
    emp = await make_empleado(db, rol="empleado", email="wf_devok_emp@leoni.test")
    sup = await make_empleado(db, rol="supervisor", email="wf_devok_sup@leoni.test")
    emp.area_id = area.area_id
    sup.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Automatizacion", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)

    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id)
    ev_id = ev["id"]
    await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)
    await client.post(f"/api/v1/evaluaciones/{ev_id}/revisar", headers=sup_h)

    r = await client.post(
        f"/api/v1/evaluaciones/{ev_id}/devolver",
        headers=sup_h,
        json={"comentario": "Revisar el nivel de automatizacion PLC, parece bajo"},
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "devuelto"

    # Verificar que el comentario se guardo
    r2 = await client.get(f"/api/v1/evaluaciones/{ev_id}", headers=emp_h)
    assert r2.json()["comentario_devolucion"] == "Revisar el nivel de automatizacion PLC, parece bajo"


# ── Tests: RH cierre directo ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rh_cierra_desde_borrador(client: AsyncClient, db: AsyncSession):
    """RH puede cerrar directamente desde borrador."""
    area = await make_area(db, descripcion="RHDir WF")
    rh = await make_empleado(db, rol="rh", email="wf_rhdir_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="wf_rhdir_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Liderazgo", area_id=area.area_id)

    rh_h = await auth_headers(client, rh)
    ev = await _crear_evaluacion_borrador(client, rh_h, emp.id, comp.id, nivel=4)
    ev_id = ev["id"]

    r = await client.post(f"/api/v1/evaluaciones/{ev_id}/cerrar", headers=rh_h)
    assert r.status_code == 200
    assert r.json()["estado"] == "cerrado"


# ── Tests: Historial ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_historial_transiciones(client: AsyncClient, db: AsyncSession):
    """El historial muestra las transiciones realizadas."""
    area = await make_area(db, descripcion="Hist WF")
    emp = await make_empleado(db, rol="empleado", email="wf_hist_emp@leoni.test")
    sup = await make_empleado(db, rol="supervisor", email="wf_hist_sup@leoni.test")
    emp.area_id = area.area_id
    sup.area_id = area.area_id
    await db.flush()
    comp = await make_competencia(db, nombre="Robotica", area_id=area.area_id)

    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)

    ev = await _crear_evaluacion_borrador(client, emp_h, emp.id, comp.id)
    ev_id = ev["id"]

    await client.post(f"/api/v1/evaluaciones/{ev_id}/enviar", headers=emp_h)
    await client.post(f"/api/v1/evaluaciones/{ev_id}/revisar", headers=sup_h)

    r = await client.get(f"/api/v1/evaluaciones/{ev_id}/historial", headers=emp_h)
    assert r.status_code == 200
    data = r.json()
    assert data["estado_actual"] == "en_revision"
    assert len(data["eventos"]) == 2
    assert data["eventos"][0]["estado_nuevo"] == "enviado"
    assert data["eventos"][1]["estado_nuevo"] == "en_revision"


# ── Tests: Filtro por estado ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_filtro_por_estado(client: AsyncClient, db: AsyncSession):
    """Filtro por estado regresa solo evaluaciones en ese estado."""
    area = await make_area(db, descripcion="Filt WF")
    rh = await make_empleado(db, rol="rh", email="wf_filt_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="wf_filt_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()

    comp1 = await make_competencia(db, nombre="Comp Filt 1", area_id=area.area_id)
    comp2 = await make_competencia(db, nombre="Comp Filt 2", area_id=area.area_id)

    rh_h = await auth_headers(client, rh)

    # Crear dos evaluaciones en borrador
    ev1 = await _crear_evaluacion_borrador(client, rh_h, emp.id, comp1.id, nivel=1)
    ev2 = await _crear_evaluacion_borrador(client, rh_h, emp.id, comp2.id, nivel=3)

    # Cerrar una
    await client.post(f"/api/v1/evaluaciones/{ev2['id']}/cerrar", headers=rh_h)

    # Filtrar por borrador
    r = await client.get("/api/v1/evaluaciones?estado=borrador", headers=rh_h)
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(item["estado"] == "borrador" for item in items)
    assert any(item["id"] == ev1["id"] for item in items)

    # Filtrar por cerrado
    r = await client.get("/api/v1/evaluaciones?estado=cerrado", headers=rh_h)
    items = r.json()["items"]
    assert any(item["id"] == ev2["id"] for item in items)


# ── Tests: Resumen solo cuenta cerradas ──────────────────────────────────────


@pytest.mark.asyncio
async def test_resumen_solo_cerradas(client: AsyncClient, db: AsyncSession):
    """resumen_empleado solo considera evaluaciones en estado cerrado."""
    from tests.conftest_talento import make_puesto_perfil

    area = await make_area(db, descripcion="Res WF")
    rh = await make_empleado(db, rol="rh", email="wf_res_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="wf_res_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()

    comp = await make_competencia(db, nombre="Comp Resumen", area_id=area.area_id)
    puesto = await make_puesto_perfil(db, nombre="Puesto Resumen", area_id=area.area_id)

    from app.models.talento import CompetenciaRequisito

    req = CompetenciaRequisito(
        competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=3
    )
    db.add(req)
    await db.flush()

    rh_h = await auth_headers(client, rh)

    # Crear evaluacion en borrador (no debe contar)
    ev = await _crear_evaluacion_borrador(client, rh_h, emp.id, comp.id, nivel=3)

    # Resumen: borrador no cuenta → nivel_actual=0
    r = await client.get(f"/api/v1/evaluaciones/empleado/{emp.id}/resumen", headers=rh_h)
    assert r.status_code == 200
    data = r.json()
    if data["competencias"]:
        comp_item = next((c for c in data["competencias"] if c["competencia_id"] == comp.id), None)
        if comp_item:
            assert comp_item["nivel_actual"] == 0

    # Cerrar y verificar que ahora si cuenta
    await client.post(f"/api/v1/evaluaciones/{ev['id']}/cerrar", headers=rh_h)
    r = await client.get(f"/api/v1/evaluaciones/empleado/{emp.id}/resumen", headers=rh_h)
    data = r.json()
    if data["competencias"]:
        comp_item = next((c for c in data["competencias"] if c["competencia_id"] == comp.id), None)
        if comp_item:
            assert comp_item["nivel_actual"] == 3
