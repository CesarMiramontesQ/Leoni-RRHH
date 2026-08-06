"""KPIs de nómina del dashboard (`GET /api/v1/dashboard/mis-kpis`).

Las vacaciones salen de `levelup_vacaciones_disponibles` (Bono): los tests siembran la fila
real, sin mocks, para comprobar que el dashboard ya no depende de datos-analisis para ese
dato. Solo el home office sigue leyéndose de SQL Server, y ese sí se mockea.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_home_office_read_repository import (
    load_home_office_dias_sql,
)
from app.repositories.datos_analisis_vacaciones_repository import load_kpis_ciclo_sql
from app.services.dashboard_kpis_service import rango_anio_en_curso
from tests.conftest import auth_headers, make_empleado, make_vacaciones_disponibles

URL = "/api/v1/dashboard/mis-kpis"


async def _sembrar_ciclo(db, no_empleado: int):
    """Ciclo vigente típico: 24 de derecho, 16 tomados, 8 disponibles."""
    return await make_vacaciones_disponibles(
        db,
        no_empleado=no_empleado,
        dias_disponibles=8.0,
        derecho_ciclo=24.0,
        tomados_ciclo=16.0,
        aniversario=12,
        fecha_vence=date(2026, 2, 16),
    )


def _mock_home_office(monkeypatch, *, dias_ho=3):
    """Sustituye el motor y el repositorio de home office (lo único que aún va a TRESS)."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    ho_repo = AsyncMock()
    ho_repo.get_dias_en_rango = AsyncMock(return_value=dias_ho)
    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.DatosAnalisisHomeOfficeReadRepository",
        lambda _engine: ho_repo,
    )
    return ho_repo, engine


# ─────────────────────────── SQL (sin BD) ───────────────────────────


