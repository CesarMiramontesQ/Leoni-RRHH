"""Tests del modulo Manejo de OPLs."""
import pytest

from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.level_up import (
    OPLConVersionesResponse,
    OPLCreate,
    OPLUpdate,
    OPLVersionAgregar,
    OPLVersionItem,
)
from app.services.opl_service import OPLService
from tests.conftest import make_empleado


def test_schemas_opl_existen():
    assert "versiones" in OPLConVersionesResponse.model_fields
    assert "version_actual" in OPLConVersionesResponse.model_fields
    assert "total_versiones" in OPLConVersionesResponse.model_fields
    assert "aprobador_nombre" in OPLConVersionesResponse.model_fields
    v = OPLVersionAgregar(archivo_url="http://x/y.pdf")
    assert v.cambios_descripcion is None
    assert "creado_por_nombre" in OPLVersionItem.model_fields


@pytest.mark.asyncio
async def test_crear_opl_borrador(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-001", titulo="Cambio de dado"))
    assert opl.estado_aprobacion == "borrador"
    assert opl.total_versiones == 0


@pytest.mark.asyncio
async def test_crear_codigo_duplicado_409(db):
    svc = OPLService(db)
    await svc.crear(OPLCreate(codigo="OPL-DUP", titulo="Aa"))
    with pytest.raises(ConflictError):
        await svc.crear(OPLCreate(codigo="OPL-DUP", titulo="Bb"))


@pytest.mark.asyncio
async def test_agregar_version_autoincrementa_y_resetea(db):
    autor = await make_empleado(db)
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-V", titulo="Aa"))
    o1 = await svc.agregar_version(opl.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id)
    o2 = await svc.agregar_version(opl.id, OPLVersionAgregar(archivo_url="http://x/2.pdf"), autor.empleado_id)
    assert o1.total_versiones == 1
    assert o2.total_versiones == 2
    assert [v.version_num for v in o2.versiones] == [2, 1]  # desc
    assert o2.version_actual.version_num == 2
    assert o2.estado_aprobacion == "borrador"


@pytest.mark.asyncio
async def test_actualizar_no_cambia_estado(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-U", titulo="Aa"))
    upd = await svc.actualizar(opl.id, OPLUpdate(titulo="Bb", estado_aprobacion="aprobada"))
    assert upd.titulo == "Bb"
    assert upd.estado_aprobacion == "borrador"  # el estado no se toca a mano


@pytest.mark.asyncio
async def test_crear_aprobador_inexistente_404(db):
    svc = OPLService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(OPLCreate(codigo="OPL-AP", titulo="Aa", aprobador_id=999999))


@pytest.mark.asyncio
async def test_eliminar(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-DEL", titulo="Aa"))
    await svc.eliminar(opl.id)
    with pytest.raises(NotFoundError):
        await svc.obtener(opl.id)


from app.core.exceptions import ForbiddenError, DomainValidationError


async def _opl_en_revision(db, aprobador_id):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo=f"OPL-{aprobador_id}-R", titulo="Aa", aprobador_id=aprobador_id))
    autor = await make_empleado(db)
    await svc.agregar_version(opl.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id)
    await svc.enviar_a_revision(opl.id)
    return svc, opl.id


@pytest.mark.asyncio
async def test_enviar_a_revision_exige_version_y_aprobador(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-NR", titulo="Aa"))  # sin aprobador ni version
    with pytest.raises(DomainValidationError):
        await svc.enviar_a_revision(opl.id)


@pytest.mark.asyncio
async def test_aprobar_solo_el_aprobador(db):
    aprob = await make_empleado(db)
    svc, opl_id = await _opl_en_revision(db, aprob.empleado_id)
    otro = await make_empleado(db)
    with pytest.raises(ForbiddenError):
        await svc.aprobar(opl_id, otro.empleado_id)
    out = await svc.aprobar(opl_id, aprob.empleado_id)
    assert out.estado_aprobacion == "aprobada"


@pytest.mark.asyncio
async def test_regresar_a_borrador(db):
    aprob = await make_empleado(db)
    svc, opl_id = await _opl_en_revision(db, aprob.empleado_id)
    out = await svc.regresar_a_borrador(opl_id, aprob.empleado_id)
    assert out.estado_aprobacion == "borrador"


@pytest.mark.asyncio
async def test_aprobar_no_en_revision_409(db):
    from app.core.exceptions import ConflictError
    svc = OPLService(db)
    aprob = await make_empleado(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-B", titulo="Aa", aprobador_id=aprob.empleado_id))
    with pytest.raises(ConflictError):
        await svc.aprobar(opl.id, aprob.empleado_id)  # esta en borrador, no revision


@pytest.mark.asyncio
async def test_mis_aprobaciones_pendientes(db):
    aprob = await make_empleado(db)
    svc, _ = await _opl_en_revision(db, aprob.empleado_id)
    mias = await svc.mis_aprobaciones_pendientes(aprob.empleado_id)
    ajenas = await svc.mis_aprobaciones_pendientes((await make_empleado(db)).empleado_id)
    assert len(mias) == 1
    assert len(ajenas) == 0


# ── Huecos de cobertura (Tarea 7) ──────────────────────────────────────────
from app.models.level_up import OPLVersion  # noqa: E402


@pytest.mark.asyncio
async def test_aprobar_y_luego_versionar_regresa_a_borrador(db):
    # Una OPL aprobada que recibe una version nueva vuelve a borrador
    # (el contenido cambio) y puede re-enviarse a revision.
    aprob = await make_empleado(db)
    svc, opl_id = await _opl_en_revision(db, aprob.empleado_id)
    aprobada = await svc.aprobar(opl_id, aprob.empleado_id)
    assert aprobada.estado_aprobacion == "aprobada"

    autor = await make_empleado(db)
    tras_version = await svc.agregar_version(
        opl_id, OPLVersionAgregar(archivo_url="http://x/2.pdf"), autor.empleado_id
    )
    assert tras_version.estado_aprobacion == "borrador"
    assert tras_version.total_versiones == 2

    reenviada = await svc.enviar_a_revision(opl_id)
    assert reenviada.estado_aprobacion == "revision"


@pytest.mark.asyncio
async def test_regresar_y_reaprobar(db):
    # revision -> regresar_a_borrador -> enviar_a_revision -> aprobar -> aprobada.
    aprob = await make_empleado(db)
    svc, opl_id = await _opl_en_revision(db, aprob.empleado_id)

    regresada = await svc.regresar_a_borrador(opl_id, aprob.empleado_id)
    assert regresada.estado_aprobacion == "borrador"

    reenviada = await svc.enviar_a_revision(opl_id)
    assert reenviada.estado_aprobacion == "revision"

    aprobada = await svc.aprobar(opl_id, aprob.empleado_id)
    assert aprobada.estado_aprobacion == "aprobada"


@pytest.mark.asyncio
async def test_eliminar_borra_versiones_en_cascada(db):
    # Al eliminar la OPL, la fila de version deja de existir en la BD.
    autor = await make_empleado(db)
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-CASCADE", titulo="Aa"))
    con_version = await svc.agregar_version(
        opl.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id
    )
    version_id = con_version.versiones[0].id
    assert await db.get(OPLVersion, version_id) is not None

    await svc.eliminar(opl.id)

    assert await db.get(OPLVersion, version_id) is None


@pytest.mark.asyncio
async def test_enviar_a_revision_desde_no_borrador_409(db):
    # Reenviar una OPL que ya esta en revision -> ConflictError.
    aprob = await make_empleado(db)
    svc, opl_id = await _opl_en_revision(db, aprob.empleado_id)
    with pytest.raises(ConflictError):
        await svc.enviar_a_revision(opl_id)


@pytest.mark.asyncio
async def test_enviar_a_revision_con_version_sin_aprobador(db):
    # Con version pero sin aprobador designado -> DomainValidationError.
    # Ejercita el branch de aprobador, que el test de "exige version y
    # aprobador" no alcanza porque ese falla antes por falta de version.
    autor = await make_empleado(db)
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-SINAP", titulo="Aa"))  # sin aprobador
    await svc.agregar_version(
        opl.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id
    )
    with pytest.raises(DomainValidationError):
        await svc.enviar_a_revision(opl.id)


@pytest.mark.asyncio
async def test_mis_aprobaciones_solo_en_revision(db):
    # Solo las OPL en 'revision' del aprobador aparecen; borrador y aprobada no.
    aprob = await make_empleado(db)
    autor = await make_empleado(db)
    svc = OPLService(db)

    # En revision (debe aparecer).
    en_rev = await svc.crear(
        OPLCreate(codigo="OPL-EST-REV", titulo="Aa", aprobador_id=aprob.empleado_id)
    )
    await svc.agregar_version(
        en_rev.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id
    )
    await svc.enviar_a_revision(en_rev.id)

    # En borrador (no debe aparecer).
    await svc.crear(
        OPLCreate(codigo="OPL-EST-BOR", titulo="Aa", aprobador_id=aprob.empleado_id)
    )

    # Aprobada (no debe aparecer).
    aprobada = await svc.crear(
        OPLCreate(codigo="OPL-EST-APR", titulo="Aa", aprobador_id=aprob.empleado_id)
    )
    await svc.agregar_version(
        aprobada.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id
    )
    await svc.enviar_a_revision(aprobada.id)
    await svc.aprobar(aprobada.id, aprob.empleado_id)

    pendientes = await svc.mis_aprobaciones_pendientes(aprob.empleado_id)
    assert [o.codigo for o in pendientes] == ["OPL-EST-REV"]


# ══════════════════════════════════════════════════════════════════════════
# Tests HTTP del router (Tarea 4): gestion RH-gated + self-service aprobador.
# ══════════════════════════════════════════════════════════════════════════
from tests.conftest import auth_headers  # noqa: E402

BASE = "/api/v1/level-up/opls"


async def _crear_opl_api(client, headers, codigo, titulo="Cambio de dado", aprobador_id=None):
    body = {"codigo": codigo, "titulo": titulo}
    if aprobador_id is not None:
        body["aprobador_id"] = aprobador_id
    resp = await client.post(BASE, json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_api_listar_rh_200(client, db):
    rh = await make_empleado(
        db, rol="rh", email="opl_rh1@leoni.test",
        modulos_rh={"opls": True}, inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    await _crear_opl_api(client, headers, "OPL-API-1")
    resp = await client.get(BASE, headers=headers)
    assert resp.status_code == 200, resp.text
    codigos = [o["codigo"] for o in resp.json()]
    assert "OPL-API-1" in codigos


@pytest.mark.asyncio
async def test_api_gestion_sin_modulo_403(client, db):
    sin_modulo = await make_empleado(db, rol="empleado", email="opl_emp1@leoni.test")
    headers = await auth_headers(client, sin_modulo)
    resp = await client.get(BASE, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_api_mis_aprobaciones_self_service(client, db):
    rh = await make_empleado(
        db, rol="rh", email="opl_rh2@leoni.test",
        modulos_rh={"opls": True}, inscrito_modulos_rh=True,
    )
    headers_rh = await auth_headers(client, rh)
    aprobador = await make_empleado(db, rol="empleado", email="opl_aprob1@leoni.test")
    headers_aprob = await auth_headers(client, aprobador)

    opl = await _crear_opl_api(
        client, headers_rh, "OPL-SS-1", aprobador_id=aprobador.empleado_id
    )
    resp_v = await client.post(
        f"{BASE}/{opl['id']}/versiones",
        json={"archivo_url": "http://x/1.pdf"}, headers=headers_rh,
    )
    assert resp_v.status_code == 200, resp_v.text
    resp_env = await client.post(f"{BASE}/{opl['id']}/enviar-a-revision", headers=headers_rh)
    assert resp_env.status_code == 200, resp_env.text

    # El aprobador (rol empleado, sin modulo de gestion) ve su pendiente...
    resp_mis = await client.get(f"{BASE}/mis-aprobaciones", headers=headers_aprob)
    assert resp_mis.status_code == 200, resp_mis.text
    ids = [o["id"] for o in resp_mis.json()]
    assert opl["id"] in ids

    # ...y puede aprobarla.
    resp_ap = await client.post(f"{BASE}/aprobaciones/{opl['id']}/aprobar", headers=headers_aprob)
    assert resp_ap.status_code == 200, resp_ap.text
    assert resp_ap.json()["estado_aprobacion"] == "aprobada"


@pytest.mark.asyncio
async def test_api_aprobar_ajena_403(client, db):
    rh = await make_empleado(
        db, rol="rh", email="opl_rh3@leoni.test",
        modulos_rh={"opls": True}, inscrito_modulos_rh=True,
    )
    headers_rh = await auth_headers(client, rh)
    aprobador = await make_empleado(db, rol="empleado", email="opl_aprob2@leoni.test")
    otro = await make_empleado(db, rol="empleado", email="opl_otro1@leoni.test")
    headers_otro = await auth_headers(client, otro)

    opl = await _crear_opl_api(
        client, headers_rh, "OPL-AJ-1", aprobador_id=aprobador.empleado_id
    )
    await client.post(
        f"{BASE}/{opl['id']}/versiones",
        json={"archivo_url": "http://x/1.pdf"}, headers=headers_rh,
    )
    await client.post(f"{BASE}/{opl['id']}/enviar-a-revision", headers=headers_rh)

    # Un empleado que no es el aprobador designado -> 403 (ForbiddenError).
    resp = await client.post(f"{BASE}/aprobaciones/{opl['id']}/aprobar", headers=headers_otro)
    assert resp.status_code == 403, resp.text
