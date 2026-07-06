"""Tests del modulo de Capacitacion de Personal Externo (Cursos).

Cubren: CRUD de proveedores + personas, catalogo de cursos externos, registro de
cursos con calculo de vencimiento, derivacion de estado (vigente/por_vencer/
vencido/sin_vencimiento), historico (ultimo por persona/curso), el helper
add_months y el control de acceso por rol.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import update

from app.models.proveedores_externos import ProveedorPersonaCurso
from app.services.proveedor_externo_service import add_months
from tests.conftest import auth_headers, make_empleado

BASE = "/api/v1/proveedores-externos"


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _crear_proveedor(client, headers, nombre="Constructora Acme"):
    res = await client.post(
        f"{BASE}/proveedores", json={"nombre": nombre}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _crear_persona(client, headers, proveedor_id, nombre="Juan Perez"):
    res = await client.post(
        f"{BASE}/proveedores/{proveedor_id}/personas",
        json={"nombre": nombre, "identificacion": "INE-123", "puesto": "Soldador"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _crear_curso(client, headers, nombre="Seguridad", vigencia_meses=12):
    res = await client.post(
        f"{BASE}/cursos-externos",
        json={"nombre": nombre, "vigencia_meses": vigencia_meses},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _registrar(client, headers, persona_id, curso_id, fecha_realizado):
    res = await client.post(
        f"{BASE}/registros",
        json={
            "persona_id": persona_id,
            "curso_externo_id": curso_id,
            "fecha_realizado": fecha_realizado.isoformat(),
        },
        headers=headers,
    )
    return res


# ── Proveedores + personas ────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_crear_proveedor(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_prov@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    assert prov["nombre"] == "Constructora Acme"
    assert prov["personas_count"] == 0
    assert prov["activo"] is True


@pytest.mark.asyncio
async def test_agregar_persona_aparece_en_detalle(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_pers@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"], nombre="Ana Torres")
    assert persona["proveedor_id"] == prov["id"]

    res = await client.get(f"{BASE}/proveedores/{prov['id']}", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["personas_count"] == 1
    assert [p["nombre"] for p in body["personas"]] == ["Ana Torres"]


# ── Cursos externos ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_quitar_persona_no_aparece_en_detalle(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_delpers@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    r1 = await client.post(
        f"{BASE}/proveedores/{prov['id']}/personas",
        json={"nombre": "Persona Uno", "identificacion": "INE-1"},
        headers=headers,
    )
    await client.post(
        f"{BASE}/proveedores/{prov['id']}/personas",
        json={"nombre": "Persona Dos", "identificacion": "INE-2"},
        headers=headers,
    )
    p1 = r1.json()

    res = await client.delete(f"{BASE}/personas/{p1['id']}", headers=headers)
    assert res.status_code == 204, res.text

    detalle = await client.get(f"{BASE}/proveedores/{prov['id']}", headers=headers)
    body = detalle.json()
    assert body["personas_count"] == 1
    assert [p["nombre"] for p in body["personas"]] == ["Persona Dos"]

    # También desaparece del selector de personas activas.
    personas = await client.get(f"{BASE}/proveedores/{prov['id']}/personas", headers=headers)
    assert [p["id"] for p in personas.json()] == [
        p["id"] for p in body["personas"]
    ]


@pytest.mark.asyncio
async def test_crear_curso_externo_con_vigencia(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_curso@leoni.test")
    headers = await auth_headers(client, rh)

    curso = await _crear_curso(client, headers, nombre="Induccion", vigencia_meses=6)
    assert curso["nombre"] == "Induccion"
    assert curso["vigencia_meses"] == 6
    assert curso["activo"] is True


# ── Registro y calculo de vencimiento ─────────────────────────────────────────
@pytest.mark.asyncio
async def test_registrar_curso_calcula_vencimiento(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_venc@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"])
    curso = await _crear_curso(client, headers, vigencia_meses=12)

    res = await _registrar(client, headers, persona["id"], curso["id"], date(2026, 1, 15))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["fecha_vencimiento"] == "2027-01-15"
    assert body["persona_nombre"] == "Juan Perez"
    assert body["curso_nombre"] == "Seguridad"
    assert body["proveedor_nombre"] == "Constructora Acme"


@pytest.mark.asyncio
async def test_curso_sin_vigencia_no_vence(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_novence@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"])
    curso = await _crear_curso(client, headers, nombre="Politica general", vigencia_meses=None)

    res = await _registrar(client, headers, persona["id"], curso["id"], date(2026, 1, 15))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["fecha_vencimiento"] is None
    assert body["estado"] == "sin_vencimiento"
    assert body["dias_restantes"] is None


@pytest.mark.asyncio
async def test_estado_vencido(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_vencido@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"])
    curso = await _crear_curso(client, headers, vigencia_meses=12)
    reg = await _registrar(client, headers, persona["id"], curso["id"], date(2026, 1, 15))
    registro_id = reg.json()["id"]

    # Fijar el vencimiento en el pasado para validar la derivacion de estado.
    await db.execute(
        update(ProveedorPersonaCurso)
        .where(ProveedorPersonaCurso.id == registro_id)
        .values(fecha_vencimiento=date.today() - timedelta(days=5))
    )
    await db.commit()

    res = await client.get(f"{BASE}/vencimientos?estado=vencido", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["estado"] == "vencido"
    assert item["dias_restantes"] < 0


@pytest.mark.asyncio
async def test_estado_por_vencer(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_porvencer@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"])
    curso = await _crear_curso(client, headers, vigencia_meses=12)
    reg = await _registrar(client, headers, persona["id"], curso["id"], date(2026, 1, 15))
    registro_id = reg.json()["id"]

    await db.execute(
        update(ProveedorPersonaCurso)
        .where(ProveedorPersonaCurso.id == registro_id)
        .values(fecha_vencimiento=date.today() + timedelta(days=10))
    )
    await db.commit()

    res = await client.get(f"{BASE}/vencimientos?estado=por_vencer", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["estado"] == "por_vencer"


@pytest.mark.asyncio
async def test_listar_vencimientos_filtra_por_proveedor(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_filtro@leoni.test")
    headers = await auth_headers(client, rh)

    prov_a = await _crear_proveedor(client, headers, nombre="Proveedor A")
    prov_b = await _crear_proveedor(client, headers, nombre="Proveedor B")
    persona_a = await _crear_persona(client, headers, prov_a["id"], nombre="Persona A")
    persona_b = await _crear_persona(client, headers, prov_b["id"], nombre="Persona B")
    curso = await _crear_curso(client, headers, vigencia_meses=12)

    await _registrar(client, headers, persona_a["id"], curso["id"], date(2026, 1, 15))
    await _registrar(client, headers, persona_b["id"], curso["id"], date(2026, 1, 15))

    res = await client.get(
        f"{BASE}/vencimientos?proveedor_id={prov_a['id']}", headers=headers
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["proveedor_id"] == prov_a["id"]


@pytest.mark.asyncio
async def test_historico_ultimo_por_persona_curso(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_hist@leoni.test")
    headers = await auth_headers(client, rh)

    prov = await _crear_proveedor(client, headers)
    persona = await _crear_persona(client, headers, prov["id"])
    curso = await _crear_curso(client, headers, vigencia_meses=12)

    await _registrar(client, headers, persona["id"], curso["id"], date(2025, 1, 10))
    await _registrar(client, headers, persona["id"], curso["id"], date(2026, 1, 10))

    # Por defecto: solo el mas reciente.
    res = await client.get(f"{BASE}/vencimientos", headers=headers)
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["fecha_realizado"] == "2026-01-10"

    # Con historico: los dos.
    res = await client.get(f"{BASE}/vencimientos?incluir_historico=true", headers=headers)
    assert res.json()["total"] == 2


@pytest.mark.asyncio
async def test_add_months_clamp():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)  # bisiesto
    assert add_months(date(2026, 1, 15), 12) == date(2027, 1, 15)
    assert add_months(date(2026, 11, 15), 3) == date(2027, 2, 15)


# ── Errores y permisos ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_no_encontrado(client, db):
    rh = await make_empleado(db, rol="rh", email="pe_404@leoni.test")
    headers = await auth_headers(client, rh)

    res = await client.get(f"{BASE}/proveedores/99999999", headers=headers)
    assert res.status_code == 404

    # Registro con persona/curso inexistente -> 404.
    res = await client.post(
        f"{BASE}/registros",
        json={
            "persona_id": 99999999,
            "curso_externo_id": 88888888,
            "fecha_realizado": "2026-01-15",
        },
        headers=headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_sin_permisos(client, db):
    emp = await make_empleado(db, rol="empleado", email="pe_noauth@leoni.test")
    headers = await auth_headers(client, emp)

    res = await client.post(
        f"{BASE}/proveedores", json={"nombre": "Prohibido"}, headers=headers
    )
    assert res.status_code == 403

    res = await client.get(f"{BASE}/vencimientos", headers=headers)
    assert res.status_code == 403
