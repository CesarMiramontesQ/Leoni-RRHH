"""Alta de suspensión en faltas/retardos con INSERT síncrono a TRESS (dbo.PERMISO)."""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.exceptions import ConflictError
from app.repositories.datos_analisis_suspension_write_repository import (
    InsertarSuspensionResult,
    _render_insertar_suspension_sql,
)
from tests.conftest import auth_headers, make_empleado
from tests.test_faltas_retardos import _mock_bono_importadas_repo


def test_render_sql_suspension_sustituye_placeholders():
    sql = _render_insertar_suspension_sql(
        empleado=1259,
        usuario="49",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin_mostrar=date(2026, 7, 22),
        comentario="AUSENTISMO 3 DIAS",
        confirmar=True,
    )
    assert "{{" not in sql
    assert "1259" in sql
    assert "49" in sql
    assert "'2026-07-20'" in sql
    assert "'2026-07-22'" in sql
    assert "AUSENTISMO 3 DIAS" in sql
    assert "PM_CLASIFI" in sql
    assert "'SUS'" in sql
    assert "INSERT INTO dbo.PERMISO" in sql
    assert "SP_INSERTAR_BITACORA" in sql
    assert "SP_STATUS_INCIDENCIA" in sql


def test_render_sql_suspension_escapa_comilla():
    sql = _render_insertar_suspension_sql(
        empleado=1,
        usuario="49",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin_mostrar=date(2026, 7, 20),
        comentario="TEST'O",
        confirmar=False,
    )
    assert "TEST''O" in sql


def test_render_sql_suspension_rechaza_comentario_largo():
    with pytest.raises(ValueError, match="30"):
        _render_insertar_suspension_sql(
            empleado=1,
            usuario="49",
            fecha_inicio=date(2026, 7, 20),
            fecha_fin_mostrar=date(2026, 7, 20),
            comentario="A" * 31,
            confirmar=True,
        )


def test_render_sql_suspension_rechaza_usuario_invalido():
    with pytest.raises(ValueError, match="usuario"):
        _render_insertar_suspension_sql(
            empleado=1,
            usuario="49'; DROP TABLE",
            fecha_inicio=date(2026, 7, 20),
            fecha_fin_mostrar=date(2026, 7, 20),
            comentario="MOTIVO",
            confirmar=True,
        )


@pytest.mark.asyncio
async def test_create_suspension_ok_llama_tress_y_bono(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock(
        return_value=InsertarSuspensionResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=101
        )
    )
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.registrar_suspension_en_tress",
        registrar,
    )

    rh = await make_empleado(db, rol="rh", nombre="RH Susp OK", no_empleado=91001)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Susp", no_empleado=1259
    )
    headers = await auth_headers(client, rh)

    with _mock_bono_importadas_repo(
        origen_id=9101,
        tipo_codigo="SUS",
        empleado_id=empleado.empleado_id,
        no_empleado=str(empleado.no_empleado),
        fecha_evento=date(2026, 7, 20),
        insert_ids=[9101, 9102],
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "suspension",
                "fecha_evento": "2026-07-20",
                "fecha_fin": "2026-07-22",
                "observaciones": "AUSENTISMO 3 DIAS",
            },
        )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["tipo"] == "suspension"
    assert data["fecha_fin"] == "2026-07-22"
    registrar.assert_awaited_once()
    kwargs = registrar.await_args.kwargs
    assert kwargs["no_empleado"] == 1259
    assert kwargs["fecha_inicio"] == date(2026, 7, 20)
    assert kwargs["fecha_fin"] == date(2026, 7, 22)
    assert kwargs["comentario"] == "AUSENTISMO 3 DIAS"


@pytest.mark.asyncio
async def test_create_suspension_falla_tress_no_escribe_bono(
    client: AsyncClient, db, monkeypatch
):
    async def _fail(**kwargs):  # noqa: ANN003
        raise ConflictError(detail="Ya existe un permiso para el empleado en ese rango.")

    monkeypatch.setattr(
        "app.services.faltas_retardos_service.registrar_suspension_en_tress",
        _fail,
    )
    insert_bono = AsyncMock()
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.FaltasRetardosService._insertar_en_importadas_historico",
        insert_bono,
    )

    rh = await make_empleado(db, rol="rh", nombre="RH Susp Fail", no_empleado=91002)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Susp Fail", no_empleado=1260
    )
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "suspension",
            "fecha_evento": "2026-07-20",
            "fecha_fin": "2026-07-22",
            "observaciones": "TRASLAPE",
        },
    )
    assert res.status_code == 409
    assert "permiso" in res.json()["detail"].lower()
    insert_bono.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_suspension_observaciones_obligatorias(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Susp Val", no_empleado=91003)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Val", no_empleado=1261)
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "suspension",
            "fecha_evento": "2026-07-20",
            "fecha_fin": "2026-07-22",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_suspension_observaciones_max_30(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Susp Len", no_empleado=91004)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Len", no_empleado=1262)
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "suspension",
            "fecha_evento": "2026-07-20",
            "fecha_fin": "2026-07-22",
            "observaciones": "A" * 31,
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_retardo_no_llama_tress(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock()
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.registrar_suspension_en_tress",
        registrar,
    )
    rh = await make_empleado(db, rol="rh", nombre="RH Retardo", no_empleado=91005)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Ret", no_empleado=1263)
    headers = await auth_headers(client, rh)

    with _mock_bono_importadas_repo(
        origen_id=9201,
        tipo_codigo="RE",
        empleado_id=empleado.empleado_id,
        no_empleado=str(empleado.no_empleado),
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "retardo",
                "fecha_evento": "2026-06-20",
                "observaciones": "15 min",
            },
        )
    assert res.status_code == 201, res.text
    registrar.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_suspension_dry_run_bloquea(client: AsyncClient, db, monkeypatch):
    async def _dry(**kwargs):  # noqa: ANN003
        raise ConflictError(
            detail=(
                "Modo dry-run de TRESS activo: la suspensión se validó pero no se "
                "persistió. Desactiva TRESS_SUSPENSION_DRY_RUN para registrar."
            )
        )

    monkeypatch.setattr(
        "app.services.faltas_retardos_service.registrar_suspension_en_tress",
        _dry,
    )
    rh = await make_empleado(db, rol="rh", nombre="RH Dry", no_empleado=91006)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Dry", no_empleado=1264)
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "suspension",
            "fecha_evento": "2026-07-20",
            "fecha_fin": "2026-07-22",
            "observaciones": "DRY RUN TEST",
        },
    )
    assert res.status_code == 409
    assert "dry-run" in res.json()["detail"].lower()
