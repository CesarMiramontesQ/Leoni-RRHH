"""Aprobación de home office con INSERT síncrono a TRESS (dbo.PERMISO)."""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.exceptions import ConflictError, ServiceUnavailableError
from app.repositories.datos_analisis_home_office_write_repository import (
    InsertarHomeOfficeResult,
    _render_insertar_home_office_sql,
)
from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION_PAYLOAD = {
    "accion": "approve",
    "nivel": 1,
    "comentario": "Aprobado por supervisor",
}


def test_render_sql_home_office_sustituye_placeholders():
    sql = _render_insertar_home_office_sql(
        empleado=12345,
        usuario="49",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin_mostrar=date(2026, 7, 20),
        confirmar=True,
    )
    assert "{{" not in sql
    assert "12345" in sql
    assert "49" in sql
    assert "'2026-07-20'" in sql
    assert "HOME OFFICE" in sql
    assert "INSERT INTO dbo.PERMISO" in sql


def test_render_sql_home_office_rechaza_usuario_invalido():
    with pytest.raises(ValueError, match="usuario"):
        _render_insertar_home_office_sql(
            empleado=1,
            usuario="49'; DROP TABLE",
            fecha_inicio=date(2026, 7, 20),
            fecha_fin_mostrar=date(2026, 7, 20),
            confirmar=True,
        )


@pytest.mark.asyncio
async def test_aprobar_home_office_ok_llama_tress_y_aprueba(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock(
        return_value=InsertarHomeOfficeResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=88
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        registrar,
    )
    encolar = AsyncMock()
    monkeypatch.setattr(
        "app.services.solicitud_service.encolar_tress",
        encolar,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="ho_tress_ok_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="ho_tress_ok_sub@test",
        lider_id=supervisor.empleado_id,
        no_empleado=55502,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 20),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["estado"] == "approved"
    registrar.assert_awaited_once()
    kwargs = registrar.await_args.kwargs
    assert kwargs["no_empleado"] == 55502
    assert kwargs["fecha_inicio"] == date(2026, 7, 20)
    assert kwargs["fecha_fin"] == date(2026, 7, 20)
    encolar.assert_not_awaited()


@pytest.mark.asyncio
async def test_aprobar_home_office_falla_tress_queda_pending(client: AsyncClient, db, monkeypatch):
    async def _fail(**kwargs):  # noqa: ANN003
        raise ConflictError(detail="Ya existe un permiso para el empleado en ese rango.")

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        _fail,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(
        "app.utils.audit_logger._log_action_background",
        audit_mock,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="ho_tress_fail_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="ho_tress_fail_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 20),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 409
    assert "permiso" in res.json()["detail"].lower()

    await db.refresh(solicitud)
    assert solicitud.estado == "pending"

    failed_calls = [
        c for c in audit_mock.await_args_list
        if c.kwargs.get("accion") == "TRESS_HOME_OFFICE_INSERT_FAILED"
    ]
    assert len(failed_calls) == 1
    assert failed_calls[0].kwargs["entidad_id"] == solicitud.id


@pytest.mark.asyncio
async def test_aprobar_home_office_ok_registra_audit_tress(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock(
        return_value=InsertarHomeOfficeResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=66
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        registrar,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(
        "app.utils.audit_logger._log_action_background",
        audit_mock,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="ho_tress_audit_ok_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="ho_tress_audit_ok_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 20),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 200

    ok_calls = [
        c for c in audit_mock.await_args_list
        if c.kwargs.get("accion") == "TRESS_HOME_OFFICE_INSERT_OK"
    ]
    assert len(ok_calls) == 1
    assert ok_calls[0].kwargs["datos_despues"]["nueva_llave"] == 66
    assert ok_calls[0].kwargs["entidad_id"] == solicitud.id


@pytest.mark.asyncio
async def test_aprobar_home_office_tress_caido_503(client: AsyncClient, db, monkeypatch):
    async def _fail(**kwargs):  # noqa: ANN003
        raise ServiceUnavailableError(detail="Error al registrar home office en TRESS.")

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        _fail,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="ho_tress_503_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="ho_tress_503_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 20),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 503
    await db.refresh(solicitud)
    assert solicitud.estado == "pending"


@pytest.mark.asyncio
async def test_aprobar_home_office_dry_run_no_aprueba(client: AsyncClient, db, monkeypatch):
    from app.services import tress_home_office_service as svc

    class FakeRepo:
        async def insertar_home_office(self, **kwargs):  # noqa: ANN003
            return InsertarHomeOfficeResult(
                ok=True,
                codigo_error=None,
                mensaje="Dry-run OK",
                nueva_llave=None,
            )

    class FakeEngine:
        async def dispose(self):
            return None

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(lambda: FakeEngine()),
    )
    monkeypatch.setattr(
        svc,
        "DatosAnalisisHomeOfficeWriteRepository",
        lambda engine: FakeRepo(),
    )
    monkeypatch.setattr(svc.settings, "TRESS_HOME_OFFICE_DRY_RUN", True)

    # Usar el servicio real (sin mockear en solicitud_service) vía monkeypatch del engine
    async def _real_registrar(**kwargs):  # noqa: ANN003
        return await svc.registrar_home_office_en_tress(**kwargs)

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        _real_registrar,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="ho_tress_dry_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="ho_tress_dry_sub@test",
        lider_id=supervisor.empleado_id,
        no_empleado=55503,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 20),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 409
    assert "dry-run" in res.json()["detail"].lower()
    await db.refresh(solicitud)
    assert solicitud.estado == "pending"


@pytest.mark.asyncio
async def test_map_fallo_traslape_permiso(monkeypatch):
    from app.services import tress_home_office_service as svc

    class FakeRepo:
        async def insertar_home_office(self, **kwargs):  # noqa: ANN003
            return InsertarHomeOfficeResult(
                ok=False,
                codigo_error="TRASLAPE_PERMISO",
                mensaje="Ya existe un permiso",
                nueva_llave=None,
            )

    class FakeEngine:
        async def dispose(self):
            return None

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(lambda: FakeEngine()),
    )
    monkeypatch.setattr(
        svc,
        "DatosAnalisisHomeOfficeWriteRepository",
        lambda engine: FakeRepo(),
    )
    monkeypatch.setattr(svc.settings, "TRESS_HOME_OFFICE_DRY_RUN", False)

    with pytest.raises(svc.ConflictError, match="permiso"):
        await svc.registrar_home_office_en_tress(
            no_empleado=1,
            fecha_inicio=date(2026, 7, 20),
            fecha_fin=date(2026, 7, 20),
        )
