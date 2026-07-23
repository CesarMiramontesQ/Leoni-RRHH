"""Tests del Motor de Evidencias de Capacitacion."""
import pytest

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion_service import EvidenciaCapacitacionService
from tests.conftest import auth_headers, make_empleado

API_BASE = "/api/v1/level-up/evidencias"


def test_derivar_sin_firmas_es_pendiente():
    assert derivar_estado_evidencia([]) == "pendiente"


def test_derivar_alguna_rechazada_es_devuelta():
    assert derivar_estado_evidencia(["firmada", "rechazada", "pendiente"]) == "devuelta"


def test_derivar_todas_firmadas_es_validada():
    assert derivar_estado_evidencia(["firmada", "firmada"]) == "validada"


def test_derivar_hay_pendientes_es_pendiente():
    assert derivar_estado_evidencia(["firmada", "pendiente"]) == "pendiente"


def test_schemas_existen():
    req = EvidenciaCrearRequest(tipo="documento", archivo_url="http://x/y.pdf", empleado_id=10)
    assert req.firmantes == []
    assert FirmarRequest(estado="firmada").comentario is None
    assert FirmanteAsignar(firmante_id=5, rol_firma="instructor").rol_firma == "instructor"
    assert "firmas" in EvidenciaConFirmasResponse.model_fields


# ── Service: gestion (RH) ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_evidencia_con_firmantes_pendiente(db):
    emp = await make_empleado(db)
    f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="documento", archivo_url="http://x/y.pdf", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="instructor")],
    ))
    assert ev.estado == "pendiente"
    assert ev.firmas_total == 1
    assert ev.firmas_firmadas == 0
    assert ev.firmas[0].rol_firma == "instructor"


@pytest.mark.asyncio
async def test_crear_empleado_inexistente_404(db):
    svc = EvidenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=999999))


@pytest.mark.asyncio
async def test_agregar_y_quitar_firmante(db):
    emp = await make_empleado(db)
    f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    ev2 = await svc.agregar_firmante(ev.id, FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe"))
    assert ev2.firmas_total == 1
    ev3 = await svc.quitar_firmante(ev2.firmas[0].id)
    assert ev3.firmas_total == 0


@pytest.mark.asyncio
async def test_actualizar_no_cambia_estado_a_mano(db):
    emp = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    ev2 = await svc.actualizar(ev.id, EvidenciaCapacitacionUpdate(estado="validada", notas="corregido"))
    assert ev2.notas == "corregido"
    assert ev2.estado == "pendiente"  # el estado es derivado, no se setea a mano


@pytest.mark.asyncio
async def test_firmar_todas_valida_evidencia(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    firma_id = ev.firmas[0].id
    out = await svc.firmar(firma_id, f1.empleado_id, FirmarRequest(estado="firmada"))
    assert out.estado == "validada"
    assert out.firmas_firmadas == 1


@pytest.mark.asyncio
async def test_firmar_rechazo_devuelve_evidencia(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    out = await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="rechazada", comentario="ilegible"))
    assert out.estado == "devuelta"


@pytest.mark.asyncio
async def test_firmar_firma_ajena_403(db):
    emp = await make_empleado(db); f1 = await make_empleado(db); otro = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    with pytest.raises(ForbiddenError):
        await svc.firmar(ev.firmas[0].id, otro.empleado_id, FirmarRequest(estado="firmada"))


@pytest.mark.asyncio
async def test_firmar_ya_firmada_409(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="firmada"))
    with pytest.raises(ConflictError):
        await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="firmada"))


@pytest.mark.asyncio
async def test_mis_firmas_pendientes_solo_del_token(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    mias = await svc.mis_firmas_pendientes(f1.empleado_id)
    ajenas = await svc.mis_firmas_pendientes(emp.empleado_id)
    assert len(mias) == 1
    assert len(ajenas) == 0


# ── API: gestion (RH) + self-service (firma) ─────────────────────────────────


async def _crear_evidencia_api(client, headers, empleado_id, firmante_id):
    resp = await client.post(
        API_BASE,
        json={
            "tipo": "documento",
            "archivo_url": "http://x/y.pdf",
            "empleado_id": empleado_id,
            "firmantes": [{"firmante_id": firmante_id, "rol_firma": "jefe"}],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_api_listar_rh_200(client, db):
    rh = await make_empleado(db, rol="rh", email="ev_api_list@leoni.test")
    headers_rh = await auth_headers(client, rh)
    resp = await client.get(API_BASE, headers=headers_rh)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_api_gestion_sin_modulo_403(client, db):
    sin_modulo = await make_empleado(db, rol="empleado", email="ev_api_403@leoni.test")
    headers = await auth_headers(client, sin_modulo)
    resp = await client.get(API_BASE, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_api_mis_firmas_self_service(client, db):
    rh = await make_empleado(db, rol="rh", email="ev_api_ss_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_api_ss_emp@leoni.test")
    firmante = await make_empleado(db, rol="empleado", email="ev_api_ss_firm@leoni.test")
    headers_rh = await auth_headers(client, rh)
    ev = await _crear_evidencia_api(client, headers_rh, emp.empleado_id, firmante.empleado_id)
    firma_id = ev["firmas"][0]["id"]

    headers_firmante = await auth_headers(client, firmante)
    resp_mis = await client.get(f"{API_BASE}/mis-firmas", headers=headers_firmante)
    assert resp_mis.status_code == 200
    items = resp_mis.json()
    assert len(items) == 1
    assert items[0]["id"] == ev["id"]

    resp_firmar = await client.post(
        f"{API_BASE}/firmas/{firma_id}/firmar",
        json={"estado": "firmada"},
        headers=headers_firmante,
    )
    assert resp_firmar.status_code == 200, resp_firmar.text
    assert resp_firmar.json()["estado"] == "validada"


@pytest.mark.asyncio
async def test_api_firmar_ajena_403(client, db):
    rh = await make_empleado(db, rol="rh", email="ev_api_aj_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ev_api_aj_emp@leoni.test")
    firmante = await make_empleado(db, rol="empleado", email="ev_api_aj_firm@leoni.test")
    otro = await make_empleado(db, rol="empleado", email="ev_api_aj_otro@leoni.test")
    headers_rh = await auth_headers(client, rh)
    ev = await _crear_evidencia_api(client, headers_rh, emp.empleado_id, firmante.empleado_id)
    firma_id = ev["firmas"][0]["id"]

    headers_otro = await auth_headers(client, otro)
    resp = await client.post(
        f"{API_BASE}/firmas/{firma_id}/firmar",
        json={"estado": "firmada"},
        headers=headers_otro,
    )
    assert resp.status_code == 403
