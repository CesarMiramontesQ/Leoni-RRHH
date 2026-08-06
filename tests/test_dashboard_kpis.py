"""KPIs de nómina del dashboard (`GET /api/v1/dashboard/mis-kpis`).

Vacaciones y home office salen de sus cachés en Bono (`levelup_vacaciones_disponibles` y
`levelup_homeoffice_tomados`): los tests siembran las filas reales, sin mocks, porque el
endpoint ya no consulta datos-analisis para nada.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_vacaciones_repository import load_kpis_ciclo_sql
from tests.conftest import (
    auth_headers,
    make_empleado,
    make_homeoffice_tomados,
    make_vacaciones_disponibles,
)

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


async def _sembrar_home_office(db, no_empleado: int, dias: int = 3):
    return await make_homeoffice_tomados(
        db, no_empleado=no_empleado, anio=date.today().year, dias_tomados=dias
    )


# ─────────────────────────── SQL (sin BD) ───────────────────────────


def test_sql_kpis_ciclo_expone_solo_el_bind_cb_codigo():
    """Un token ``:x`` en un comentario del .sql también lo toma SQLAlchemy como bind."""
    parsed = text(load_kpis_ciclo_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo"}


# ─────────────────────────── endpoint ───────────────────────────


@pytest.mark.asyncio
async def test_devuelve_los_kpis_del_ciclo_vigente(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="kpis-emp@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    await _sembrar_home_office(db, emp.no_empleado)

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
async def test_ningun_kpi_consulta_datos_analisis(client: AsyncClient, db, monkeypatch):
    """Si el endpoint intentara abrir un motor a datos-analisis, este test lo delataría."""
    def _prohibido(*args, **kwargs):
        raise AssertionError("El dashboard no debe abrir conexiones a datos-analisis")

    monkeypatch.setattr(
        "app.integrations.datos_analisis_db.DatosAnalisisReadClient.create_read_engine",
        _prohibido,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-sin-tress@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    await _sembrar_home_office(db, emp.no_empleado, dias=2)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["home_office_dias_anio"] == 2


@pytest.mark.asyncio
async def test_sin_fila_de_home_office_devuelve_cero(client: AsyncClient, db):
    """Sin filas 'HO' en TRESS el empleado tomó 0 días; no es un dato ausente."""
    emp = await make_empleado(db, rol="empleado", email="kpis-ho-cero@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["home_office_dias_anio"] == 0


@pytest.mark.asyncio
async def test_consulta_por_el_numero_del_usuario_autenticado(client: AsyncClient, db):
    """No hay `empleado_id` en la ruta: siempre se consulta el propio."""
    emp = await make_empleado(db, rol="empleado", email="kpis-propio@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    await _sembrar_home_office(db, emp.no_empleado)
    otro = await make_empleado(db, rol="empleado", email="kpis-otro@test")
    await make_vacaciones_disponibles(
        db, no_empleado=otro.no_empleado, dias_disponibles=99.0
    )

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200

    assert res.json()["vacaciones_disponibles"] == 8.0  # el suyo, no el de `otro`
    assert otro.no_empleado != emp.no_empleado


@pytest.mark.asyncio
async def test_empleado_sin_periodos_en_tress(client: AsyncClient, db):
    """El sync guarda saldo 0 y el resto NULL; el endpoint no debe romperse."""
    emp = await make_empleado(db, rol="empleado", email="kpis-sinper@test")
    await make_vacaciones_disponibles(
        db, no_empleado=emp.no_empleado, dias_disponibles=0.0
    )
    await _sembrar_home_office(db, emp.no_empleado, dias=0)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 0.0
    assert body["vacaciones_tomadas_ciclo"] is None
    assert body["ciclo_aniversario"] is None
    assert body["home_office_dias_anio"] == 0


@pytest.mark.asyncio
async def test_empleado_sin_sincronizar_degrada(client: AsyncClient, db):
    """Sin fila en la caché: 200 degradado (la UI pinta «—»), nunca un 0 inventado."""
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
async def test_si_falla_la_lectura_de_home_office_degrada_a_none(
    client: AsyncClient, db, monkeypatch
):
    """Un fallo leyendo la caché de Bono no debe tumbar el dashboard: home office
    queda en `None` (dato ausente) pero las vacaciones se sirven igual."""
    def _falla(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.HomeOfficeTomadosRepository"
        ".get_by_no_empleado_anio",
        _falla,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-ho-falla@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["home_office_dias_anio"] is None


@pytest.mark.asyncio
async def test_es_autoservicio_para_los_tres_roles(client: AsyncClient, db):
    """Empleado, supervisor y gerente consultan sus KPIs sin permisos de RH."""
    for rol in ("empleado", "supervisor", "gerente"):
        emp = await make_empleado(db, rol=rol, email=f"kpis-{rol}@test")
        await _sembrar_ciclo(db, emp.no_empleado)
        await _sembrar_home_office(db, emp.no_empleado)
        res = await client.get(URL, headers=await auth_headers(client, emp))
        assert res.status_code == 200, f"{rol}: {res.text}"
        assert res.json()["disponible"] is True


@pytest.mark.asyncio
async def test_requiere_autenticacion(client: AsyncClient):
    assert (await client.get(URL)).status_code == 401
