"""Tests de integración del dashboard de seguimiento de cursos."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import Curso, CursoEmpleado, CursoSesion, EstadoSesion
from tests.conftest import auth_headers, make_empleado


async def _make_curso(db: AsyncSession, nombre: str) -> Curso:
    curso = Curso(nombre=nombre, obligatorio=True)
    db.add(curso)
    await db.flush()
    return curso


@pytest.mark.asyncio
async def test_dashboard_resumen_vacio(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_dash_seg@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.get("/api/v1/level-up/cursos/dashboard/resumen", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "kpis" in data
    assert data["kpis"]["cursos_asignados"] == 0


@pytest.mark.asyncio
async def test_dashboard_registros_empleado_extra_pendiente(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_dash_reg@leoni.test")
    curso = await _make_curso(db, "Curso dashboard test")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_dash@leoni.test",
        empleado_id=883001,
        nombre="Empleado Dashboard",
    )
    db.add(
        CursoEmpleado(
            curso_id=curso.id,
            empleado_id=emp.empleado_id,
            sesion_id=None,
            obligatorio=True,
        )
    )
    await db.flush()

    headers = await auth_headers(client, rh)
    resp = await client.get(
        "/api/v1/level-up/cursos/dashboard/registros",
        params={"empleado_id": emp.empleado_id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["estado_curso"] == "pendiente"
    assert items[0]["curso_id"] == curso.id


@pytest.mark.asyncio
async def test_dashboard_historial_empleado_completado(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_dash_hist@leoni.test")
    curso = await _make_curso(db, "Curso historial test")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_hist@leoni.test",
        empleado_id=883002,
    )
    sesion = CursoSesion(
        curso_id=curso.id,
        fecha_inicio=__import__("datetime").date(2026, 1, 15),
        estado=EstadoSesion.completada,
    )
    db.add(sesion)
    await db.flush()
    db.add(
        CursoEmpleado(
            curso_id=curso.id,
            empleado_id=emp.empleado_id,
            sesion_id=sesion.id,
            asistio=True,
        )
    )
    await db.flush()

    headers = await auth_headers(client, rh)
    resp = await client.get(
        f"/api/v1/level-up/cursos/dashboard/empleados/{emp.empleado_id}/historial",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["empleado_id"] == emp.empleado_id
    assert len(data["cursos"]) == 1
    assert data["cursos"][0]["estado_curso"] == "completado"
    assert len(data["sesiones"]) == 1
