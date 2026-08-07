"""Listado de incidencias leído desde la caché en Bono (`levelup_incidencias_tress`).

La tabla de la página "Incidencias" (módulo `faltas-retardos`) ya no consulta
datos-analisis: lee la caché que escribe `sync_incidencias_tress_service`. Aquí la caché
y los empleados son reales (SQLite) y datos-analisis se sabotea a propósito para
comprobar que la página no lo toca.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_incidencia_tress


def _sabotear_datos_analisis(monkeypatch):
    """Cualquier intento de abrir datos-analisis revienta el test."""

    def _boom():
        raise AssertionError("la página no debe consultar datos-analisis")

    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        _boom,
    )


@pytest.mark.asyncio
async def test_listado_lee_de_la_cache_sin_tocar_datos_analisis(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db,
        origen="ausencia",
        origen_id=1,
        no_empleado=553,
        empleado_id=10,
        tipo="falta_injustificada",
        fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["tipo"] == "falta_injustificada"
    assert data["items"][0]["empleado_nombre"] == "Ana"
    assert data["items"][0]["numero_empleado"] == "553"


@pytest.mark.asyncio
async def test_estadisticas_leen_de_la_cache_sin_tocar_datos_analisis(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    for i, tipo in enumerate(["retardo", "retardo", "falta_injustificada"], start=1):
        await make_incidencia_tress(
            db,
            origen="ausencia",
            origen_id=i,
            no_empleado=553,
            empleado_id=10,
            tipo=tipo,
            fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos/estadisticas", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_eventos"] == 3
    assert data["retardo"] == 2
    assert data["falta_injustificada"] == 1


@pytest.mark.asyncio
async def test_filtro_por_tipo(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=2, no_empleado=553, empleado_id=10,
        tipo="falta_injustificada", fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?tipo=retardo", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["tipo"] == "retardo"


@pytest.mark.asyncio
async def test_paginacion(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    for i in range(1, 6):
        await make_incidencia_tress(
            db, origen="ausencia", origen_id=i, no_empleado=553, empleado_id=10,
            tipo="retardo", fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos?page=2&page_size=2", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert data["page"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_busqueda_por_nombre(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana Lopez")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto Ruiz")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=2, no_empleado=554, empleado_id=11,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?busqueda=Beto", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["empleado_nombre"] == "Beto Ruiz"


@pytest.mark.asyncio
async def test_empleado_sin_registro_en_bono_se_expone_como_cero(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=999999, empleado_id=None,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["empleado_id"] == 0
    assert data["items"][0]["empleado_nombre"] is None


@pytest.mark.asyncio
async def test_permiso_con_rango_aparece_si_solapa_la_ventana(
    db, client: AsyncClient, monkeypatch
):
    """El permiso empezó antes del filtro pero sigue vigente dentro: debe salir."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="permiso", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="incapacidad", fecha_evento=date(2026, 6, 25), fecha_fin=date(2026, 7, 10),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?fecha_inicio=2026-07-01&fecha_fin=2026-07-31",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_cache_vacia_devuelve_lista_vacia_no_error(
    db, client: AsyncClient, monkeypatch
):
    """Sin sync todavía, la página muestra 0 resultados en vez de 503."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    assert resp.json()["total"] == 0
