"""Contratos del personal: listado, KPIs, CSV y Vista 360, leídos de la caché en Bono."""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_area, make_empleado, make_empleado_tress

URL = "/api/v1/contratos"
HOY = date.today()


def _d(dias: int) -> date:
    return HOY + timedelta(days=dias)


async def _sembrar(db, area=None):
    """5 activos (uno por estatus) + 1 baja con contrato vencido que no debe listarse."""
    kw = {}
    vencido = await make_empleado(db, no_empleado=880001, nombre="Ana Vencida", **kw)
    por_vencer = await make_empleado(db, no_empleado=880002, nombre="Beto Pronto")
    vigente = await make_empleado(db, no_empleado=880003, nombre="Carla Vigente")
    indefinido = await make_empleado(db, no_empleado=880004, nombre="Dani Fijo")
    sin_dato = await make_empleado(db, no_empleado=880005, nombre="Eli Sin")
    baja = await make_empleado(db, no_empleado=880006, nombre="Fer Baja", estado_id=99)
    if area is not None:
        vencido.area_id = area.area_id
        await db.flush()

    await make_empleado_tress(db, 880001, contrato_codigo="TD", contrato_descripcion="90 DIAS", contrato_dias=90, fecha_contrato=_d(-100), fecha_vencimiento_contrato=_d(-10))
    await make_empleado_tress(db, 880002, contrato_codigo="TD", contrato_descripcion="90 DIAS", contrato_dias=90, fecha_contrato=_d(-75), fecha_vencimiento_contrato=_d(15))
    await make_empleado_tress(db, 880003, contrato_codigo="TD", contrato_descripcion="90 DIAS", contrato_dias=90, fecha_contrato=_d(-10), fecha_vencimiento_contrato=_d(80))
    await make_empleado_tress(db, 880004, contrato_codigo="IN", contrato_descripcion="INDEFINIDO", contrato_dias=0, fecha_contrato=_d(-400))
    await make_empleado_tress(db, 880005, contrato_codigo="ZZ", contrato_dias=None, fecha_contrato=_d(-5))
    await make_empleado_tress(db, 880006, contrato_codigo="TD", contrato_dias=90, fecha_contrato=_d(-200), fecha_vencimiento_contrato=_d(-110))
    await db.commit()
    return vencido, por_vencer, vigente, indefinido, sin_dato, baja


def test_calcular_estatus_es_excluyente_y_respeta_ventana():
    from app.services.contratos_service import calcular_estatus

    hoy = date(2026, 8, 27)
    f = lambda dias, fv: calcular_estatus(dias, fv, hoy=hoy, ventana_dias=30)  # noqa: E731
    assert f(0, None) == "indefinido"
    assert f(0, date(2026, 9, 1)) == "indefinido"  # dias manda sobre la fecha
    assert f(None, None) == "sin_dato"
    assert f(90, None) == "sin_dato"
    assert f(90, date(2026, 8, 26)) == "vencido"
    assert f(90, date(2026, 8, 27)) == "por_vencer"  # hoy cuenta como por vencer
    assert f(90, date(2026, 9, 26)) == "por_vencer"  # hoy + 30
    assert f(90, date(2026, 9, 27)) == "vigente"


@pytest.mark.asyncio
async def test_contratos_solo_rh_o_modulo(client: AsyncClient, db, empleado_base, empleado_supervisor, empleado_gerente, empleado_director):
    for empleado in (empleado_base, empleado_supervisor, empleado_gerente, empleado_director):
        headers = await auth_headers(client, empleado)
        assert (await client.get(URL, headers=headers)).status_code == 403
        assert (await client.get(f"{URL}/kpis", headers=headers)).status_code == 403
        assert (await client.get(f"{URL}/export.csv", headers=headers)).status_code == 403

    con_modulo = await make_empleado(
        db, rol="supervisor", modulos_rh={"contratos": True}, inscrito_modulos_rh=True
    )
    headers = await auth_headers(client, con_modulo)
    headers["X-RH-UI-Mode"] = "operativo"
    assert (await client.get(URL, headers=headers)).status_code == 200


@pytest.mark.asyncio
async def test_listado_ordena_por_vencimiento_nulls_al_final_y_excluye_bajas(client: AsyncClient, db, empleado_rh):
    await _sembrar(db)
    headers = await auth_headers(client, empleado_rh)
    r = await client.get(URL, headers=headers, params={"page_size": 50})
    assert r.status_code == 200
    body = r.json()
    nos = [i["no_empleado"] for i in body["items"] if i["no_empleado"] >= 880001]
    assert nos[:3] == [880001, 880002, 880003]
    assert set(nos[3:]) == {880004, 880005}
    assert 880006 not in nos
    por_no = {i["no_empleado"]: i for i in body["items"]}
    assert por_no[880001]["estatus"] == "vencido" and por_no[880001]["dias_restantes"] == -10
    assert por_no[880002]["estatus"] == "por_vencer" and por_no[880002]["dias_restantes"] == 15
    assert por_no[880003]["estatus"] == "vigente"
    assert por_no[880004]["estatus"] == "indefinido" and por_no[880004]["dias_restantes"] is None
    assert por_no[880005]["estatus"] == "sin_dato"
    assert por_no[880002]["contrato_descripcion"] == "90 DIAS"


