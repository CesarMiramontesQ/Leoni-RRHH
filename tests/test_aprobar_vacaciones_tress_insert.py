"""Aprobación de vacaciones con INSERT síncrono a TRESS."""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.exceptions import ConflictError, ServiceUnavailableError
from app.repositories.datos_analisis_vacaciones_write_repository import (
    InsertarVacacionResult,
    _render_insertar_vacacion_sql,
)
from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION_PAYLOAD = {
    "accion": "approve",
    "nivel": 1,
    "comentario": "Aprobado por supervisor",
}


def test_render_sql_sustituye_placeholders():
    sql = _render_insertar_vacacion_sql(
        empleado=12345,
        usuario="49",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin_mostrar=date(2026, 7, 17),
        nom_tipo=1,
        dias_gozo=3,
        dias_pago=3,
        confirmar=True,
    )
    assert "{{" not in sql
    assert "12345" in sql
    assert "'49'" in sql
    assert "'2026-07-15'" in sql
    assert "'2026-07-17'" in sql


def test_render_sql_rechaza_usuario_invalido():
    with pytest.raises(ValueError, match="usuario"):
        _render_insertar_vacacion_sql(
            empleado=1,
            usuario="49'; DROP TABLE",
            fecha_inicio=date(2026, 7, 15),
            fecha_fin_mostrar=date(2026, 7, 17),
            nom_tipo=1,
            dias_gozo=1,
            dias_pago=1,
            confirmar=True,
        )


@pytest.mark.asyncio
async def test_aprobar_vacaciones_ok_llama_tress_y_aprueba(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock(
        return_value=InsertarVacacionResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=99
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_vacaciones_en_tress",
        registrar,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="vac_tress_ok_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="vac_tress_ok_sub@test",
        lider_id=supervisor.empleado_id,
        no_empleado=55501,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
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
    assert kwargs["no_empleado"] == 55501
    assert kwargs["fecha_inicio"] == date(2026, 7, 15)
    assert kwargs["fecha_fin"] == date(2026, 7, 17)
    assert kwargs["dias_gozo"] == 3
    assert kwargs["dias_pago"] == 3


@pytest.mark.asyncio
async def test_aprobar_vacaciones_falla_tress_queda_pending(client: AsyncClient, db, monkeypatch):
    async def _fail(**kwargs):  # noqa: ANN003
        raise ConflictError(detail="Ya existen vacaciones en TRESS que se traslapan.")

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_vacaciones_en_tress",
        _fail,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(
        "app.utils.audit_logger._log_action_background",
        audit_mock,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="vac_tress_fail_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="vac_tress_fail_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
    )

    headers = await auth_headers(client, supervisor)
    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 409
    assert "traslapan" in res.json()["detail"].lower()

    await db.refresh(solicitud)
    assert solicitud.estado == "pending"

    # BackgroundTasks de httpx/ASGI ejecutan el audit de fallo
    assert audit_mock.await_count >= 1
    failed_calls = [
        c for c in audit_mock.await_args_list
        if c.kwargs.get("accion") == "TRESS_VACACIONES_INSERT_FAILED"
    ]
    assert len(failed_calls) == 1
    assert failed_calls[0].kwargs["entidad_id"] == solicitud.id
    assert "traslapan" in (failed_calls[0].kwargs["datos_despues"] or {}).get("error", "").lower()


@pytest.mark.asyncio
async def test_aprobar_vacaciones_ok_registra_audit_tress(client: AsyncClient, db, monkeypatch):
    registrar = AsyncMock(
        return_value=InsertarVacacionResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=77
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_vacaciones_en_tress",
        registrar,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(
        "app.utils.audit_logger._log_action_background",
        audit_mock,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="vac_tress_audit_ok_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="vac_tress_audit_ok_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
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
        if c.kwargs.get("accion") == "TRESS_VACACIONES_INSERT_OK"
    ]
    assert len(ok_calls) == 1
    assert ok_calls[0].kwargs["datos_despues"]["nueva_llave"] == 77
    assert ok_calls[0].kwargs["entidad_id"] == solicitud.id



@pytest.mark.asyncio
async def test_aprobar_vacaciones_tress_caido_503(client: AsyncClient, db, monkeypatch):
    async def _fail(**kwargs):  # noqa: ANN003
        raise ServiceUnavailableError(detail="Error al registrar vacaciones en TRESS.")

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_vacaciones_en_tress",
        _fail,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="vac_tress_503_sup@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="vac_tress_503_sub@test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
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
async def test_map_fallo_saldo_insuficiente(monkeypatch):
    from app.repositories.datos_analisis_vacaciones_write_repository import (
        InsertarVacacionResult,
    )
    from app.services import tress_vacaciones_service as svc

    class FakeRepo:
        async def insertar_vacacion(self, **kwargs):  # noqa: ANN003
            return InsertarVacacionResult(
                ok=False,
                codigo_error="SALDO_INSUFICIENTE",
                mensaje="Saldo insuficiente",
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
        "DatosAnalisisVacacionesWriteRepository",
        lambda engine: FakeRepo(),
    )
    monkeypatch.setattr(svc.settings, "TRESS_VACACIONES_DRY_RUN", False)

    with pytest.raises(svc.DomainValidationError, match="insuficiente"):
        await svc.registrar_vacaciones_en_tress(
            no_empleado=1,
            fecha_inicio=date(2026, 7, 15),
            fecha_fin=date(2026, 7, 17),
            dias_gozo=3,
        )
