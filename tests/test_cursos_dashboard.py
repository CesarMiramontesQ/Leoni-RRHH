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
async def test_dashboard_historial_empleado_completado_excluido_por_defecto(
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
    assert data["cursos"] == []
    assert data["sesiones"] == []


@pytest.mark.asyncio
async def test_dashboard_historial_empleado_incluye_completado_si_solo_activos_false(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_dash_hist_full@leoni.test")
    curso = await _make_curso(db, "Curso historial completo")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_hist_full@leoni.test",
        empleado_id=883003,
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
        params={"solo_activos": "false"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data["cursos"]) == 1
    assert data["cursos"][0]["estado_curso"] == "completado"
    assert len(data["sesiones"]) == 1


# ══════════════════════════════════════════════════════════════════════════
# Filtro por area — recorta pares Y sesiones (si no, medio tablero mentiria)
# ══════════════════════════════════════════════════════════════════════════
async def _area(db: AsyncSession, descripcion: str):
    import uuid

    from app.models.catalogos import Area

    area_id = int(uuid.uuid4().hex[:6], 16) % 900000 + 100000
    area = Area(area_id=area_id, descripcion=descripcion, estatus_id=1)
    db.add(area)
    await db.flush()
    return area


@pytest.mark.asyncio
async def test_resumen_por_area_recorta_pares_y_sesiones(
    client: AsyncClient, db: AsyncSession
):
    """El area recorta las dos familias de KPI: los pares (empleado x curso) y
    las sesiones. Una sesion sin inscritos del area no cuenta ni aparece en
    'proximas' — con las sesiones globales, el tablero mezclaria poblaciones."""
    from datetime import date, timedelta

    rh = await make_empleado(db, rol="rh", email="rh_dash_area@leoni.test")
    area_a = await _area(db, "Arneses A")
    area_b = await _area(db, "Almacen")

    curso_a = await _make_curso(db, "Curso area A")
    curso_b = await _make_curso(db, "Curso area B")
    emp_a = await make_empleado(db, rol="empleado", email="emp_area_a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="emp_area_b@leoni.test")
    emp_a.area_id = area_a.area_id
    emp_b.area_id = area_b.area_id
    await db.flush()

    manana = date.today() + timedelta(days=7)
    ses_a = CursoSesion(
        curso_id=curso_a.id, fecha_inicio=manana, fecha_fin=manana, estado=EstadoSesion.programada
    )
    ses_b = CursoSesion(
        curso_id=curso_b.id, fecha_inicio=manana, fecha_fin=manana, estado=EstadoSesion.programada
    )
    db.add_all([ses_a, ses_b])
    await db.flush()
    db.add_all([
        CursoEmpleado(curso_id=curso_a.id, empleado_id=emp_a.empleado_id, sesion_id=ses_a.id, obligatorio=True),
        CursoEmpleado(curso_id=curso_b.id, empleado_id=emp_b.empleado_id, sesion_id=ses_b.id, obligatorio=True),
    ])
    await db.flush()

    headers = await auth_headers(client, rh)
    url = "/api/v1/level-up/cursos/dashboard/resumen"

    resp_todos = await client.get(url, headers=headers)
    assert resp_todos.status_code == 200, resp_todos.text
    todos = resp_todos.json()
    assert todos["kpis"]["cursos_con_sesion_proxima"] == 2
    assert todos["kpis"]["empleados_con_sesiones_pendientes"] == 2
    assert todos["kpis"]["sesiones_pendientes"] == 2

    resp_area = await client.get(url, params={"area_id": area_a.area_id}, headers=headers)
    assert resp_area.status_code == 200, resp_area.text
    solo_a = resp_area.json()
    assert solo_a["kpis"]["cursos_con_sesion_proxima"] == 1
    assert solo_a["kpis"]["empleados_con_sesiones_pendientes"] == 1
    # La sesion del otro area desaparece: es la mitad que se quedaba global.
    assert solo_a["kpis"]["sesiones_pendientes"] == 1
    assert {s["sesion_id"] for s in solo_a["sesiones_proximas"]} == {ses_a.id}
    assert {e["empleado_id"] for e in solo_a["empleados_sesiones_pendientes"]} == {emp_a.empleado_id}


@pytest.mark.asyncio
async def test_resumen_lista_areas_sin_depender_del_filtro(
    client: AsyncClient, db: AsyncSession
):
    """Las opciones del selector no se recortan con el filtro aplicado: si se
    recortaran, elegir un area dejaria esa unica opcion y no habria vuelta."""
    rh = await make_empleado(db, rol="rh", email="rh_dash_areas@leoni.test")
    area_a = await _area(db, "Arneses A")
    area_b = await _area(db, "Almacen")
    curso = await _make_curso(db, "Curso areas")
    emp_a = await make_empleado(db, rol="empleado", email="emp_areas_a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="emp_areas_b@leoni.test")
    emp_a.area_id = area_a.area_id
    emp_b.area_id = area_b.area_id
    await db.flush()
    db.add_all([
        CursoEmpleado(curso_id=curso.id, empleado_id=emp_a.empleado_id, sesion_id=None, obligatorio=True),
        CursoEmpleado(curso_id=curso.id, empleado_id=emp_b.empleado_id, sesion_id=None, obligatorio=True),
    ])
    await db.flush()

    headers = await auth_headers(client, rh)
    url = "/api/v1/level-up/cursos/dashboard/resumen"
    resp = await client.get(url, params={"area_id": area_a.area_id}, headers=headers)
    assert resp.status_code == 200, resp.text
    areas = {a["id"]: a["nombre"] for a in resp.json()["areas"]}
    assert areas == {area_a.area_id: "Arneses A", area_b.area_id: "Almacen"}
