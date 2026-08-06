"""Listado de incidencias leído desde datos-analisis (TRESS).

La tabla de la página "Incidencias" (módulo `faltas-retardos`) se alimenta de
`dbo.AUSENCIA` + `dbo.PERMISO`. Aquí se mockea el motor de SQL Server con el
patrón de `tests/test_dashboard_kpis.py`, pero los empleados y los eventos
locales son reales (SQLite) para ejercitar el mapeo y el enriquecimiento.
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.repositories.datos_analisis_faltas_retardos_repository import (
    DatosAnalisisFaltasRetardosRepository,
    cb_codigos_a_csv,
    load_faltas_retardos_datos_analisis_sql,
)
from tests.conftest import auth_headers, make_empleado


def _fila(
    *,
    origen="ausencia",
    origen_id=1,
    no_empleado=1000,
    tipo="falta_injustificada",
    fecha_evento=date(2026, 7, 1),
    fecha_fin=None,
    observaciones=None,
    fecha_registro=None,
):
    return {
        "origen": origen,
        "origen_id": origen_id,
        "no_empleado": no_empleado,
        "tipo": tipo,
        "fecha_evento": fecha_evento,
        "fecha_fin": fecha_fin,
        "observaciones": observaciones,
        "fecha_registro": fecha_registro,
    }


def _mock_tress(monkeypatch, *, rows=None, total=None, claves=None):
    """Sustituye el motor y el repositorio de datos-analisis. Devuelve el repo."""
    rows = rows if rows is not None else []
    engine = MagicMock()
    engine.dispose = AsyncMock()
    repo = MagicMock()
    repo.count = AsyncMock(return_value=total if total is not None else len(rows))
    repo.list_offset = AsyncMock(return_value=rows)
    repo.list_claves_permisos_goce = AsyncMock(return_value=claves or set())
    repo.aggregate_por_tipo = AsyncMock(return_value={})
    repo.aggregate_por_mes = AsyncMock(return_value=[])
    repo.aggregate_empleados_top = AsyncMock(return_value=[])
    repo.aggregate_por_periodo_y_tipo = AsyncMock(return_value=[])
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisFaltasRetardosRepository",
        lambda _engine: repo,
    )
    return repo, engine


# ---------------------------------------------------------------------------
# SQL (sin BD)
# ---------------------------------------------------------------------------


def test_sql_base_tiene_exactamente_tres_binds():
    """Un ':token' en un comentario se volvería bind y rompería la consulta."""
    parsed = text(load_faltas_retardos_datos_analisis_sql())
    assert set(parsed._bindparams.keys()) == {"fecha_inicio", "fecha_fin", "cb_codigos_csv"}


def test_sql_base_no_termina_en_punto_y_coma():
    """Se envuelve como tabla derivada; un ';' lo rompería."""
    assert not load_faltas_retardos_datos_analisis_sql().rstrip().endswith(";")


def test_sql_base_cubre_las_dos_ramas():
    sql = load_faltas_retardos_datos_analisis_sql()
    assert "dbo.AUSENCIA" in sql and "dbo.PERMISO" in sql and "UNION ALL" in sql
    # Los tipos con goce se distinguen por el comentario, ignorando acentos.
    assert "Latin1_General_CI_AI" in sql


def test_cb_codigos_a_csv_ordena_y_deduplica():
    assert cb_codigos_a_csv([30, 10, 10, 20]) == "10,20,30"
    assert cb_codigos_a_csv([]) == ""
    assert cb_codigos_a_csv(None) is None


def test_repo_filtra_por_tipo_con_un_solo_bind():
    repo = DatosAnalisisFaltasRetardosRepository(MagicMock())
    assert ":tipo" in repo._filtrado()


# ---------------------------------------------------------------------------
# Listado
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_mapea_tipos_de_ausencia(client: AsyncClient, db, monkeypatch):
    rh = await make_empleado(db, rol="rh", nombre="RH DA", no_empleado=70001)
    emp = await make_empleado(db, rol="empleado", nombre="EMP DA", no_empleado=70002)
    headers = await auth_headers(client, rh)

    tipos = [
        "falta_justificada",
        "falta_injustificada",
        "retardo",
        "suspension",
        "incapacidad",
    ]
    rows = [
        _fila(origen_id=i, no_empleado=70002, tipo=t, fecha_evento=date(2026, 7, i + 1))
        for i, t in enumerate(tipos)
    ]
    _mock_tress(monkeypatch, rows=rows)

    res = await client.get("/api/v1/faltas-retardos?page_size=50", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 5
    assert {i["tipo"] for i in body["items"]} == set(tipos)
    for item in body["items"]:
        assert item["empleado_id"] == emp.empleado_id
        assert item["numero_empleado"] == "70002"
        assert item["empleado_nombre"] == "EMP DA"
        assert item["origen"] == "ausencia"


@pytest.mark.asyncio
async def test_list_permiso_con_goce_es_un_renglon_con_rango(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Rango", no_empleado=70011)
    await make_empleado(db, rol="empleado", nombre="EMP Rango", no_empleado=70012)
    headers = await auth_headers(client, rh)

    _mock_tress(
        monkeypatch,
        rows=[
            _fila(
                origen="permiso",
                origen_id=31160,
                no_empleado=70012,
                tipo="paternidad",
                fecha_evento=date(2026, 6, 22),
                fecha_fin=date(2026, 6, 26),
                observaciones="PATERNIDAD",
                fecha_registro=date(2026, 6, 25),
            )
        ],
    )

    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200
    (item,) = res.json()["items"]
    assert item["tipo"] == "paternidad"
    assert item["fecha_evento"] == "2026-06-22"
    assert item["fecha_fin"] == "2026-06-26"
    assert item["observaciones"] == "PATERNIDAD"
    assert item["origen"] == "permiso"
    assert item["created_at"].startswith("2026-06-25")


@pytest.mark.asyncio
async def test_list_no_duplica_el_permiso_que_registro_el_sistema(
    client: AsyncClient, db, monkeypatch
):
    """El mismo permiso está en TRESS y en la copia local: debe salir una vez."""
    rh = await make_empleado(db, rol="rh", nombre="RH Dedupe", no_empleado=70021)
    emp = await make_empleado(db, rol="empleado", nombre="EMP Dedupe", no_empleado=70022)
    headers = await auth_headers(client, rh)

    with patch(
        "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
        new_callable=AsyncMock,
        return_value=MagicMock(ok=True, codigo_error=None, mensaje="ok", nueva_llave=1),
    ):
        create = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": emp.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-05-04",
                "fecha_fin": "2026-05-05",
                "observaciones": "Permiso matrimonio",
            },
        )
    assert create.status_code == 201, create.text

    _mock_tress(
        monkeypatch,
        rows=[
            _fila(
                origen="permiso",
                origen_id=999,
                no_empleado=70022,
                tipo="matrimonio",
                fecha_evento=date(2026, 5, 4),
                fecha_fin=date(2026, 5, 5),
                observaciones="MATRIMONIO",
            )
        ],
        claves={(70022, date(2026, 5, 4), "matrimonio")},
    )

    res = await client.get("/api/v1/faltas-retardos?page_size=50", headers=headers)
    assert res.status_code == 200
    body = res.json()
    matrimonios = [i for i in body["items"] if i["tipo"] == "matrimonio"]
    assert len(matrimonios) == 1, matrimonios
    assert body["total"] == 1
    # Gana la copia local: trae motivo y quién lo registró.
    assert matrimonios[0]["origen"] == "manual"
    assert matrimonios[0]["observaciones"] == "Permiso matrimonio"
    assert matrimonios[0]["registrado_por_id"] == rh.empleado_id


@pytest.mark.asyncio
async def test_list_incapacidad_interna_suma_al_total_sin_estar_en_tress(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Extra", no_empleado=70031)
    emp = await make_empleado(db, rol="empleado", nombre="EMP Extra", no_empleado=70032)
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": emp.empleado_id,
            "tipo": "incapacidad_interna",
            "fecha_evento": "2026-06-01",
            "fecha_fin": "2026-06-05",
            "observaciones": "Incapacidad interna RH",
        },
    )
    assert create.status_code == 201, create.text

    _mock_tress(
        monkeypatch,
        rows=[_fila(origen_id=5, no_empleado=70032, tipo="retardo")],
    )
    res = await client.get("/api/v1/faltas-retardos?page_size=50", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert {i["tipo"] for i in body["items"]} == {"retardo", "incapacidad_interna"}


@pytest.mark.asyncio
async def test_list_aplica_ventana_de_doce_meses_por_defecto(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Ventana", no_empleado=70041)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(monkeypatch)

    await client.get("/api/v1/faltas-retardos", headers=headers)
    esperado = date.today() - timedelta(days=365)
    assert repo.count.await_args.kwargs["fecha_inicio"] == esperado
    assert repo.count.await_args.kwargs["fecha_fin"] is None


@pytest.mark.asyncio
async def test_list_respeta_las_fechas_pedidas(client: AsyncClient, db, monkeypatch):
    rh = await make_empleado(db, rol="rh", nombre="RH Fechas", no_empleado=70051)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(monkeypatch)

    await client.get(
        "/api/v1/faltas-retardos?fecha_inicio=2019-01-01&fecha_fin=2019-12-31",
        headers=headers,
    )
    assert repo.count.await_args.kwargs["fecha_inicio"] == date(2019, 1, 1)
    assert repo.count.await_args.kwargs["fecha_fin"] == date(2019, 12, 31)


@pytest.mark.asyncio
async def test_list_supervisor_acota_a_su_equipo(client: AsyncClient, db, monkeypatch):
    supervisor = await make_empleado(
        db, rol="supervisor", nombre="SUP Scope", no_empleado=70061
    )
    subordinado = await make_empleado(
        db,
        rol="empleado",
        nombre="SUB Scope",
        no_empleado=70062,
        lider_id=supervisor.empleado_id,
    )
    await make_empleado(db, rol="empleado", nombre="AJENO", no_empleado=70063)
    headers = await auth_headers(client, supervisor)
    repo, _engine = _mock_tress(monkeypatch)

    await client.get("/api/v1/faltas-retardos", headers=headers)
    enviados = set(repo.count.await_args.kwargs["cb_codigos"])
    assert enviados == {70061, 70062}
    assert 70063 not in enviados
    assert subordinado.no_empleado in (70062, "70062")


@pytest.mark.asyncio
async def test_list_busqueda_sin_coincidencias_no_consulta_tress(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Busca", no_empleado=70071)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(monkeypatch)

    res = await client.get(
        "/api/v1/faltas-retardos?busqueda=NO_EXISTE_ESTE_EMPLEADO", headers=headers
    )
    assert res.status_code == 200
    assert res.json()["total"] == 0
    repo.count.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_busqueda_manda_solo_los_numeros_que_empatan(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Filtra", no_empleado=70081)
    await make_empleado(db, rol="empleado", nombre="JUANA PEREZ", no_empleado=70082)
    await make_empleado(db, rol="empleado", nombre="PEDRO LOPEZ", no_empleado=70083)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(monkeypatch)

    await client.get("/api/v1/faltas-retardos?busqueda=JUANA", headers=headers)
    assert repo.count.await_args.kwargs["cb_codigos"] == [70082]


@pytest.mark.asyncio
async def test_list_empleado_de_tress_sin_ficha_local_no_rompe(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Huerfano", no_empleado=70091)
    headers = await auth_headers(client, rh)
    _mock_tress(monkeypatch, rows=[_fila(origen_id=7, no_empleado=999999)])

    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200
    (item,) = res.json()["items"]
    assert item["empleado_id"] == 0
    assert item["numero_empleado"] == "999999"
    assert item["empleado_nombre"] is None


@pytest.mark.asyncio
async def test_list_sin_datos_analisis_configurado_devuelve_503(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH 503", no_empleado=70101)
    headers = await auth_headers(client, rh)
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )
    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_list_error_de_sql_server_devuelve_503_y_libera_el_motor(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Caido", no_empleado=70111)
    headers = await auth_headers(client, rh)
    repo, engine = _mock_tress(monkeypatch)
    repo.count = AsyncMock(side_effect=SQLAlchemyError("conexion perdida"))

    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 503
    engine.dispose.assert_awaited()


@pytest.mark.asyncio
async def test_list_pagina_del_lado_de_sql_server_cuando_no_hay_extras(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Pagina", no_empleado=70121)
    await make_empleado(db, rol="empleado", nombre="EMP Pagina", no_empleado=70122)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(
        monkeypatch,
        rows=[_fila(origen_id=1, no_empleado=70122)],
        total=57,
    )

    res = await client.get("/api/v1/faltas-retardos?page=3&page_size=10", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 57
    assert repo.list_offset.await_args.args == (20, 10)


@pytest.mark.asyncio
async def test_list_pagina_fuera_de_rango_se_normaliza(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Rango2", no_empleado=70131)
    headers = await auth_headers(client, rh)
    _mock_tress(monkeypatch, rows=[], total=5)

    res = await client.get("/api/v1/faltas-retardos?page=99&page_size=10", headers=headers)
    assert res.status_code == 200
    assert res.json()["page"] == 1


# ---------------------------------------------------------------------------
# Estadísticas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_estadisticas_leen_de_datos_analisis(client: AsyncClient, db, monkeypatch):
    rh = await make_empleado(db, rol="rh", nombre="RH Stats", no_empleado=70141)
    await make_empleado(db, rol="empleado", nombre="EMP Stats", no_empleado=70142)
    headers = await auth_headers(client, rh)
    repo, _engine = _mock_tress(monkeypatch)
    repo.aggregate_por_tipo = AsyncMock(
        return_value={
            "falta_injustificada": 7,
            "retardo": 3,
            "suspension": 1,
            "paternidad": 2,
        }
    )
    repo.aggregate_por_mes = AsyncMock(return_value=[("2026-07", 13)])
    repo.aggregate_empleados_top = AsyncMock(
        return_value=[(70142, 10, {"falta_injustificada": 7, "retardo": 3})]
    )

    res = await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_eventos"] == 13
    assert body["falta_injustificada"] == 7
    assert body["retardo"] == 3
    assert body["suspension"] == 1
    # Los tipos con goce entran en el desglose aunque no tengan tarjeta propia.
    assert {"tipo": "paternidad", "total": 2, "porcentaje": 15.4} in body["eventos_por_tipo"]
    top = body["empleados_con_mas_eventos"][0]
    assert top["no_empleado"] == "70142"
    assert top["nombre"] == "EMP Stats"


@pytest.mark.asyncio
async def test_estadisticas_incluyen_los_eventos_solo_locales(
    client: AsyncClient, db, monkeypatch
):
    """El KPI Total debe cuadrar con el total de la tabla."""
    rh = await make_empleado(db, rol="rh", nombre="RH StatsLocal", no_empleado=70151)
    emp = await make_empleado(db, rol="empleado", nombre="EMP StatsLocal", no_empleado=70152)
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": emp.empleado_id,
            "tipo": "incapacidad_interna",
            "fecha_evento": "2026-06-01",
            "fecha_fin": "2026-06-05",
        },
    )
    assert create.status_code == 201, create.text

    repo, _engine = _mock_tress(monkeypatch)
    repo.aggregate_por_tipo = AsyncMock(return_value={"retardo": 4})
    res = await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total_eventos"] == 5
    assert {"tipo": "incapacidad_interna", "total": 1, "porcentaje": 20.0} in body[
        "eventos_por_tipo"
    ]
