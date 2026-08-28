# tests/test_supervisor_alcance_subarbol.py
"""Supervisor ve y actúa sobre todo su subárbol, no solo reportes directos.

Escenario real: 4755 → líder 552 → líder 2652 (supervisor). Antes 2652 no veía a
4755 en ninguna pantalla porque el scope supervisor era «directos».
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION = {"accion": "approve", "nivel": 1, "comentario": "ok"}


async def _arbol(db):
    sup = await make_empleado(db, rol="supervisor", nombre="Sup Raiz")
    medio = await make_empleado(db, rol="empleado", nombre="Lider Medio", lider_id=sup.empleado_id)
    nieto = await make_empleado(db, rol="empleado", nombre="Nieto", lider_id=medio.empleado_id)
    return sup, medio, nieto


@pytest.mark.asyncio
async def test_directorio_supervisor_cuenta_subarbol(client: AsyncClient, db):
    sup, medio, nieto = await _arbol(db)
    headers = await auth_headers(client, sup)
    r = await client.get(
        "/api/v1/empleados", params={"activo": "true", "page": "1", "page_size": "10"}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["total"] == 3
    assert {i["id"] for i in r.json()["items"]} == {sup.id, medio.id, nieto.id}


@pytest.mark.asyncio
async def test_supervisor_atraviesa_lider_intermedio_inactivo(client: AsyncClient, db):
    sup = await make_empleado(db, rol="supervisor")
    medio = await make_empleado(db, rol="empleado", lider_id=sup.empleado_id, estado_id=99)
    nieto = await make_empleado(db, rol="empleado", lider_id=medio.empleado_id)
    headers = await auth_headers(client, sup)
    r = await client.get(
        "/api/v1/empleados", params={"activo": "true", "page": "1", "page_size": "10"}, headers=headers
    )
    assert r.status_code == 200
    assert {i["id"] for i in r.json()["items"]} == {sup.id, nieto.id}


@pytest.mark.asyncio
async def test_listado_y_detalle_solicitud_nieto_visibles_para_supervisor(client: AsyncClient, db):
    sup, _medio, nieto = await _arbol(db)
    sol = await make_solicitud(db, empleado_id=nieto.id, estado="pending")
    headers = await auth_headers(client, sup)

    r = await client.get("/api/v1/solicitudes", headers=headers)
    assert r.status_code == 200
    assert sol.id in {s["id"] for s in r.json()["items"]}

    r = await client.get(f"/api/v1/solicitudes/{sol.id}", headers=headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_supervisor_aprueba_solicitud_de_nieto(client: AsyncClient, db):
    sup, _medio, nieto = await _arbol(db)
    sol = await make_solicitud(db, empleado_id=nieto.id, estado="pending")
    headers = await auth_headers(client, sup)
    r = await client.put(f"/api/v1/solicitudes/{sol.id}/approve", json=APROBACION, headers=headers)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_supervisor_ajeno_sigue_sin_ver_ni_aprobar(client: AsyncClient, db):
    _sup, _medio, nieto = await _arbol(db)
    otro = await make_empleado(db, rol="supervisor")
    sol = await make_solicitud(db, empleado_id=nieto.id, estado="pending")
    headers = await auth_headers(client, otro)
    assert (await client.get(f"/api/v1/solicitudes/{sol.id}", headers=headers)).status_code == 403
    r = await client.put(f"/api/v1/solicitudes/{sol.id}/approve", json=APROBACION, headers=headers)
    assert r.status_code == 403
