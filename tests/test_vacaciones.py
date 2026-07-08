"""Tests del saldo de vacaciones (tabla local)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vacaciones_disponibles import VacacionesDisponibles
from tests.conftest import auth_headers, make_empleado

SOLICITUD_VACACIONES = {
    "tipo": "vacaciones",
    "fecha_inicio": "2026-05-05",
    "fecha_fin": "2026-05-09",
    "comentarios": "Vacaciones de prueba",
}


@pytest.mark.asyncio
async def test_rh_actualiza_y_consulta_saldo(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="vac-rh@test", dias_vacaciones=None)
    emp = await make_empleado(db, rol="empleado", email="vac-emp@test", dias_vacaciones=0)
    headers_rh = await auth_headers(client, rh)

    put = await client.put(
        f"/api/v1/empleados/{emp.id}/vacaciones",
        json={"dias_disponibles": 12},
        headers=headers_rh,
    )
    assert put.status_code == 200
    assert put.json()["dias_disponibles"] == 12

    get = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones",
        headers=headers_rh,
    )
    assert get.status_code == 200
    assert get.json()["dias_disponibles"] == 12


@pytest.mark.asyncio
async def test_crear_solicitud_vacaciones_no_toca_saldo_interno(
    client: AsyncClient, db: AsyncSession
):
    """La fuente del saldo es TRESS (mock en conftest = 999); el saldo interno quedó
    dormante y NO se debita al crear una solicitud de vacaciones."""
    empleado = await make_empleado(
        db, rol="empleado", email="vac-debit@test", dias_vacaciones=10
    )
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )
    assert response.status_code == 201

    result = await db.execute(
        select(VacacionesDisponibles).where(
            VacacionesDisponibles.no_empleado == empleado.no_empleado
        )
    )
    row = result.scalar_one()
    assert row.dias == 10  # saldo interno intacto
