"""Fuente TRESS y endpoint RH de descansos por empleado."""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import auth_headers, make_empleado


def test_sql_turnos_por_fecha_usa_funcion_kardex_sin_ddl():
    from app.repositories.datos_analisis_descansos_repository import (
        load_turnos_por_fecha_sql,
    )

    sql = load_turnos_por_fecha_sql()
    parsed = text(sql)

    assert set(parsed._bindparams) == {"cb_codigo", "fecha_inicio", "fecha_fin"}
    assert "SP_KARDEX_CB_TURNO" in sql
    assert "CREATE " not in sql.upper()
    assert "ALTER " not in sql.upper()
    assert "DROP " not in sql.upper()


def test_sql_ausencias_estatus_es_override_sin_filtrar_solo_status_2():
    from app.repositories.datos_analisis_descansos_repository import (
        load_ausencias_estatus_rango_sql,
    )

    sql = load_ausencias_estatus_rango_sql()
    parsed = text(sql)

    assert set(parsed._bindparams) == {"cb_codigo", "fecha_inicio", "fecha_fin"}
    assert "FROM dbo.AUSENCIA" in sql
    assert "AU_STATUS" in sql
    assert "AU_STATUS = 2" not in sql
    assert "DATEADD" not in sql.upper()


def test_sql_turno_y_horario_parametrizados():
    from app.repositories.datos_analisis_descansos_repository import (
        load_horario_por_codigo_sql,
        load_turno_por_codigo_sql,
    )

    turno_sql = load_turno_por_codigo_sql()
    horario_sql = load_horario_por_codigo_sql()

    assert set(text(turno_sql)._bindparams) == {"tu_codigo"}
    assert "FROM dbo.TURNO" in turno_sql
    assert set(text(horario_sql)._bindparams) == {"ho_codigo"}
    assert "FROM dbo.HORARIO" in horario_sql


@pytest.mark.asyncio
async def test_repositorio_proyecta_sin_ausencia_y_override_gana(monkeypatch):
    from app.repositories.datos_analisis_descansos_repository import (
        DatosAnalisisDescansosRepository,
    )
    from app.utils.turno_calendario import TurnoTress

    repo = DatosAnalisisDescansosRepository(engine=AsyncMock())
    turno = TurnoTress(
        codigo="G11",
        rit_pat="2:001,2:001",
        rit_ini=date(2026, 7, 1),
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("", "", "", "", "", "", ""),
    )

    async def fake_turnos(**kwargs):  # noqa: ANN003
        return {
            date(2026, 7, 1): "G11",
            date(2026, 7, 2): "G11",
            date(2026, 7, 3): "G11",
        }

    async def fake_ausencias_vacio(**kwargs):  # noqa: ANN003
        return {}

    async def fake_ausencias_override(**kwargs):  # noqa: ANN003
        return {date(2026, 7, 1): 2, date(2026, 7, 3): 0}

    async def fake_get_turno(codigo: str):
        assert codigo == "G11"
        return turno

    async def fake_get_horario(codigo: str):
        return None

    monkeypatch.setattr(repo, "list_turnos_por_fecha", fake_turnos)
    monkeypatch.setattr(repo, "get_turno", fake_get_turno)
    monkeypatch.setattr(repo, "get_horario", fake_get_horario)

    monkeypatch.setattr(repo, "list_ausencias_estatus", fake_ausencias_vacio)
    sin_ausencia = await repo.list_descansos(
        cb_codigo=4005,
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 3),
    )
    assert sin_ausencia == [date(2026, 7, 3)]

    monkeypatch.setattr(repo, "list_ausencias_estatus", fake_ausencias_override)
    con_override = await repo.list_descansos(
        cb_codigo=4005,
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 3),
    )
    assert con_override == [date(2026, 7, 1)]


