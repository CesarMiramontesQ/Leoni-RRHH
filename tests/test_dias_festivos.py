"""Días festivos: configuración (RH), lectura pública y efecto en solicitudes."""

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.auditoria import AuditLog
from app.utils.dias_festivos_lft import festivos_oficiales_lft
from tests.conftest import (
    auth_headers,
    make_dia_festivo,
    make_empleado,
    make_empleado_home_office,
    make_solicitud,
)

URL = "/api/v1/laborales-config/dias-festivos"
URL_PUBLICA = "/api/v1/solicitudes/dias-festivos"


# ── Catálogo LFT ─────────────────────────────────────────────────────────────


def test_festivos_oficiales_lft_2026():
    fechas = dict(festivos_oficiales_lft(2026))
    assert date(2026, 1, 1) in fechas
    assert date(2026, 2, 2) in fechas  # primer lunes de febrero
    assert date(2026, 3, 16) in fechas  # tercer lunes de marzo
    assert date(2026, 5, 1) in fechas
    assert date(2026, 9, 16) in fechas
    assert date(2026, 11, 16) in fechas  # tercer lunes de noviembre
    assert date(2026, 12, 25) in fechas
    assert date(2026, 10, 1) not in fechas
    assert len(fechas) == 7


def test_festivos_oficiales_lft_transmision_poder_cada_seis_anios():
    assert date(2030, 10, 1) in dict(festivos_oficiales_lft(2030))
    assert date(2024, 10, 1) in dict(festivos_oficiales_lft(2024))


# ── Configuración (módulo laborales-configuracion) ───────────────────────────


