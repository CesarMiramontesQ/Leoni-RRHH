"""Solicitud de vacaciones con el saldo sincronizado en Bono.

El disponible del formulario sale de `levelup_vacaciones_disponibles` menos los días
comprometidos. `make_empleado` siembra 999 días; aquí se baja el saldo (o se deja al
empleado sin sincronizar) para probar los caminos de bloqueo.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import (
    auth_headers,
    make_empleado,
    make_solicitud,
    make_vacaciones_disponibles,
)


@pytest.mark.asyncio
async def test_disponible_endpoint_sin_comprometidos(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="disp-a@test")
    headers = await auth_headers(client, emp)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud", headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["saldo_tress"] == 999.0
    assert body["dias_comprometidos"] == 0
    assert body["dias_disponibles"] == 999.0


@pytest.mark.asyncio
async def test_disponible_resta_solicitudes_en_curso(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="disp-b@test")
    # 3 días naturales pendientes (comprometidos).
    await make_solicitud(
        db,
        empleado_id=emp.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 3),
    )
    headers = await auth_headers(client, emp)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud", headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["dias_comprometidos"] == 3
    assert body["dias_disponibles"] == 996.0


@pytest.mark.asyncio
async def test_disponible_excluir_solicitud_id(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="disp-ex@test")
    sol = await make_solicitud(
        db,
        empleado_id=emp.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 3),  # 3 días
    )
    await make_solicitud(
        db,
        empleado_id=emp.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 2),  # 2 días (siguen comprometidos)
    )
    headers = await auth_headers(client, emp)

    sin_excluir = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud", headers=headers
    )
    assert sin_excluir.status_code == 200
    assert sin_excluir.json()["dias_comprometidos"] == 5
    assert sin_excluir.json()["dias_disponibles"] == 994.0

    con_excluir = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud",
        params={"excluir_solicitud_id": sol.id},
        headers=headers,
    )
    assert con_excluir.status_code == 200
    body = con_excluir.json()
    assert body["dias_comprometidos"] == 2
    assert body["dias_disponibles"] == 997.0


@pytest.mark.asyncio
async def test_crear_bloquea_saldo_insuficiente(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="insuf@test")
    await make_vacaciones_disponibles(db, no_empleado=emp.no_empleado, dias_disponibles=3.0)
    headers = await auth_headers(client, emp)

    res = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-06",
            "fecha_fin": "2026-07-10",  # 5 días naturales > 3 disponibles
            "comentarios": "test",
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert "insuficiente" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_crear_bloquea_empleado_sin_sincronizar(client: AsyncClient, db):
    """Sin saldo en la caché no se permite crear: el 0 implícito sería inventado."""
    emp = await make_empleado(db, rol="empleado", email="caido@test", saldo_vacaciones=None)
    headers = await auth_headers(client, emp)

    res = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-06",
            "fecha_fin": "2026-07-08",
            "comentarios": "test",
        },
        headers=headers,
    )
    assert res.status_code == 503