@pytest.mark.asyncio
async def test_filtro_estatus_y_ventana_mueven_gente_entre_por_vencer_y_vigente(client: AsyncClient, db, empleado_rh):
    await _sembrar(db)
    headers = await auth_headers(client, empleado_rh)

    r = await client.get(URL, headers=headers, params={"estatus": "por_vencer", "ventana_dias": 30})
    assert [i["no_empleado"] for i in r.json()["items"]] == [880002]

    r = await client.get(URL, headers=headers, params={"estatus": "por_vencer", "ventana_dias": 90})
    assert [i["no_empleado"] for i in r.json()["items"]] == [880002, 880003]

    r = await client.get(URL, headers=headers, params={"estatus": "vigente", "ventana_dias": 90})
    assert r.json()["total"] == 0

    r = await client.get(URL, headers=headers, params={"estatus": "invalido"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_kpis_suman_total_y_respetan_area_y_busqueda(client: AsyncClient, db, empleado_rh):
    area = await make_area(db, descripcion="Corte")
    await _sembrar(db, area=area)
    headers = await auth_headers(client, empleado_rh)

    r = await client.get(f"{URL}/kpis", headers=headers)
    k = r.json()
    assert k["vencidos"] >= 1 and k["por_vencer"] >= 1 and k["vigentes"] >= 1
    assert k["indefinidos"] >= 1 and k["sin_dato"] >= 1
    assert k["total"] == k["vencidos"] + k["por_vencer"] + k["vigentes"] + k["indefinidos"] + k["sin_dato"]

    r = await client.get(f"{URL}/kpis", headers=headers, params={"area_id": area.area_id})
    assert r.json() == {**r.json(), "vencidos": 1, "total": 1}

    r = await client.get(f"{URL}/kpis", headers=headers, params={"q": "880002"})
    assert r.json()["por_vencer"] == 1 and r.json()["total"] == 1
    r = await client.get(URL, headers=headers, params={"q": "carla"})
    assert [i["no_empleado"] for i in r.json()["items"]] == [880003]


@pytest.mark.asyncio
async def test_areas_solo_las_que_tienen_personal_activo_en_cache(client: AsyncClient, db, empleado_rh):
    area = await make_area(db, descripcion="Corte")
    vacia = await make_area(db, descripcion="Sin gente")
    await _sembrar(db, area=area)
    headers = await auth_headers(client, empleado_rh)
    r = await client.get(f"{URL}/areas", headers=headers)
    assert r.status_code == 200
    ids = {a["area_id"] for a in r.json()}
    assert area.area_id in ids and vacia.area_id not in ids


@pytest.mark.asyncio
async def test_export_csv_lleva_bom_encabezados_y_dias_negativos(client: AsyncClient, db, empleado_rh):
    await _sembrar(db)
    headers = await auth_headers(client, empleado_rh)
    r = await client.get(f"{URL}/export.csv", headers=headers, params={"estatus": "vencido"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    texto = r.content.decode("utf-8-sig")
    lineas = [l for l in texto.split("\r\n") if l]
    assert lineas[0].startswith("No. empleado,Nombre,Área,Puesto,Supervisor,Tipo,Contrato")
    fila = next(l for l in lineas if l.startswith("880001,"))
    assert ",-10,Vencido" in fila


@pytest.mark.asyncio
async def test_contrato_por_empleado_y_404_sin_cache(client: AsyncClient, db, empleado_rh):
    await _sembrar(db)
    headers = await auth_headers(client, empleado_rh)
    r = await client.get(f"{URL}/empleados/880002", headers=headers)
    assert r.status_code == 200
    assert r.json()["estatus"] == "por_vencer"
    r = await client.get(f"{URL}/empleados/999999", headers=headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_vista360_incluye_contrato_o_null(client: AsyncClient, db, empleado_rh):
    con, *_ = await _sembrar(db)
    sin_cache = await make_empleado(db, no_empleado=880010)
    await db.commit()
    headers = await auth_headers(client, empleado_rh)

    r = await client.get(f"/api/v1/empleados/{con.empleado_id}/vista360", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["contrato"]["estatus"] == "vencido"

    r = await client.get(f"/api/v1/empleados/{sin_cache.empleado_id}/vista360", headers=headers)
    assert r.status_code == 200
    assert r.json()["contrato"] is None