@pytest.mark.asyncio
async def test_festivos_solo_rh(
    client: AsyncClient, db, empleado_base, empleado_supervisor, empleado_gerente, empleado_director
):
    for empleado in (empleado_base, empleado_supervisor, empleado_gerente, empleado_director):
        headers = await auth_headers(client, empleado)
        assert (await client.get(f"{URL}?anio=2026", headers=headers)).status_code == 403
        r = await client.post(
            URL, headers=headers, json={"fecha": "2026-09-16", "descripcion": "Independencia"}
        )
        assert r.status_code == 403
        r = await client.post(
            f"{URL}/cargar-oficiales", headers=headers, json={"anio": 2026}
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_festivos_crear_listar_actualizar_y_auditoria(client: AsyncClient, db, empleado_rh):
    headers = await auth_headers(client, empleado_rh)

    r = await client.post(
        URL, headers=headers, json={"fecha": "2026-09-16", "descripcion": "  Independencia "}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["item"]["descripcion"] == "Independencia"
    assert body["item"]["activo"] is True
    assert body["solicitudes_afectadas"] == 0
    festivo_id = body["item"]["id"]

    # Duplicado por fecha → 409
    r = await client.post(
        URL, headers=headers, json={"fecha": "2026-09-16", "descripcion": "Otro"}
    )
    assert r.status_code == 409

    # Listado por año incluye apagados; otro año no lo trae
    r = await client.get(f"{URL}?anio=2026", headers=headers)
    assert r.status_code == 200
    assert [i["id"] for i in r.json()["items"]] == [festivo_id]
    r = await client.get(f"{URL}?anio=2027", headers=headers)
    assert r.json()["total"] == 0

    # Apagar
    r = await client.put(
        f"{URL}/{festivo_id}",
        headers=headers,
        json={"descripcion": "Independencia", "activo": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["item"]["activo"] is False
    r = await client.get(f"{URL}?anio=2026", headers=headers)
    assert r.json()["items"][0]["activo"] is False

    r = await client.put(
        f"{URL}/999999", headers=headers, json={"descripcion": "x", "activo": True}
    )
    assert r.status_code == 404

    logs = (
        await db.execute(
            select(AuditLog).where(AuditLog.modulo == "laborales_config").order_by(AuditLog.id)
        )
    ).scalars().all()
    acciones = [l.accion for l in logs]
    assert acciones == [
        "LABORALES_CONFIG_DIA_FESTIVO_CREATED",
        "LABORALES_CONFIG_DIA_FESTIVO_UPDATED",
    ]
    assert logs[0].datos_antes is None
    assert logs[1].datos_antes["activo"] is True
    assert logs[1].datos_despues["activo"] is False


@pytest.mark.asyncio
async def test_festivos_valida_descripcion(client: AsyncClient, empleado_rh):
    headers = await auth_headers(client, empleado_rh)
    r = await client.post(URL, headers=headers, json={"fecha": "2026-09-16", "descripcion": "   "})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_festivos_advierte_solicitudes_afectadas(client: AsyncClient, db, empleado_rh):
    emp = await make_empleado(db, rol="empleado", email="fest_af@test", no_empleado=95001)
    await make_solicitud(
        db, empleado_id=emp.id, tipo="vacaciones", estado="approved",
        fecha_inicio=date(2026, 9, 14), fecha_fin=date(2026, 9, 16),
    )
    await make_solicitud(
        db, empleado_id=emp.id, tipo="vacaciones", estado="rejected",
        fecha_inicio=date(2026, 9, 15), fecha_fin=date(2026, 9, 15),
    )
    await make_solicitud(
        db, empleado_id=emp.id, tipo="matrimonio", estado="pending",
        fecha_inicio=date(2026, 9, 15), fecha_fin=date(2026, 9, 17),
    )
    headers = await auth_headers(client, empleado_rh)
    r = await client.post(
        URL, headers=headers, json={"fecha": "2026-09-15", "descripcion": "Puente"}
    )
    assert r.status_code == 201, r.text
    # Solo la aprobada de vacaciones: la rechazada y el matrimonio no cuentan.
    assert r.json()["solicitudes_afectadas"] == 1

    r = await client.put(
        f"{URL}/{r.json()['item']['id']}",
        headers=headers,
        json={"descripcion": "Puente", "activo": False},
    )
    assert r.json()["solicitudes_afectadas"] == 0


@pytest.mark.asyncio
async def test_festivos_cargar_oficiales_respeta_existentes(client: AsyncClient, db, empleado_rh):
    await make_dia_festivo(db, fecha=date(2026, 5, 1), descripcion="Trabajo (contrato)", activo=False)
    headers = await auth_headers(client, empleado_rh)
    r = await client.post(f"{URL}/cargar-oficiales", headers=headers, json={"anio": 2026})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["omitidos"] == 1
    assert len(body["agregados"]) == 6
    assert all(i["activo"] for i in body["agregados"])

    # Segunda corrida: nada nuevo, nada tocado
    r = await client.post(f"{URL}/cargar-oficiales", headers=headers, json={"anio": 2026})
    assert r.json()["agregados"] == []
    assert r.json()["omitidos"] == 7
    r = await client.get(f"{URL}?anio=2026", headers=headers)
    mayo = next(i for i in r.json()["items"] if i["fecha"] == "2026-05-01")
    assert mayo["activo"] is False and mayo["descripcion"] == "Trabajo (contrato)"


# ── Lectura pública ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_festivos_publicos_solo_activos_cualquier_autenticado(
    client: AsyncClient, db, empleado_base
):
    await make_dia_festivo(db, fecha=date(2026, 9, 16), descripcion="Independencia")
    await make_dia_festivo(db, fecha=date(2026, 11, 2), descripcion="Muertos", activo=False)
    await make_dia_festivo(db, fecha=date(2027, 1, 1), descripcion="Año Nuevo")
    headers = await auth_headers(client, empleado_base)
    r = await client.get(f"{URL_PUBLICA}?anio=2026", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "anio": 2026,
        "items": [{"fecha": "2026-09-16", "descripcion": "Independencia"}],
    }
    assert (await client.get(URL_PUBLICA)).status_code == 401


# ── Efecto en solicitudes ────────────────────────────────────────────────────


def _vacaciones(inicio: str, fin: str) -> dict:
    return {"tipo": "vacaciones", "fecha_inicio": inicio, "fecha_fin": fin, "comentarios": "t"}


@pytest.mark.asyncio
async def test_vacaciones_no_descuentan_el_festivo(client: AsyncClient, db):
    """14–16 sep con el 15 festivo = 2 días; con saldo exacto 2.0 la solicitud pasa."""
    await make_dia_festivo(db, fecha=date(2026, 9, 15))
    emp = await make_empleado(
        db, rol="empleado", email="fest_vac_cnt@test", no_empleado=95002, saldo_vacaciones=2.0
    )
    headers = await auth_headers(client, emp)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.post(
            "/api/v1/solicitudes", json=_vacaciones("2026-09-14", "2026-09-16"), headers=headers
        )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_vacaciones_festivo_apagado_si_descuenta(client: AsyncClient, db):
    await make_dia_festivo(db, fecha=date(2026, 9, 15), activo=False)
    emp = await make_empleado(
        db, rol="empleado", email="fest_vac_off@test", no_empleado=95003, saldo_vacaciones=2.0
    )
    headers = await auth_headers(client, emp)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.post(
            "/api/v1/solicitudes", json=_vacaciones("2026-09-14", "2026-09-16"), headers=headers
        )
    assert r.status_code == 422
    assert "saldo insuficiente" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vacaciones_festivo_en_descanso_no_se_recorre(client: AsyncClient, db):
    """Festivo que coincide con descanso: se excluye una sola vez (2 días, no 1 ni 3)."""
    await make_dia_festivo(db, fecha=date(2026, 9, 15))
    emp = await make_empleado(
        db, rol="empleado", email="fest_vac_desc@test", no_empleado=95004, saldo_vacaciones=2.0
    )
    headers = await auth_headers(client, emp)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[date(2026, 9, 15)],
    ):
        r = await client.post(
            "/api/v1/solicitudes", json=_vacaciones("2026-09-14", "2026-09-16"), headers=headers
        )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
@pytest.mark.parametrize("inicio,fin", [("2026-09-15", "2026-09-16"), ("2026-09-14", "2026-09-15")])
async def test_vacaciones_no_inician_ni_terminan_en_festivo(client: AsyncClient, db, inicio, fin):
    await make_dia_festivo(db, fecha=date(2026, 9, 15))
    emp = await make_empleado(
        db, rol="empleado", email=f"fest_vac_{inicio}@test", no_empleado=95005, saldo_vacaciones=10.0
    )
    headers = await auth_headers(client, emp)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.post("/api/v1/solicitudes", json=_vacaciones(inicio, fin), headers=headers)
    assert r.status_code == 422, r.text
    assert "festivo" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vacaciones_rh_no_esta_exento_del_festivo(client: AsyncClient, db, empleado_rh):
    await make_dia_festivo(db, fecha=date(2026, 9, 15))
    emp = await make_empleado(
        db, rol="empleado", email="fest_vac_rh@test", no_empleado=95006, saldo_vacaciones=10.0
    )
    headers = await auth_headers(client, empleado_rh)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.post(
            "/api/v1/solicitudes",
            json={**_vacaciones("2026-09-15", "2026-09-16"), "empleado_id": emp.id},
            headers=headers,
        )
    assert r.status_code == 422, r.text
    assert "festivo" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vacaciones_revision_tambien_valida_festivo(client: AsyncClient, db):
    await make_dia_festivo(db, fecha=date(2026, 9, 15))
    emp = await make_empleado(
        db, rol="empleado", email="fest_vac_rev@test", no_empleado=95007, saldo_vacaciones=10.0
    )
    solicitud = await make_solicitud(
        db, empleado_id=emp.id, tipo="vacaciones", estado="changes_requested",
        fecha_inicio=date(2026, 9, 21), fecha_fin=date(2026, 9, 22),
    )
    headers = await auth_headers(client, emp)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.patch(
            f"/api/v1/solicitudes/{solicitud.id}/revision",
            json={"fecha_inicio": "2026-09-15", "fecha_fin": "2026-09-16"},
            headers=headers,
        )
    assert r.status_code == 422, r.text
    assert "festivo" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_home_office_en_festivo_rechazado(client: AsyncClient, db):
    await make_dia_festivo(db, fecha=date(2026, 6, 2))
    empleado = await make_empleado_home_office(db, email="fest_ho@test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes",
        json={"tipo": "home_office", "fecha_inicio": "2026-06-02", "fecha_fin": "2026-06-02"},
        headers=headers,
    )
    assert r.status_code == 422, r.text
    assert "festivo" in r.json()["detail"].lower()
    r = await client.post(
        "/api/v1/solicitudes",
        json={"tipo": "home_office", "fecha_inicio": "2026-06-03", "fecha_fin": "2026-06-03"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_permiso_sin_goce_ignora_festivo(client: AsyncClient, db):
    """Los permisos no bloquean ni cuentan festivos (decisión de diseño): solo vacaciones y HO."""
    await make_dia_festivo(db, fecha=date(2026, 7, 20))
    supervisor = await make_empleado(db, rol="supervisor", email="fest_goce_sup@test", no_empleado=95008)
    emp = await make_empleado(
        db, rol="empleado", email="fest_goce@test", no_empleado=95009, lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, supervisor)
    with patch(
        "app.services.solicitud_service.obtener_descansos_bono",
        new_callable=AsyncMock,
        return_value=[],
    ):
        r = await client.post(
            "/api/v1/solicitudes",
            json={
                "tipo": "permiso_sin_goce_sueldo",
                "fecha_inicio": "2026-07-20",
                "fecha_fin": "2026-07-21",
                "empleado_id": emp.id,
                "motivo": "Personal",
            },
            headers=headers,
        )
    assert r.status_code == 201, r.text
