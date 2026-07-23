"""Tests del Motor de Sugerencias de Capacitacion."""
from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import NotFoundError
from app.models.level_up import SugerenciaCapacitacion
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
from app.schemas.talento import BrechaItem, BrechasResponse
from app.services.sugerencia_capacitacion_service import (
    SugerenciaCapacitacionService,
    prioridad_desde_brecha,
)
from tests.conftest import auth_headers, make_empleado

BASE = "/api/v1/level-up/sugerencias"


def _brechas(*items):
    return BrechasResponse(
        area_id=1, area_nombre="Produccion",
        brechas=[
            BrechaItem(
                competencia_id=i + 1, competencia_nombre=n, categoria="tecnica",
                nivel_requerido_promedio=3.0, gap_porcentaje=g, empleados_afectados=e,
            )
            for i, (n, g, e) in enumerate(items)
        ],
    )


def test_modelo_tiene_curso_id():
    cols = set(SugerenciaCapacitacion.__table__.columns.keys())
    assert "curso_id" in cols


def test_schemas_tienen_curso_id():
    c = SugerenciaCapacitacionCreate(titulo="XX", curso_id=5)
    assert c.curso_id == 5
    assert "curso_id" in SugerenciaCapacitacionResponse.model_fields
    assert "curso_nombre" in SugerenciaCapacitacionResponse.model_fields


def test_generar_request_default_umbral_cero():
    r = GenerarDesdeBrechasRequest(area_id=1)
    assert r.umbral_brecha == 0


def test_prioridad_desde_brecha_bandas():
    assert prioridad_desde_brecha(0) == 1       # sin brecha -> mantener
    assert prioridad_desde_brecha(15) == 3      # 1-30
    assert prioridad_desde_brecha(30) == 3
    assert prioridad_desde_brecha(45) == 4      # 31-50
    assert prioridad_desde_brecha(50) == 4
    assert prioridad_desde_brecha(80) == 5      # >50


@pytest.mark.asyncio
async def test_crear_y_listar(db):
    svc = SugerenciaCapacitacionService(db)
    creada = await svc.crear(SugerenciaCapacitacionCreate(titulo="Curso A", prioridad=4))
    assert creada.id is not None
    assert creada.estado == "activa"
    todas = await svc.listar()
    assert any(s.id == creada.id for s in todas)


@pytest.mark.asyncio
async def test_listar_filtra_por_estado_y_prioridad(db):
    svc = SugerenciaCapacitacionService(db)
    await svc.crear(SugerenciaCapacitacionCreate(titulo="AA", prioridad=5))
    b = await svc.crear(SugerenciaCapacitacionCreate(titulo="BB", prioridad=2))
    await svc.actualizar(b.id, SugerenciaCapacitacionUpdate(estado="descartada"))
    activas = await svc.listar(estado="activa")
    assert all(s.estado == "activa" for s in activas)
    prio5 = await svc.listar(prioridad=5)
    assert all(s.prioridad == 5 for s in prio5)


@pytest.mark.asyncio
async def test_actualizar_cambia_estado(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="AA"))
    upd = await svc.actualizar(s.id, SugerenciaCapacitacionUpdate(estado="aprobada"))
    assert upd.estado == "aprobada"


@pytest.mark.asyncio
async def test_crear_con_curso_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(SugerenciaCapacitacionCreate(titulo="AA", curso_id=999999))


@pytest.mark.asyncio
async def test_eliminar(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="AA"))
    await svc.eliminar(s.id)
    assert all(x.id != s.id for x in await svc.listar())


@pytest.mark.asyncio
async def test_actualizar_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.actualizar(999999, SugerenciaCapacitacionUpdate(estado="aprobada"))


@pytest.mark.asyncio
async def test_generar_desde_brechas_crea_sobre_umbral(db):
    svc = SugerenciaCapacitacionService(db)
    fake = _brechas(("Soldadura", 60.0, 8), ("Calidad", 10.0, 2))
    with patch(
        "app.services.sugerencia_capacitacion_service.CompetenciaService.obtener_brechas",
        new=AsyncMock(return_value=fake),
    ):
        creadas = await svc.generar_desde_brechas(area_id=1, umbral_brecha=30)
    # Solo Soldadura (60 >= 30); Calidad (10 < 30) se ignora.
    assert len(creadas) == 1
    s = creadas[0]
    assert s.titulo == "Capacitacion: Soldadura"
    assert s.brecha_pct == 60.0
    assert s.personas_alcanzables == 8
    assert s.capacidades_afectadas == ["Soldadura"]
    assert s.areas_afectadas == ["Produccion"]
    assert s.prioridad == 5  # >50
    # No inventa datos manuales:
    assert s.duracion_sugerida is None
    assert s.inversion_estimada is None
    assert s.proveedor_sugerido is None
    assert s.adopcion_sector_pct is None
    assert s.curso_id is None
    assert s.estado == "activa"


