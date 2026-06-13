"""Ajustes de Nóminas — autorización RH para registro de horas extra."""

import pytest
from httpx import AsyncClient

from app.core.security import decode_token
from app.models.catalogos import Area, Puesto
from app.models.horas_extra import HorasExtraAprobador
from tests.conftest import auth_headers, make_empleado

AUTORIZADOS_URL = "/api/v1/nominas/ajustes/horas-extra/autorizados"
APROBADORES_URL = "/api/v1/nominas/ajustes/horas-extra/aprobadores"


async def _reset_aprobadores(db):
    from sqlalchemy import delete

    await db.execute(delete(HorasExtraAprobador))
    await db.flush()


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
    assert body["stats"]["total_autorizados"] >= 1
    assert {
        "total_autorizados",
        "autorizaciones_activas",
        "sin_autorizacion",
        "autorizaciones_recientes",
    } <= set(body["stats"])

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
    body_otorgar = otorgar.json()
    assert body_otorgar["actualizados"] == 1
    assert body_otorgar["stats"]["total_autorizados"] >= 1
    assert body_otorgar["stats"]["autorizaciones_recientes"] >= 1

    con_permiso = await client.get(
        "/api/v1/horas-extra/solicitudes", headers=headers_sup
    )
    assert con_permiso.status_code == 200

    detalle = await client.get(
        AUTORIZADOS_URL,
        headers=headers_rh,
        params={"q": "Supervisor Gestionado", "filtro": "autorizados"},
    )
    assert detalle.status_code == 200
    item = detalle.json()["items"][0]
    assert item["fecha_autorizacion"] is not None
    assert item["autorizado_por"] == empleado_rh.nombre

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

    sin_autorizacion = await client.get(
        AUTORIZADOS_URL,
        headers=headers_rh,
        params={"q": "Supervisor Gestionado", "filtro": "no_autorizados"},
    )
    item_revocado = sin_autorizacion.json()["items"][0]
    assert item_revocado["fecha_autorizacion"] is None
    assert item_revocado["autorizado_por"] is None


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


@pytest.mark.asyncio
async def test_ajustes_autorizar_rechaza_duplicados(
    client: AsyncClient, db, empleado_rh
):
    ya_autorizado = await make_empleado(
        db,
        rol="supervisor",
        nombre="Duplicado Autorizado",
        puede_registrar_horas_extra=True,
    )
    headers = await auth_headers(client, empleado_rh)

    response = await client.put(
        AUTORIZADOS_URL,
        headers=headers,
        json={"empleado_ids": [ya_autorizado.id], "autorizado": True},
    )
    assert response.status_code == 422
    assert "ya autorizados" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ajustes_busqueda_por_correo_area_y_puesto(
    client: AsyncClient, db, empleado_rh
):
    area = Area(area_id=98765, descripcion="Corte Especial", estatus_id=1)
    puesto = Puesto(puesto_id=98765, descripcion="Lider de Producción", estatus_id=1)
    db.add_all([area, puesto])
    await db.flush()

    con_area = await make_empleado(
        db,
        rol="empleado",
        nombre="Búsqueda Por Área",
        no_empleado="AJ-BUSQ-01",
    )
    con_area.area_id = area.area_id
    con_correo = await make_empleado(
        db,
        rol="empleado",
        nombre="Búsqueda Por Correo",
        no_empleado="AJ-BUSQ-02",
        email="busqueda.correo@leoni.test",
    )
    con_puesto = await make_empleado(
        db,
        rol="empleado",
        nombre="Búsqueda Por Puesto",
        no_empleado="AJ-BUSQ-03",
        puesto_id=puesto.puesto_id,
    )
    await db.flush()

    headers = await auth_headers(client, empleado_rh)

    por_correo = await client.get(
        AUTORIZADOS_URL, headers=headers, params={"q": "busqueda.correo@"}
    )
    assert por_correo.status_code == 200
    nos = {item["no_empleado"] for item in por_correo.json()["items"]}
    assert nos == {con_correo.no_empleado}

    por_area = await client.get(
        AUTORIZADOS_URL, headers=headers, params={"q": "Corte Especial"}
    )
    assert por_area.status_code == 200
    nos_area = {item["no_empleado"] for item in por_area.json()["items"]}
    assert con_area.no_empleado in nos_area

    por_puesto = await client.get(
        AUTORIZADOS_URL, headers=headers, params={"q": "Lider"}
    )
    assert por_puesto.status_code == 200
    nos_puesto = {item["no_empleado"] for item in por_puesto.json()["items"]}
    assert con_puesto.no_empleado in nos_puesto


# ── Aprobadores de horas extra (gerentes regionales / director) ──


@pytest.mark.asyncio
async def test_aprobadores_solo_rh(
    client: AsyncClient, db, empleado_base, empleado_supervisor, empleado_gerente
):
    for empleado in (empleado_base, empleado_supervisor, empleado_gerente):
        headers = await auth_headers(client, empleado)

        lista = await client.get(APROBADORES_URL, headers=headers)
        assert lista.status_code == 403

        crear = await client.post(
            APROBADORES_URL,
            headers=headers,
            json={"tipo": "gerente_regional", "empleado_ids": [empleado.id]},
        )
        assert crear.status_code == 403


