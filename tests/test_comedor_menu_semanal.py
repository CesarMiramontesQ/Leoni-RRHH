"""Menú semanal: publicación y upsert por día."""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

MENU_URL = "/api/v1/comedor/menu"
COMEDORES_URL = "/api/v1/comedor/comedores"


async def _crear_comedor(client: AsyncClient, hdrs: dict) -> int:
    r = await client.post(
        COMEDORES_URL,
        json={"nombre": "Comedor menú test", "activo": True},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_publicar_menu_todos_los_dias_laborales(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_menu_sem@test.leoni", password="RhM3nu!")
    hdrs = await auth_headers(client, rh, password="RhM3nu!")
    comedor_id = await _crear_comedor(client, hdrs)
    semana = date(2026, 3, 2)

    dias = {
        "lunes": ("Pollo lunes", "Dieta lunes"),
        "martes": ("Pollo martes", "Dieta martes"),
        "miercoles": ("Pollo miercoles", "Dieta miercoles"),
        "jueves": ("Pollo jueves", "Dieta jueves"),
        "viernes": ("Pollo viernes", "Dieta viernes"),
    }
    for dia, (normal, dieta) in dias.items():
        for tipo, descripcion in (("normal", normal), ("dieta", dieta)):
            r = await client.post(
                MENU_URL,
                json={
                    "comedor_id": comedor_id,
                    "semana": semana.isoformat(),
                    "dia": dia,
                    "tipo": tipo,
                    "descripcion": descripcion,
                },
                headers=hdrs,
            )
            assert r.status_code == 200, r.text

    r = await client.get(
        MENU_URL,
        params={"comedor_id": comedor_id, "semana": semana.isoformat()},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 10
    by_dia = {}
    for item in items:
        by_dia.setdefault(item["dia"], {})[item["tipo"]] = item["descripcion"]
    assert by_dia["martes"]["normal"] == "Pollo martes"
    assert by_dia["viernes"]["dieta"] == "Dieta viernes"


@pytest.mark.asyncio
async def test_publicar_menu_upsert_sin_duplicar(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_menu_upsert@test.leoni", password="RhUps3rt!")
    hdrs = await auth_headers(client, rh, password="RhUps3rt!")
    comedor_id = await _crear_comedor(client, hdrs)
    semana = date(2026, 3, 9)
    body = {
        "comedor_id": comedor_id,
        "semana": semana.isoformat(),
        "dia": "lunes",
        "tipo": "normal",
        "descripcion": "Original",
    }

    r1 = await client.post(MENU_URL, json=body, headers=hdrs)
    assert r1.status_code == 200, r1.text
    first_id = r1.json()["id"]

    body["descripcion"] = "Actualizado"
    r2 = await client.post(MENU_URL, json=body, headers=hdrs)
    assert r2.status_code == 200, r2.text
    assert r2.json()["id"] == first_id
    assert r2.json()["descripcion"] == "Actualizado"

    r = await client.get(
        MENU_URL,
        params={"comedor_id": comedor_id, "semana": semana.isoformat()},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_publicar_menu_consolida_duplicados_legacy(client: AsyncClient, db):
    """Importaciones previas sin upsert pudieron dejar filas duplicadas."""
    from app.models.comedor import MenuSemanal

    rh = await make_empleado(db, rol="rh", email="rh_menu_dup@test.leoni", password="RhDup3!")
    hdrs = await auth_headers(client, rh, password="RhDup3!")
    comedor_id = await _crear_comedor(client, hdrs)
    semana = date(2026, 6, 1)

    for desc in ("Registro duplicado 1", "Registro duplicado 2"):
        db.add(
            MenuSemanal(
                comedor_id=comedor_id,
                semana=semana,
                dia="lunes",
                tipo="normal",
                descripcion=desc,
                created_by=rh.id,
            )
        )
    await db.commit()

    r = await client.post(
        MENU_URL,
        json={
            "comedor_id": comedor_id,
            "semana": semana.isoformat(),
            "dia": "lunes",
            "tipo": "normal",
            "descripcion": "Menú consolidado",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text

    listed = await client.get(
        MENU_URL,
        params={"comedor_id": comedor_id, "semana": semana.isoformat()},
        headers=hdrs,
    )
    assert listed.status_code == 200, listed.text
    lunes_normal = [
        item
        for item in listed.json()
        if item["tipo"] == "normal" and item["dia"].lower() == "lunes"
    ]
    assert len(lunes_normal) == 1
    assert lunes_normal[0]["descripcion"] == "Menú consolidado"


@pytest.mark.asyncio
async def test_eliminar_menu_semana(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_menu_delete@test.leoni", password="RhDel3te!")
    hdrs = await auth_headers(client, rh, password="RhDel3te!")
    comedor_id = await _crear_comedor(client, hdrs)
    semana = date(2026, 4, 6)

    for dia in ("lunes", "martes"):
        for tipo in ("normal", "dieta"):
            r = await client.post(
                MENU_URL,
                json={
                    "comedor_id": comedor_id,
                    "semana": semana.isoformat(),
                    "dia": dia,
                    "tipo": tipo,
                    "descripcion": f"{tipo} {dia}",
                },
                headers=hdrs,
            )
            assert r.status_code == 200, r.text

    r = await client.delete(
        MENU_URL,
        params={"comedor_id": comedor_id, "semana": semana.isoformat()},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted_count"] == 4
    assert body["comedor_id"] == comedor_id
    assert body["semana"] == semana.isoformat()

    listed = await client.get(
        MENU_URL,
        params={"comedor_id": comedor_id, "semana": semana.isoformat()},
        headers=hdrs,
    )
    assert listed.status_code == 200, listed.text
    assert listed.json() == []


@pytest.mark.asyncio
async def test_publicar_menu_no_rh_con_modulo_comedor(client: AsyncClient, db):
    """Usuario inscrito con módulo comedor (RH Admin) puede registrar planeación sin rol RH."""
    rh = await make_empleado(db, rol="rh", email="rh_menu_setup@test.leoni", password="RhSetUp1!")
    rh_hdrs = await auth_headers(client, rh, password="RhSetUp1!")
    comedor_id = await _crear_comedor(client, rh_hdrs)

    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_menu_planeacion@test.leoni",
        password="EmpPl4n!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor": True},
    )
    hdrs = await auth_headers(client, operador, password="EmpPl4n!")
    semana = date(2026, 5, 4)

    r = await client.post(
        MENU_URL,
        json={
            "comedor_id": comedor_id,
            "semana": semana.isoformat(),
            "dia": "lunes",
            "tipo": "normal",
            "descripcion": "Menú operador",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    assert r.json()["descripcion"] == "Menú operador"


@pytest.mark.asyncio
async def test_publicar_menu_no_rh_sin_modulo_comedor(client: AsyncClient, db):
    """Usuario sin módulo comedor no puede registrar planeación aunque esté autenticado."""
    rh = await make_empleado(db, rol="rh", email="rh_menu_deny@test.leoni", password="RhDeny1!")
    rh_hdrs = await auth_headers(client, rh, password="RhDeny1!")
    comedor_id = await _crear_comedor(client, rh_hdrs)

    empleado = await make_empleado(
        db,
        rol="empleado",
        email="emp_sin_comedor@test.leoni",
        password="EmpSin1!",
    )
    hdrs = await auth_headers(client, empleado, password="EmpSin1!")

    r = await client.post(
        MENU_URL,
        json={
            "comedor_id": comedor_id,
            "semana": date(2026, 5, 11).isoformat(),
            "dia": "martes",
            "tipo": "normal",
            "descripcion": "No permitido",
        },
        headers=hdrs,
    )
    assert r.status_code == 403, r.text
    assert "rh" not in r.json()["detail"].lower()
    assert "módulo" in r.json()["detail"].lower() or "comedor" in r.json()["detail"].lower()