@pytest.mark.asyncio
async def test_generar_desde_brechas_deduplica(db):
    svc = SugerenciaCapacitacionService(db)
    fake = _brechas(("Soldadura", 60.0, 8))
    with patch(
        "app.services.sugerencia_capacitacion_service.CompetenciaService.obtener_brechas",
        new=AsyncMock(return_value=fake),
    ):
        primera = await svc.generar_desde_brechas(area_id=1, umbral_brecha=0)
        segunda = await svc.generar_desde_brechas(area_id=1, umbral_brecha=0)
    assert len(primera) == 1
    assert len(segunda) == 0  # ya existe una activa con ese titulo


# ══════════════════════════════════════════════════════════════════════════
# Tests de API (router + gating por modulo 'sugerencias')
# ══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_api_listar_rh_200(client, db):
    rh = await make_empleado(db, rol="rh", email="sug_api_list@leoni.test")
    headers_rh = await auth_headers(client, rh)
    resp = await client.get(BASE, headers=headers_rh)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_api_crear_rh_200(client, db):
    rh = await make_empleado(db, rol="rh", email="sug_api_crear@leoni.test")
    headers_rh = await auth_headers(client, rh)
    resp = await client.post(
        BASE,
        json={"titulo": "Curso X", "prioridad": 4},
        headers=headers_rh,
    )
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["titulo"] == "Curso X"
    assert body["prioridad"] == 4
    assert body["estado"] == "activa"


@pytest.mark.asyncio
async def test_api_actualizar_rh_200(client, db):
    rh = await make_empleado(db, rol="rh", email="sug_api_upd@leoni.test")
    headers_rh = await auth_headers(client, rh)
    creada = await client.post(
        BASE, json={"titulo": "Curso Upd"}, headers=headers_rh
    )
    sug_id = creada.json()["id"]
    resp = await client.put(
        f"{BASE}/{sug_id}",
        json={"estado": "aprobada"},
        headers=headers_rh,
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "aprobada"


@pytest.mark.asyncio
async def test_api_eliminar_rh_204(client, db):
    rh = await make_empleado(db, rol="rh", email="sug_api_del@leoni.test")
    headers_rh = await auth_headers(client, rh)
    creada = await client.post(
        BASE, json={"titulo": "Curso Del"}, headers=headers_rh
    )
    sug_id = creada.json()["id"]
    resp = await client.delete(f"{BASE}/{sug_id}", headers=headers_rh)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_api_generar_desde_brechas_rh_200(client, db):
    rh = await make_empleado(db, rol="rh", email="sug_api_gen@leoni.test")
    headers_rh = await auth_headers(client, rh)
    fake = _brechas(("Soldadura", 60.0, 8), ("Calidad", 10.0, 2))
    with patch(
        "app.services.sugerencia_capacitacion_service.CompetenciaService.obtener_brechas",
        new=AsyncMock(return_value=fake),
    ):
        resp = await client.post(
            f"{BASE}/generar-desde-brechas",
            json={"area_id": 1, "umbral_brecha": 30},
            headers=headers_rh,
        )
    assert resp.status_code == 200
    creadas = resp.json()
    assert len(creadas) == 1
    assert creadas[0]["titulo"] == "Capacitacion: Soldadura"


@pytest.mark.asyncio
async def test_api_sin_modulo_403(client, db):
    sin_modulo = await make_empleado(db, rol="empleado", email="sug_api_403@leoni.test")
    headers_sin_modulo = await auth_headers(client, sin_modulo)
    resp = await client.get(BASE, headers=headers_sin_modulo)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_api_con_modulo_otorgado_200(client, db):
    grantee = await make_empleado(
        db,
        rol="empleado",
        email="sug_api_grantee@leoni.test",
        modulos_rh={"sugerencias": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, grantee)
    resp = await client.get(BASE, headers=headers)
    assert resp.status_code == 200