def test_sql_kpis_ciclo_expone_solo_el_bind_cb_codigo():
    """Un token ``:x`` en un comentario del .sql también lo toma SQLAlchemy como bind."""
    parsed = text(load_kpis_ciclo_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo"}


def test_sql_home_office_expone_sus_tres_binds():
    parsed = text(load_home_office_dias_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo", "desde", "hasta"}


def test_sql_home_office_filtra_solo_el_tipo_ho():
    sql = load_home_office_dias_sql()
    # PM_TIPO es char(3) con padding ('HO '), por eso el RTRIM.
    assert "RTRIM(PM_TIPO) = 'HO'" in sql
    # Se acota por fecha de inicio: PM_FEC_FIN es exclusiva en TRESS.
    assert "PM_FEC_INI >= :desde" in sql
    assert "PM_FEC_INI < :hasta" in sql


def test_rango_anio_en_curso_es_semiabierto():
    desde, hasta = rango_anio_en_curso(date(2026, 8, 3))
    assert desde == date(2026, 1, 1)
    assert hasta == date(2027, 1, 1)


# ─────────────────────────── endpoint ───────────────────────────


@pytest.mark.asyncio
async def test_devuelve_los_kpis_del_ciclo_vigente(client: AsyncClient, db, monkeypatch):
    _mock_home_office(monkeypatch)
    emp = await make_empleado(db, rol="empleado", email="kpis-emp@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["vacaciones_tomadas_ciclo"] == 16.0
    assert body["vacaciones_derecho_ciclo"] == 24.0
    assert body["ciclo_aniversario"] == 12
    assert body["ciclo_vence"] == "2026-02-16"
    assert body["home_office_dias_anio"] == 3
    assert body["anio"] == date.today().year


@pytest.mark.asyncio
async def test_las_vacaciones_no_consultan_datos_analisis(
    client: AsyncClient, db, monkeypatch
):
    """Con datos-analisis fuera de juego, las vacaciones se sirven igual desde Bono."""
    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-sin-tress@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["vacaciones_tomadas_ciclo"] == 16.0
    # Solo el home office se queda sin dato.
    assert body["home_office_dias_anio"] is None


@pytest.mark.asyncio
async def test_consulta_por_el_numero_del_usuario_autenticado(
    client: AsyncClient, db, monkeypatch
):
    """No hay `empleado_id` en la ruta: siempre se consulta el propio."""
    ho_repo, _ = _mock_home_office(monkeypatch)
    emp = await make_empleado(db, rol="empleado", email="kpis-propio@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    otro = await make_empleado(db, rol="empleado", email="kpis-otro@test")
    await make_vacaciones_disponibles(
        db, no_empleado=otro.no_empleado, dias_disponibles=99.0
    )

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200

    assert res.json()["vacaciones_disponibles"] == 8.0  # el suyo, no el de `otro`
    assert ho_repo.get_dias_en_rango.await_args.kwargs["cb_codigo"] == emp.no_empleado
    assert otro.no_empleado != emp.no_empleado


@pytest.mark.asyncio
async def test_home_office_se_pide_por_el_anio_en_curso(client: AsyncClient, db, monkeypatch):
    ho_repo, _ = _mock_home_office(monkeypatch)
    emp = await make_empleado(db, rol="empleado", email="kpis-anio@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    await client.get(URL, headers=await auth_headers(client, emp))

    kwargs = ho_repo.get_dias_en_rango.await_args.kwargs
    hoy = date.today()
    assert kwargs["desde"] == date(hoy.year, 1, 1)
    assert kwargs["hasta"] == date(hoy.year + 1, 1, 1)


@pytest.mark.asyncio
async def test_empleado_sin_periodos_en_tress(client: AsyncClient, db, monkeypatch):
    """El sync guarda saldo 0 y el resto NULL; el endpoint no debe romperse."""
    _mock_home_office(monkeypatch, dias_ho=0)
    emp = await make_empleado(db, rol="empleado", email="kpis-sinper@test")
    await make_vacaciones_disponibles(
        db, no_empleado=emp.no_empleado, dias_disponibles=0.0
    )

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 0.0
    assert body["vacaciones_tomadas_ciclo"] is None
    assert body["ciclo_aniversario"] is None
    assert body["home_office_dias_anio"] == 0


@pytest.mark.asyncio
async def test_empleado_sin_sincronizar_degrada(client: AsyncClient, db, monkeypatch):
    """Sin fila en la caché: 200 degradado (la UI pinta «—»), nunca un 0 inventado."""
    _mock_home_office(monkeypatch)
    emp = await make_empleado(
        db, rol="empleado", email="kpis-nosync@test", saldo_vacaciones=None
    )

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is False
    assert body["vacaciones_disponibles"] is None
    assert body["anio"] == date.today().year


@pytest.mark.asyncio
async def test_si_el_home_office_falla_el_dashboard_sigue_cargando(
    client: AsyncClient, db, monkeypatch
):
    """Un dashboard no puede romperse por nómina: degrada en vez de levantar 503."""
    from sqlalchemy.exc import OperationalError

    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    repo.get_dias_en_rango = AsyncMock(
        side_effect=OperationalError("stmt", {}, Exception("boom"))
    )
    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.DatosAnalisisHomeOfficeReadRepository",
        lambda _engine: repo,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-falla@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["home_office_dias_anio"] is None
    # El motor se libera aunque la consulta falle.
    engine.dispose.assert_awaited()


@pytest.mark.asyncio
async def test_es_autoservicio_para_los_tres_roles(client: AsyncClient, db, monkeypatch):
    """Empleado, supervisor y gerente consultan sus KPIs sin permisos de RH."""
    _mock_home_office(monkeypatch)
    for rol in ("empleado", "supervisor", "gerente"):
        emp = await make_empleado(db, rol=rol, email=f"kpis-{rol}@test")
        await _sembrar_ciclo(db, emp.no_empleado)
        res = await client.get(URL, headers=await auth_headers(client, emp))
        assert res.status_code == 200, f"{rol}: {res.text}"
        assert res.json()["disponible"] is True


@pytest.mark.asyncio
async def test_requiere_autenticacion(client: AsyncClient):
    assert (await client.get(URL)).status_code == 401
