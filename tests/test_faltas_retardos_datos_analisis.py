"""Listado de incidencias leído desde la caché en Bono (`levelup_incidencias_tress`).

La tabla de la página "Incidencias" (módulo `faltas-retardos`) ya no consulta
datos-analisis: lee la caché que escribe `sync_incidencias_tress_service`. Aquí la caché
y los empleados son reales (SQLite) y datos-analisis se sabotea a propósito para
comprobar que la página no lo toca.
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.services.faltas_retardos.constants import synthetic_falta_retardo_id
from tests.conftest import auth_headers, make_empleado, make_incidencia_tress


def _sabotear_datos_analisis(monkeypatch):
    """Cualquier intento de abrir datos-analisis revienta el test.

    Se parchea la clase en su módulo de origen: el servicio ya no la importa, y como el
    parche es sobre el propio atributo de clase, alcanza a cualquier módulo que la use.
    """

    def _boom():
        raise AssertionError("la página no debe consultar datos-analisis")

    monkeypatch.setattr(
        "app.integrations.datos_analisis_db.DatosAnalisisReadClient.create_read_engine",
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
async def test_empleado_sin_registro_en_bono_no_aparece(
    db, client: AsyncClient, monkeypatch
):
    """Hay CB_CODIGO en TRESS que nunca se dieron de alta en Bono: se ocultan.

    La fila sigue en la caché (el sync no la borra), pero ninguna lectura la devuelve:
    sin nombre ni ficha, RH no puede hacer nada con ella y ensucia todos los totales.
    """
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=999999, empleado_id=None,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_total_y_items_cuadran_al_ocultar_al_fantasma(
    db, client: AsyncClient, monkeypatch
):
    """El `total` de la paginación tiene que contar lo mismo que se ve en la tabla."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=2, no_empleado=999999, empleado_id=None,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert [item["numero_empleado"] for item in data["items"]] == ["553"]


@pytest.mark.asyncio
async def test_estadisticas_excluyen_al_empleado_sin_registro_en_bono(
    db, client: AsyncClient, monkeypatch
):
    """Totales, tendencia y top de empleados: ninguno cuenta al fantasma."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    for origen_id in (2, 3):
        await make_incidencia_tress(
            db, origen="ausencia", origen_id=origen_id, no_empleado=999999,
            empleado_id=None, tipo="retardo", fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos/estadisticas?tendencia_agrupacion=mes",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_eventos"] == 1
    assert data["retardo"] == 1
    assert [e["total"] for e in data["eventos_por_tipo"]] == [1]
    assert sum(e["total"] for e in data["eventos_por_mes"]) == 1
    assert sum(e["total"] for e in data["eventos_por_periodo_y_tipo"]) == 1
    assert [e["no_empleado"] for e in data["empleados_con_mas_eventos"]] == ["553"]


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


@pytest.mark.asyncio
async def test_ventana_por_defecto_excluye_dieciocho_meses_atras(
    db, client: AsyncClient, monkeypatch
):
    """VENTANA_DEFAULT_MESES sigue siendo 12: fuera de ahí no sale sin fecha explícita."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    fecha_vieja = date.today() - timedelta(days=548)  # ~18 meses
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=fecha_vieja,
    )

    resp_default = await client.get(
        "/api/v1/faltas-retardos", headers=await auth_headers(client, rh)
    )
    assert resp_default.status_code == 200
    assert resp_default.json()["total"] == 0

    resp_explicito = await client.get(
        f"/api/v1/faltas-retardos?fecha_inicio={fecha_vieja.isoformat()}",
        headers=await auth_headers(client, rh),
    )
    assert resp_explicito.status_code == 200
    assert resp_explicito.json()["total"] == 1


@pytest.mark.asyncio
async def test_pagina_fuera_de_rango_se_normaliza_a_la_ultima_con_datos(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    for i in range(1, 4):
        await make_incidencia_tress(
            db, origen="ausencia", origen_id=i, no_empleado=553, empleado_id=10,
            tipo="retardo", fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos?page=99&page_size=2", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["page"] == 2  # ceil(3 / 2)
    assert len(data["items"]) == 1


@pytest.mark.asyncio
async def test_page_size_se_topa_a_cien(db, monkeypatch):
    """El router ya rechaza page_size > 100 con 422 (`Query(..., le=100)`); el service
    también lo topa como defensa en profundidad, así que se prueba llamándolo directo."""
    from app.services.faltas_retardos_service import FaltasRetardosService

    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")

    pagina = await FaltasRetardosService(db).list_eventos(rh, page=1, page_size=500)

    assert pagina.page_size == 100


@pytest.mark.asyncio
async def test_id_sintetico_usa_el_offset_del_origen_permiso(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="permiso", origen_id=42, no_empleado=553, empleado_id=10,
        tipo="incapacidad", fecha_evento=date.today(), fecha_fin=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["id"] == synthetic_falta_retardo_id("permiso", 42)
    assert item["id"] == 6_000_000_042


@pytest.mark.asyncio
async def test_busqueda_sin_coincidencias_no_devuelve_todo(
    db, client: AsyncClient, monkeypatch
):
    """cb_codigos == [] significa "ningún empleado pasa el filtro", no "sin filtro"."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?busqueda=NO_EXISTE_ESTE_NOMBRE",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_fila_de_tress_capturada_por_rh_se_muestra_como_manual(
    db, client: AsyncClient, monkeypatch
):
    """El sync estampa registrado_por_id sobre la fila de TRESS; la UI sigue viendo "Manual"."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="permiso", origen_id=77, no_empleado=553, empleado_id=10,
        tipo="incapacidad", fecha_evento=date.today(), fecha_fin=date.today(),
        registrado_por_id=rh.empleado_id,
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["origen"] == "manual"
    # El id sigue usando el offset del origen real de la fila (permiso), no "manual".
    assert item["id"] == synthetic_falta_retardo_id("permiso", 77)


@pytest.mark.asyncio
async def test_fila_de_tress_sin_captura_local_conserva_su_origen(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="permiso", origen_id=78, no_empleado=553, empleado_id=10,
        tipo="incapacidad", fecha_evento=date.today(), fecha_fin=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=await auth_headers(client, rh))

    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["origen"] == "permiso"
