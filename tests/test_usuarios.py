# tests/test_usuarios.py
"""
Tests del dominio usuarios — modo lectura con edición restringida.

Cubre:
  - POST /api/v1/usuarios no existe (404 o 405)
  - PATCH /api/v1/usuarios/{id} — RH cambia lider_id y rol_id → 200
  - PATCH /api/v1/usuarios/{id} — rol != rh → 403
  - PATCH /api/v1/usuarios/{id} — empleado no encontrado → 404
  - PATCH /api/v1/usuarios/{id} — body vacío → 200 sin cambios
  - GET /api/v1/usuarios/{id} — RH puede ver un empleado → 200
  - GET /api/v1/usuarios/roles — RH puede listar roles → 200
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_crear_usuario_endpoint_eliminado(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_post@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/usuarios",
        json={
            "no_empleado": "EMP-X",
            "nombre": "X Y",
            "email": "x@leoni.test",
            "password": "Passw0rd!Seguro",
            "rol_id": 1,
        },
        headers=headers,
    )

    assert response.status_code in (404, 405)


@pytest.mark.asyncio
async def test_patch_asignacion_supervisor_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_patch@leoni.test")
    supervisor = await make_empleado(db, rol="supervisor", email="sup_patch@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_patch@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"lider_id": supervisor.empleado_id},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["lider_id"] == supervisor.empleado_id
    assert body["id"] == empleado.id


@pytest.mark.asyncio
async def test_patch_asignacion_rol_rh_retorna_200(client: AsyncClient, db):
    from sqlalchemy import select

    from app.models.roles import Rol

    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_rol@leoni.test",
        puede_administrar_permisos_rh=True,
    )
    empleado = await make_empleado(db, rol="empleado", email="emp_rol@leoni.test")
    headers = await auth_headers(client, rh)

    result = await db.execute(select(Rol).where(Rol.nombre == "supervisor"))
    rol_supervisor = result.scalar_one_or_none()
    if not rol_supervisor:
        rol_supervisor = Rol(nombre="supervisor", permisos={})
        db.add(rol_supervisor)
        await db.flush()
        await db.refresh(rol_supervisor)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"rol_id": rol_supervisor.id},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rol_id"] == rol_supervisor.id


@pytest.mark.asyncio
async def test_patch_asignacion_rol_sin_flag_retorna_403(client: AsyncClient, db):
    """Cambiar rol exige puede_administrar_permisos_rh, aunque el actor sea RH."""
    from sqlalchemy import select

    from app.models.roles import Rol

    rh_sin_flag = await make_empleado(
        db,
        rol="rh",
        email="rh_sin_flag@leoni.test",
        puede_administrar_permisos_rh=False,
    )
    empleado = await make_empleado(db, rol="empleado", email="emp_sin_flag@leoni.test")
    headers = await auth_headers(client, rh_sin_flag)

    result = await db.execute(select(Rol).where(Rol.nombre == "supervisor"))
    rol_supervisor = result.scalar_one_or_none()
    if not rol_supervisor:
        rol_supervisor = Rol(nombre="supervisor", permisos={})
        db.add(rol_supervisor)
        await db.flush()
        await db.refresh(rol_supervisor)

    rol_original = empleado.rol_id
    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"rol_id": rol_supervisor.id},
        headers=headers,
    )

    assert response.status_code == 403
    await db.refresh(empleado)
    assert empleado.rol_id == rol_original


@pytest.mark.asyncio
async def test_patch_asignacion_comedor_sin_flag_retorna_200(client: AsyncClient, db):
    """Sin el flag se puede seguir editando comedor (solo el rol queda restringido)."""
    from app.models.comedor import Comedor
    from app.models.turnos_empleados import TurnoEmpleado
    from sqlalchemy import select

    rh_sin_flag = await make_empleado(
        db,
        rol="rh",
        email="rh_comedor_sin_flag@leoni.test",
        puede_administrar_permisos_rh=False,
    )
    empleado = await make_empleado(db, rol="empleado", email="emp_comedor_sin_flag@leoni.test")
    comedor = Comedor(nombre="Comedor Sin Flag Test", activo=True)
    db.add(comedor)
    await db.flush()

    headers = await auth_headers(client, rh_sin_flag)
    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"comedor_id": comedor.id},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    from app.utils.turno_empleado_match import turno_no_empleado_matches

    result = await db.execute(
        select(TurnoEmpleado).where(turno_no_empleado_matches(empleado.no_empleado))
    )
    turno = result.scalar_one_or_none()
    assert turno is not None
    assert turno.comedor == comedor.id


@pytest.mark.asyncio
async def test_patch_asignacion_comedor_rh_persiste_turnos(client: AsyncClient, db):
    from app.models.comedor import Comedor
    from app.models.turnos_empleados import TurnoEmpleado
    from sqlalchemy import select

    rh = await make_empleado(db, rol="rh", email="rh_comedor@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_comedor@leoni.test")
    comedor = Comedor(nombre="Comedor RH Test", activo=True)
    db.add(comedor)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"comedor_id": comedor.id},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    from app.utils.turno_empleado_match import turno_no_empleado_matches

    result = await db.execute(
        select(TurnoEmpleado).where(turno_no_empleado_matches(empleado.no_empleado))
    )
    turno = result.scalar_one_or_none()
    assert turno is not None
    assert turno.comedor == comedor.id


@pytest.mark.asyncio
async def test_patch_asignacion_gerente_retorna_403(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="gerente_patch@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_403@leoni.test")
    headers = await auth_headers(client, gerente)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"lider_id": None},
        headers=headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patch_asignacion_empleado_inexistente_retorna_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_404@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        "/api/v1/usuarios/999999",
        json={"lider_id": None},
        headers=headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_patch_asignacion_body_vacio_retorna_200_sin_cambios(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_empty@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_empty@leoni.test")
    headers = await auth_headers(client, rh)
    rol_id_original = empleado.rol_id

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["rol_id"] == rol_id_original


@pytest.mark.asyncio
async def test_get_usuario_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_get@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_get@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(f"/api/v1/usuarios/{empleado.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == empleado.id


@pytest.mark.asyncio
async def test_list_roles_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_roles@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/usuarios/roles", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert "id" in body[0]
    assert "nombre" in body[0]
