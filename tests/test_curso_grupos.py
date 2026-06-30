"""Tests de asignación de áreas (grupos) a cursos."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogos import Area
from app.models.level_up import Curso, TipoGrupoCurso, CursoGrupo
from tests.conftest import auth_headers, make_empleado


async def _make_area(db: AsyncSession, area_id: int, descripcion: str) -> Area:
    area = Area(area_id=area_id, descripcion=descripcion, estatus_id=1)
    db.add(area)
    await db.flush()
    return area


async def _make_curso(db: AsyncSession, nombre: str) -> Curso:
    curso = Curso(nombre=nombre)
    db.add(curso)
    await db.flush()
    return curso


@pytest.mark.asyncio
async def test_asignar_dos_areas_y_listar_empleados_con_no_empleado_entero(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_curso_grupos@leoni.test")
    area1 = await _make_area(db, 88001, "Área prueba A")
    area2 = await _make_area(db, 88002, "Área prueba B")
    curso = await _make_curso(db, "Curso grupos test")

    emp1 = await make_empleado(
        db, rol="empleado", email="emp_grupo_a@leoni.test", empleado_id=880101, no_empleado=880101
    )
    emp1.area_id = area1.area_id
    emp2 = await make_empleado(
        db, rol="empleado", email="emp_grupo_b@leoni.test", empleado_id=880102, no_empleado=880102
    )
    emp2.area_id = area2.area_id
    await db.flush()

    headers = await auth_headers(client, rh)

    for area_id in (area1.area_id, area2.area_id):
        resp = await client.post(
            f"/api/v1/level-up/cursos/{curso.id}/grupos",
            json={"tipo": "area", "referencia_id": area_id},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    list_resp = await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/grupos",
        headers=headers,
    )
    assert list_resp.status_code == 200, list_resp.text
    data = list_resp.json()
    assert len(data) == 2
    assert all(g["tipo"] == "area" for g in data)
    assert data[0]["empleados"][0]["no_empleado"] == str(emp1.no_empleado) or data[1]["empleados"][0]["no_empleado"] == str(emp2.no_empleado)
