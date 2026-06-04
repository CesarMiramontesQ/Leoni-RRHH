"""Tests de capacidad gestor RH y modos UI lider/gerente."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rh_gestor_registry import normalize_puesto_text, resolve_rh_gestor_alcance
from app.core.rh_ui_mode import (
    effective_solicitud_scope_rol,
    rh_tiene_alcance_gestor,
    validate_rh_ui_mode_for_user,
)
from app.models.catalogos import Puesto
from tests.conftest import auth_headers, make_empleado, make_solicitud


async def _make_puesto(db: AsyncSession, descripcion: str) -> Puesto:
    pid = abs(hash(f"{descripcion}-{uuid.uuid4().hex}")) % 900_000 + 1000
    puesto = Puesto(puesto_id=pid, descripcion=descripcion, estatus_id=1)
    db.add(puesto)
    await db.flush()
    return puesto


def test_normalize_puesto_text():
    assert normalize_puesto_text("  Líder de Equipo de Recursos Humanos ") == (
        "lider de equipo de recursos humanos"
    )


@pytest.mark.asyncio
async def test_resolve_rh_gestor_alcance_por_puesto(db: AsyncSession):
    puesto = await _make_puesto(db, "Gerente de recursos humanos")
    rh = await make_empleado(db, rol="rh", email="gestor_rh@test", puesto_id=puesto.puesto_id)
    await db.refresh(rh, attribute_names=["puesto"])
    assert resolve_rh_gestor_alcance(rh) == "gerente"


@pytest.mark.asyncio
async def test_validate_rh_ui_mode_rechaza_gerente_sin_capacidad(db: AsyncSession):
    from fastapi import HTTPException

    rh = await make_empleado(db, rol="rh", email="rh_normal@test")
    with pytest.raises(HTTPException) as exc:
        validate_rh_ui_mode_for_user(rh, "gerente")
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_effective_scope_rh_lider(db: AsyncSession):
    puesto = await _make_puesto(db, "Lider de equipo de recursos humanos")
    rh = await make_empleado(db, rol="rh", email="lider_rh@test", puesto_id=puesto.puesto_id)
    await db.refresh(rh, attribute_names=["puesto"])
    assert effective_solicitud_scope_rol(rh, "lider") == "supervisor"
    assert rh_tiene_alcance_gestor(rh, "lider") is False
    assert rh_tiene_alcance_gestor(rh, "operativo") is True


@pytest.mark.asyncio
async def test_listar_solicitudes_rh_lider_modo_equipo(client: AsyncClient, db: AsyncSession):
    puesto = await _make_puesto(db, "Lider de equipo de recursos humanos")
    lider_rh = await make_empleado(
        db, rol="rh", email="rh_lider_sol@test", puesto_id=puesto.puesto_id
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        email="sub_lider_rh@test",
        lider_id=lider_rh.empleado_id,
    )
    otro = await make_empleado(db, rol="empleado", email="otro_lider_rh@test")

    await make_solicitud(db, empleado_id=sub.id)
    await make_solicitud(db, empleado_id=otro.id)

    headers = await auth_headers(client, lider_rh)
    headers["X-RH-UI-Mode"] = "lider"
    response = await client.get("/api/v1/solicitudes", headers=headers)

    assert response.status_code == 200
    ids = {item["empleado_id"] for item in response.json()["items"]}
    assert sub.id in ids
    assert otro.id not in ids


@pytest.mark.asyncio
async def test_listar_empleados_rh_gerente_modo_equipo(client: AsyncClient, db: AsyncSession):
    puesto = await _make_puesto(db, "Gerente de recursos humanos")
    gerente_rh = await make_empleado(
        db, rol="rh", email="rh_ger_emp@test", puesto_id=puesto.puesto_id
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        email="sub_ger_emp@test",
        lider_id=gerente_rh.empleado_id,
    )
    otro = await make_empleado(db, rol="empleado", email="otro_ger_emp@test")

    headers = await auth_headers(client, gerente_rh)
    headers["X-RH-UI-Mode"] = "gerente"
    response = await client.get("/api/v1/empleados", headers=headers)

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert sub.id in ids
    assert otro.id not in ids


@pytest.mark.asyncio
async def test_incidencias_rh_lider_modo_equipo(client: AsyncClient, db: AsyncSession):
    from app.models.incidencias import Incidencia

    puesto = await _make_puesto(db, "Lider de equipo de recursos humanos")
    lider_rh = await make_empleado(
        db, rol="rh", email="rh_lider_inc@test", puesto_id=puesto.puesto_id
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        email="sub_lider_inc@test",
        lider_id=lider_rh.empleado_id,
    )
    otro = await make_empleado(db, rol="empleado", email="otro_lider_inc@test")

    db.add(
        Incidencia(
            tipo="Retardo",
            empleado_id=sub.id,
            no_empleado=sub.no_empleado,
            nombre=sub.nombre,
            fecha=date.today(),
            categoria="Asistencia",
            origen="manual",
        )
    )
    db.add(
        Incidencia(
            tipo="Retardo",
            empleado_id=otro.id,
            no_empleado=otro.no_empleado,
            nombre=otro.nombre,
            fecha=date.today(),
            categoria="Asistencia",
            origen="manual",
        )
    )
    await db.commit()

    headers = await auth_headers(client, lider_rh)
    headers["X-RH-UI-Mode"] = "lider"
    response = await client.get("/api/v1/incidencias", headers=headers)

    assert response.status_code == 200
    ids = {item["empleado_id"] for item in response.json()["items"]}
    assert sub.id in ids
    assert otro.id not in ids


@pytest.mark.asyncio
async def test_comedor_equipo_metricas_rh_lider(client: AsyncClient, db: AsyncSession):
    puesto = await _make_puesto(db, "Lider de equipo de recursos humanos")
    lider_rh = await make_empleado(
        db, rol="rh", email="rh_lider_com@test", puesto_id=puesto.puesto_id
    )
    headers = await auth_headers(client, lider_rh)
    headers["X-RH-UI-Mode"] = "lider"
    response = await client.get("/api/v1/comedor/accesos/equipo/metricas", headers=headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_listar_solicitudes_rh_lider_modo_operativo_global(client: AsyncClient, db: AsyncSession):
    puesto = await _make_puesto(db, "Lider de equipo de recursos humanos")
    lider_rh = await make_empleado(
        db, rol="rh", email="rh_lider_op@test", puesto_id=puesto.puesto_id
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        email="sub_lider_op@test",
        lider_id=lider_rh.empleado_id,
    )
    otro = await make_empleado(db, rol="empleado", email="otro_lider_op@test")

    await make_solicitud(db, empleado_id=sub.id)
    await make_solicitud(db, empleado_id=otro.id)

    headers = await auth_headers(client, lider_rh)
    response = await client.get("/api/v1/solicitudes", headers=headers)

    assert response.status_code == 200
    ids = {item["empleado_id"] for item in response.json()["items"]}
    assert sub.id in ids
    assert otro.id in ids