@pytest.mark.asyncio
async def test_aprobadores_crear_listar_eliminar_gerentes(
    client: AsyncClient, db, empleado_rh
):
    await _reset_aprobadores(db)
    gerente1 = await make_empleado(db, rol="gerente", nombre="Gerente Regional Uno")
    gerente2 = await make_empleado(db, rol="gerente", nombre="Gerente Regional Dos")
    headers = await auth_headers(client, empleado_rh)

    vacio = await client.get(APROBADORES_URL, headers=headers)
    assert vacio.status_code == 200
    assert vacio.json() == {"gerentes": [], "directores": []}

    crear = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "gerente_regional", "empleado_ids": [gerente1.id, gerente2.id]},
    )
    assert crear.status_code == 201
    body = crear.json()
    assert {g["nombre"] for g in body["gerentes"]} == {
        "Gerente Regional Uno",
        "Gerente Regional Dos",
    }
    assert all(g["tipo"] == "gerente_regional" and g["activo"] for g in body["gerentes"])
    assert body["directores"] == []

    aprobador_id = body["gerentes"][0]["id"]
    eliminar = await client.delete(f"{APROBADORES_URL}/{aprobador_id}", headers=headers)
    assert eliminar.status_code == 200
    assert len(eliminar.json()["gerentes"]) == 1


@pytest.mark.asyncio
async def test_aprobadores_rechaza_duplicados(client: AsyncClient, db, empleado_rh):
    gerente = await make_empleado(db, rol="gerente", nombre="Gerente Duplicado")
    headers = await auth_headers(client, empleado_rh)

    primero = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "gerente_regional", "empleado_ids": [gerente.id]},
    )
    assert primero.status_code == 201

    duplicado = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "gerente_regional", "empleado_ids": [gerente.id]},
    )
    assert duplicado.status_code == 422
    assert "ya registrados" in duplicado.json()["detail"].lower()


@pytest.mark.asyncio
async def test_aprobadores_rechaza_empleado_inexistente(
    client: AsyncClient, db, empleado_rh
):
    headers = await auth_headers(client, empleado_rh)
    response = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "gerente_regional", "empleado_ids": [999999]},
    )
    assert response.status_code == 422
    assert "no encontrados" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_aprobadores_director_unico_activo(client: AsyncClient, db, empleado_rh):
    await _reset_aprobadores(db)
    director1 = await make_empleado(db, rol="director", nombre="Director Uno")
    director2 = await make_empleado(db, rol="director", nombre="Director Dos")
    headers = await auth_headers(client, empleado_rh)

    primero = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "director", "empleado_ids": [director1.id]},
    )
    assert primero.status_code == 201
    director_item = primero.json()["directores"][0]
    assert director_item["activo"] is True

    # No se permite un segundo director mientras haya uno activo.
    segundo = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "director", "empleado_ids": [director2.id]},
    )
    assert segundo.status_code == 422
    assert "director activo" in segundo.json()["detail"].lower()

    # Tampoco más de un director en la misma petición.
    varios = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "director", "empleado_ids": [director1.id, director2.id]},
    )
    assert varios.status_code == 422

    # Al desactivar el primero, se puede agregar el segundo.
    desactivar = await client.patch(
        f"{APROBADORES_URL}/{director_item['id']}",
        headers=headers,
        json={"activo": False},
    )
    assert desactivar.status_code == 200
    assert desactivar.json()["directores"][0]["activo"] is False

    segundo_ok = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "director", "empleado_ids": [director2.id]},
    )
    assert segundo_ok.status_code == 201
    directores = segundo_ok.json()["directores"]
    assert len(directores) == 2
    activos = [d for d in directores if d["activo"]]
    assert len(activos) == 1
    assert activos[0]["nombre"] == "Director Dos"

    # Reactivar al primero debe fallar mientras el segundo siga activo.
    reactivar = await client.patch(
        f"{APROBADORES_URL}/{director_item['id']}",
        headers=headers,
        json={"activo": True},
    )
    assert reactivar.status_code == 422
    assert "un director activo" in reactivar.json()["detail"].lower()


@pytest.mark.asyncio
async def test_aprobadores_toggle_y_eliminar_inexistente(
    client: AsyncClient, db, empleado_rh
):
    gerente = await make_empleado(db, rol="gerente", nombre="Gerente Toggle")
    headers = await auth_headers(client, empleado_rh)

    crear = await client.post(
        APROBADORES_URL,
        headers=headers,
        json={"tipo": "gerente_regional", "empleado_ids": [gerente.id]},
    )
    aprobador_id = crear.json()["gerentes"][0]["id"]

    desactivar = await client.patch(
        f"{APROBADORES_URL}/{aprobador_id}", headers=headers, json={"activo": False}
    )
    assert desactivar.status_code == 200
    assert desactivar.json()["gerentes"][0]["activo"] is False

    reactivar = await client.patch(
        f"{APROBADORES_URL}/{aprobador_id}", headers=headers, json={"activo": True}
    )
    assert reactivar.status_code == 200
    assert reactivar.json()["gerentes"][0]["activo"] is True

    no_existe = await client.patch(
        f"{APROBADORES_URL}/999999", headers=headers, json={"activo": False}
    )
    assert no_existe.status_code == 404

    eliminar_no_existe = await client.delete(
        f"{APROBADORES_URL}/999999", headers=headers
    )
    assert eliminar_no_existe.status_code == 404
