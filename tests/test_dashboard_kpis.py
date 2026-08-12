"""KPIs de nómina del dashboard (`GET /api/v1/dashboard/mis-kpis`).

Vacaciones y home office salen de sus cachés en Bono (`levelup_vacaciones_disponibles` y
`levelup_homeoffice_tomados`): los tests siembran las filas reales, sin mocks, porque el
endpoint ya no consulta datos-analisis para nada.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_vacaciones_repository import load_kpis_ciclo_sql
from app.services.sync_homeoffice_tomados_service import sincronizar_homeoffice_tomados
from tests.conftest import (
    auth_headers,
    make_empleado,
    make_homeoffice_tomados,
    make_incidencia_tress,
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


async def _sembrar_retardo(db, emp, *, origen_id: int, fecha: date, tipo: str = "retardo"):
    """Fila de la caché de incidencias tal como la escribiría el sync semanal.

    `empleado_id` va poblado a propósito: `_filtros` descarta las filas sin él, y un
    empleado que está viendo su propio dashboard existe en Bono por definición.
    """
    return await make_incidencia_tress(
        db,
        origen_id=origen_id,
        no_empleado=emp.no_empleado,
        empleado_id=emp.id,
        tipo=tipo,
        fecha_evento=fecha,
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
async def test_sync_sin_anio_alimenta_el_dashboard_del_anio_en_curso(
    client: AsyncClient, db, monkeypatch
):
    """Extremo a extremo: el sync corrido sin `anio` (como lo dispara el job de las 06:00,
    la aprobación de una solicitud o el CLI sin --anio) debe escribir en el mismo año que
    lee el dashboard (`hoy.year`). Es la única prueba de la rama que ejercita el camino
    completo escritor → lector; si un día se desalinean los años, es la que lo detecta.

    No siembra `levelup_homeoffice_tomados`: nace de `sincronizar_homeoffice_tomados`
    contra datos-analisis simulada, igual que en `test_sync_homeoffice_tomados.py`.
    `make_empleado` ya siembra `levelup_vacaciones_disponibles` (vía `saldo_vacaciones`
    por defecto), que el endpoint necesita para no degradar.
    """
    emp = await make_empleado(db, rol="empleado", email="kpis-sync-e2e@test")

    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    repo.get_dias_por_empleado = AsyncMock(return_value={emp.no_empleado: Decimal("5")})
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisHomeOfficeReadRepository",
        lambda _engine: repo,
    )

    await sincronizar_homeoffice_tomados(db, no_empleado=emp.no_empleado, origen="manual")

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is True
    assert body["home_office_dias_anio"] == 5
    assert body["anio"] == date.today().year


# ─────────────────────────── retardos ───────────────────────────


@pytest.mark.asyncio
async def test_cuenta_solo_los_retardos_del_anio_en_curso(client: AsyncClient, db):
    """El conteo se acota por tipo y por año: ni una falta ni un retardo viejo suman."""
    emp = await make_empleado(db, rol="empleado", email="kpis-ret@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    hoy = date.today()

    await _sembrar_retardo(db, emp, origen_id=1, fecha=date(hoy.year, 1, 15))
    await _sembrar_retardo(db, emp, origen_id=2, fecha=date(hoy.year, 2, 3))
    await _sembrar_retardo(db, emp, origen_id=3, fecha=date(hoy.year - 1, 12, 20))
    await _sembrar_retardo(
        db, emp, origen_id=4, fecha=date(hoy.year, 3, 1), tipo="falta_injustificada"
    )

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["retardos_anio"] == 2


@pytest.mark.asyncio
async def test_sin_retardos_devuelve_cero(client: AsyncClient, db):
    """Sin filas en la caché el empleado no tuvo retardos; es un dato, no una ausencia."""
    emp = await make_empleado(db, rol="empleado", email="kpis-ret-cero@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["retardos_anio"] == 0


@pytest.mark.asyncio
async def test_no_cuenta_los_retardos_de_otro_empleado(client: AsyncClient, db):
    """El filtro va por el `no_empleado` del token, no por toda la caché."""
    emp = await make_empleado(db, rol="empleado", email="kpis-ret-mio@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    otro = await make_empleado(db, rol="empleado", email="kpis-ret-otro@test")
    hoy = date.today()

    await _sembrar_retardo(db, emp, origen_id=11, fecha=date(hoy.year, 4, 2))
    await _sembrar_retardo(db, otro, origen_id=12, fecha=date(hoy.year, 4, 3))
    await _sembrar_retardo(db, otro, origen_id=13, fecha=date(hoy.year, 4, 4))

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["retardos_anio"] == 1


@pytest.mark.asyncio
async def test_si_falla_la_lectura_de_retardos_degrada_a_none(
    client: AsyncClient, db, monkeypatch
):
    """Mismo criterio que home office: el dashboard se sirve igual, con «—» en la tarjeta."""
    def _falla(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.services.dashboard_kpis_service.IncidenciasTressCacheRepository.count",
        _falla,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-ret-falla@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    res = await client.get(URL, headers=await auth_headers(client, emp))
    assert res.status_code == 200
    body = res.json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["retardos_anio"] is None


@pytest.mark.asyncio
async def test_retardos_llegan_aunque_no_haya_fila_de_vacaciones(
    client: AsyncClient, db
):
    """Un ingreso reciente sin sincronizar no pierde el conteo: `retardos_anio` no
    depende de `disponible`, que describe solo el bloque de vacaciones."""
    emp = await make_empleado(
        db, rol="empleado", email="kpis-ret-nosync@test", saldo_vacaciones=None
    )
    await _sembrar_retardo(db, emp, origen_id=21, fecha=date(date.today().year, 5, 6))

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is False
    assert body["vacaciones_disponibles"] is None
    assert body["retardos_anio"] == 1


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
