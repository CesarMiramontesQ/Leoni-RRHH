"""Ajustes de Nóminas — autorización RH para registro de horas extra."""

import pytest
from httpx import AsyncClient

from app.core.security import decode_token
from tests.conftest import auth_headers, make_empleado

AUTORIZADOS_URL = "/api/v1/nominas/ajustes/horas-extra/autorizados"


@pytest.mark.asyncio
async def test_ajustes_autorizados_solo_rh(
    client: AsyncClient, db, empleado_base, empleado_supervisor, empleado_gerente
):
    for empleado in (empleado_base, empleado_supervisor, empleado_gerente):
        headers = await auth_headers(client, empleado)

        lista = await client.get(AUTORIZADOS_URL, headers=headers)
        assert lista.status_code == 403

        update = await client.put(
            AUTORIZADOS_URL,
            headers=headers,
            json={"empleado_ids": [empleado.id], "autorizado": True},
        )
        assert update.status_code == 403


@pytest.mark.asyncio
async def test_ajustes_autorizados_lista_busqueda_y_filtro(
    client: AsyncClient, db, empleado_rh
):
    autorizado = await make_empleado(
        db,
        rol="supervisor",
        nombre="Zulema Autorizada",
        no_empleado="AJ-HE-01",
        puede_registrar_horas_extra=True,
    )
    await make_empleado(
        db,
        rol="supervisor",
        nombre="Zacarías Pendiente",
        no_empleado="AJ-HE-02",
    )
    inactivo = await make_empleado(
        db,
        rol="empleado",
        nombre="Zoe Inactiva",
        no_empleado="AJ-HE-03",
        estado_id=99,
    )

    headers = await auth_headers(client, empleado_rh)

    lista = await client.get(AUTORIZADOS_URL, headers=headers, params={"q": "AJ-HE"})
    assert lista.status_code == 200
    body = lista.json()
    nos = {item["no_empleado"] for item in body["items"]}
    assert nos == {"AJ-HE-01", "AJ-HE-02"}
    assert inactivo.no_empleado not in nos
    por_no = {item["no_empleado"]: item for item in body["items"]}
    assert por_no["AJ-HE-01"]["autorizado"] is True
    assert por_no["AJ-HE-02"]["autorizado"] is False
    assert body["total_autorizados"] >= 1

    solo_autorizados = await client.get(
        AUTORIZADOS_URL,
        headers=headers,
        params={"q": "AJ-HE", "filtro": "autorizados"},
    )
    assert solo_autorizados.status_code == 200
    items = solo_autorizados.json()["items"]
    assert {item["no_empleado"] for item in items} == {"AJ-HE-01"}

    por_nombre = await client.get(
        AUTORIZADOS_URL, headers=headers, params={"q": "Zacarías"}
    )
    assert por_nombre.status_code == 200
    assert {item["no_empleado"] for item in por_nombre.json()["items"]} == {"AJ-HE-02"}

    assert autorizado.puede_registrar_horas_extra is True


@pytest.mark.asyncio
async def test_ajustes_autorizar_y_revocar_controla_registro(
    client: AsyncClient, db, empleado_rh
):
    supervisor = await make_empleado(
        db, rol="supervisor", nombre="Supervisor Gestionado"
    )
    headers_rh = await auth_headers(client, empleado_rh)
    headers_sup = await auth_headers(client, supervisor)

    sin_permiso = await client.get(
        "/api/v1/horas-extra/solicitudes", headers=headers_sup
    )
    assert sin_permiso.status_code == 403

    otorgar = await client.put(
        AUTORIZADOS_URL,
        headers=headers_rh,
        json={"empleado_ids": [supervisor.id], "autorizado": True},
    )
    assert otorgar.status_code == 200
    assert otorgar.json()["actualizados"] == 1

    con_permiso = await client.get(
        "/api/v1/horas-extra/solicitudes", headers=headers_sup
    )
    assert con_permiso.status_code == 200

    revocar = await client.put(
        AUTORIZADOS_URL,
        headers=headers_rh,
        json={"empleado_ids": [supervisor.id], "autorizado": False},
    )
    assert revocar.status_code == 200
    assert revocar.json()["actualizados"] == 1

    revocado = await client.get(
        "/api/v1/horas-extra/solicitudes", headers=headers_sup
    )
    assert revocado.status_code == 403


@pytest.mark.asyncio
async def test_login_incluye_claim_he_autorizado(client: AsyncClient, db):
    """El access token expone `he_autorizado` para visibilidad de UI."""
    autorizado = await make_empleado(
        db, rol="empleado", nombre="Con Claim", puede_registrar_horas_extra=True
    )
    sin_permiso = await make_empleado(db, rol="supervisor", nombre="Sin Claim")

    login_autorizado = await client.post(
        "/api/v1/auth/login",
        data={"username": autorizado.email, "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_autorizado.status_code == 200
    payload = decode_token(login_autorizado.json()["access_token"])
    assert payload.get("he_autorizado") is True

    login_sin_permiso = await client.post(
        "/api/v1/auth/login",
        data={"username": sin_permiso.email, "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_sin_permiso.status_code == 200
    payload_sin = decode_token(login_sin_permiso.json()["access_token"])
    assert "he_autorizado" not in payload_sin


@pytest.mark.asyncio
async def test_ajustes_autorizar_rechaza_empleado_inexistente(
    client: AsyncClient, db, empleado_rh
):
    headers = await auth_headers(client, empleado_rh)
    response = await client.put(
        AUTORIZADOS_URL,
        headers=headers,
        json={"empleado_ids": [999999], "autorizado": True},
    )
    assert response.status_code == 422
