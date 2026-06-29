"""Tests de asignación individual de empleados extra a cursos."""

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
async def test_asignar_empleado_extra_buscar_y_listar(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_curso_extra@leoni.test")
    curso = await _make_curso(db, "Curso empleados extra")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_extra@leoni.test",
        empleado_id=882001,
        no_empleado=882001,
        nombre="Empleado Extra Test",
    )
    headers = await auth_headers(client, rh)

    search_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-elegibles-extra",
        params={"q": "Extra Test"},
        headers=headers,
    )
    assert search_resp.status_code == 200, search_resp.text
    results = search_resp.json()
    assert any(r["id"] == emp.empleado_id for r in results)
    assert results[0]["no_empleado"] == str(emp.no_empleado)

    create_resp = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-extra",
        json={"empleado_id": emp.empleado_id},
        headers=headers,
    )
    assert create_resp.status_code == 201, create_resp.text
    data = create_resp.json()
    assert data["empleado_id"] == emp.empleado_id
    assert data["no_empleado"] == str(emp.no_empleado)

    list_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-extra",
        headers=headers,
    )
    assert list_resp.status_code == 200, list_resp.text
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["empleado_id"] == emp.empleado_id

    search_after = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-elegibles-extra",
        params={"q": "Extra"},
        headers=headers,
    )
    assert search_after.status_code == 200
    assert not any(r["id"] == emp.empleado_id for r in search_after.json())


@pytest.mark.asyncio
async def test_quitar_empleado_extra_del_curso(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_curso_extra_del@leoni.test")
    curso = await _make_curso(db, "Curso quitar extra")
    emp = await make_empleado(db, rol="empleado", email="emp_extra_del@leoni.test", empleado_id=882002)
    headers = await auth_headers(client, rh)

    create_resp = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-extra",
        json={"empleado_id": emp.empleado_id},
        headers=headers,
    )
    assert create_resp.status_code == 201
    curso_empleado_id = create_resp.json()["id"]

    delete_resp = await client.delete(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-extra/{curso_empleado_id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    list_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-extra",
        headers=headers,
    )
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_empleado_cubierto_por_puesto_no_aparece_en_elegibles(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_curso_extra_puesto@leoni.test")
    perfil = await make_puesto_perfil(db, nombre="Perfil cubierto")
    curso = await _make_curso(db, "Curso extra vs puesto")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_cubierto@leoni.test",
        empleado_id=882003,
        nombre="Empleado Cubierto",
    )
    await make_perfil_funciones(db, empleado_id=emp.empleado_id, puesto_perfil_id=perfil.id)
    headers = await auth_headers(client, rh)

    await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/puestos",
        json={"puesto_perfil_id": perfil.id},
        headers=headers,
    )

    search_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/empleados-elegibles-extra",
        params={"q": "Cubierto"},
        headers=headers,
    )
    assert search_resp.status_code == 200
    assert not any(r["id"] == emp.empleado_id for r in search_resp.json())
