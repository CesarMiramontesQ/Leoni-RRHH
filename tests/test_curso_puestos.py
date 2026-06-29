"""Tests de asignación de puestos (perfiles) a cursos."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import Curso
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_puesto_perfil, make_perfil_funciones


async def _make_curso(db: AsyncSession, nombre: str) -> Curso:
    curso = Curso(nombre=nombre, obligatorio=True)
    db.add(curso)
    await db.flush()
    return curso


@pytest.mark.asyncio
async def test_asignar_dos_puestos_y_listar_empleados(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_curso_puestos@leoni.test")
    perfil1 = await make_puesto_perfil(db, nombre="Operador A")
    perfil2 = await make_puesto_perfil(db, nombre="Operador B")
    curso = await _make_curso(db, "Curso puestos test")

    emp1 = await make_empleado(db, rol="empleado", email="emp_puesto_a@leoni.test", empleado_id=881101)
    emp2 = await make_empleado(db, rol="empleado", email="emp_puesto_b@leoni.test", empleado_id=881102)
    await make_perfil_funciones(db, empleado_id=emp1.empleado_id, puesto_perfil_id=perfil1.id)
    await make_perfil_funciones(db, empleado_id=emp2.empleado_id, puesto_perfil_id=perfil2.id)

    headers = await auth_headers(client, rh)

    for perfil_id in (perfil1.id, perfil2.id):
        resp = await client.post(
            f"/api/v1/level-up/cursos/{curso.id}/puestos",
            json={"puesto_perfil_id": perfil_id},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["puesto_perfil_id"] == perfil_id
        assert data["obligatorio"] is True

    list_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/puestos",
        headers=headers,
    )
    assert list_resp.status_code == 200, list_resp.text
    items = list_resp.json()
    assert len(items) == 2
    total_empleados = sum(i["empleados_count"] for i in items)
    assert total_empleados == 2
    assert all(i["empleados"][0]["no_empleado"] == str(emp1.no_empleado) or i["empleados"][0]["no_empleado"] == str(emp2.no_empleado) for i in items if i["empleados"])


@pytest.mark.asyncio
async def test_quitar_puesto_asignado_al_curso(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_curso_puestos_del@leoni.test")
    perfil = await make_puesto_perfil(db, nombre="Técnico C")
    curso = await _make_curso(db, "Curso quitar puesto")
    headers = await auth_headers(client, rh)

    create_resp = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/puestos",
        json={"puesto_perfil_id": perfil.id},
        headers=headers,
    )
    assert create_resp.status_code == 201
    curso_puesto_id = create_resp.json()["id"]

    delete_resp = await client.delete(
        f"/api/v1/level-up/cursos/{curso.id}/puestos/{curso_puesto_id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    list_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/puestos",
        headers=headers,
    )
    assert list_resp.status_code == 200
    assert list_resp.json() == []