@pytest.mark.asyncio
async def test_servicio_valida_orden_y_limite_de_366_dias(db):
    from app.core.exceptions import DomainValidationError
    from app.services.descansos_empleado_service import DescansosEmpleadoService

    service = DescansosEmpleadoService(db)

    with pytest.raises(DomainValidationError, match="posterior"):
        await service.obtener_descansos(
            empleado_id=1,
            fecha_inicio=date(2026, 7, 2),
            fecha_fin=date(2026, 7, 1),
        )

    with pytest.raises(DomainValidationError, match="366"):
        await service.obtener_descansos(
            empleado_id=1,
            fecha_inicio=date(2025, 1, 1),
            fecha_fin=date(2026, 1, 2),
        )


@pytest.mark.asyncio
async def test_endpoint_descansos_rh_resuelve_no_empleado_y_ordena(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", email="descansos-rh@test")
    empleado = await make_empleado(db, rol="empleado", email="descansos-emp@test")
    recibido = {}

    async def fake_obtener(*, cb_codigo, fecha_inicio, fecha_fin):  # noqa: ANN001
        recibido.update(
            cb_codigo=cb_codigo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        return [date(2026, 7, 20), date(2026, 7, 18)]

    monkeypatch.setattr(
        "app.services.descansos_empleado_service.obtener_descansos_tress",
        fake_obtener,
    )

    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert response.status_code == 200
    assert recibido == {
        "cb_codigo": empleado.no_empleado,
        "fecha_inicio": date(2026, 7, 1),
        "fecha_fin": date(2026, 7, 31),
    }
    assert response.json() == {
        "empleado_id": empleado.id,
        "no_empleado": empleado.no_empleado,
        "fecha_inicio": "2026-07-01",
        "fecha_fin": "2026-07-31",
        "descansos": ["2026-07-18", "2026-07-20"],
    }


@pytest.mark.asyncio
async def test_endpoint_descansos_requiere_rh(client: AsyncClient, db):
    solicitante = await make_empleado(db, rol="empleado", email="descansos-no-rh@test")
    empleado = await make_empleado(db, rol="empleado", email="descansos-objetivo@test")

    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, solicitante),
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_endpoint_descansos_permite_supervisor(client: AsyncClient, db, monkeypatch):
    supervisor = await make_empleado(db, rol="supervisor", email="descansos-sup@test")
    empleado = await make_empleado(db, rol="empleado", email="descansos-sup-obj@test")
    empleado.no_empleado = 9001
    await db.commit()

    async def _fake_descansos(*, cb_codigo: int, fecha_inicio, fecha_fin):
        assert cb_codigo == 9001
        return [fecha_inicio]

    monkeypatch.setattr(
        "app.services.descansos_empleado_service.obtener_descansos_tress",
        _fake_descansos,
    )

    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, supervisor),
    )

    assert response.status_code == 200
    assert response.json()["descansos"] == ["2026-07-01"]


@pytest.mark.asyncio
async def test_endpoint_descansos_rechaza_rango_mayor_a_366_dias(
    client: AsyncClient, db
):
    rh = await make_empleado(db, rol="rh", email="descansos-rango-rh@test")
    empleado = await make_empleado(db, rol="empleado", email="descansos-rango-emp@test")

    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/descansos",
        params={"fecha_inicio": "2025-01-01", "fecha_fin": "2026-01-02"},
        headers=await auth_headers(client, rh),
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_endpoint_descansos_empleado_inexistente_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="descansos-404-rh@test")

    response = await client.get(
        "/api/v1/empleados/99999999/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_endpoint_descansos_datos_analisis_caido_devuelve_503_sin_secretos(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", email="descansos-503-rh@test")
    empleado = await make_empleado(db, rol="empleado", email="descansos-503-emp@test")
    secreto = "password=super-secreta;server=interno"

    def fake_create_read_engine():
        raise RuntimeError(secreto)

    monkeypatch.setattr(
        "app.services.descansos_empleado_service.DatosAnalisisReadClient.create_read_engine",
        fake_create_read_engine,
    )

    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "No se pudieron consultar los descansos."
    assert secreto not in response.text
