"""API del historial de corridas: solo admin, listado liviano y detalle completo."""

from datetime import datetime, timezone

import pytest

from app.models.scheduler_job_log import SchedulerJobLog
from tests.conftest import auth_headers, make_empleado


async def _corrida(db, **kwargs):
    fila = SchedulerJobLog(
        job_id=kwargs.pop("job_id", "sync_turnos_uso"),
        inicio_at=kwargs.pop("inicio_at", datetime(2026, 8, 11, 10, 0, tzinfo=timezone.utc)),
        resultado=kwargs.pop("resultado", "ok"),
        resumen=kwargs.pop("resumen", "insertados=3"),
        lineas=kwargs.pop("lineas", [{"ts": "t", "nivel": "INFO", "mensaje": "insertados=3"}]),
        **kwargs,
    )
    db.add(fila)
    await db.commit()
    await db.refresh(fila)
    return fila


@pytest.mark.asyncio
async def test_no_admin_recibe_403_en_los_tres_endpoints(client, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Sin Admin", no_empleado=7001)
    headers = await auth_headers(client, rh)
    fila = await _corrida(db)

    for url in (
        "/api/v1/scheduler-logs",
        "/api/v1/scheduler-logs/jobs",
        f"/api/v1/scheduler-logs/{fila.id}",
    ):
        res = await client.get(url, headers=headers)
        assert res.status_code == 403, url


@pytest.mark.asyncio
async def test_sin_token_responde_401(client, db):
    res = await client.get("/api/v1/scheduler-logs")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_lista_las_corridas_sin_lineas(client, db):
    admin = await make_empleado(
        db,
        rol="rh",
        nombre="Admin Logs",
        no_empleado=7002,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    await _corrida(db)

    res = await client.get("/api/v1/scheduler-logs", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["items"][0]["resumen"] == "insertados=3"
    assert "lineas" not in body["items"][0]


@pytest.mark.asyncio
async def test_admin_filtra_por_job_y_resultado(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin F", no_empleado=7003,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    await _corrida(db, job_id="sync_turnos_uso", resultado="ok")
    await _corrida(db, job_id="sync_incidencias_tress", resultado="error")

    res = await client.get(
        "/api/v1/scheduler-logs?job_id=sync_incidencias_tress&resultado=error",
        headers=headers,
    )

    assert res.status_code == 200
    assert res.json()["total"] == 1


@pytest.mark.asyncio
async def test_detalle_trae_las_lineas(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin D", no_empleado=7004,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    fila = await _corrida(db)

    res = await client.get(f"/api/v1/scheduler-logs/{fila.id}", headers=headers)

    assert res.status_code == 200
    assert res.json()["lineas"] == [
        {"ts": "t", "nivel": "INFO", "mensaje": "insertados=3"}
    ]


@pytest.mark.asyncio
async def test_detalle_inexistente_responde_404(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin 404", no_empleado=7005,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)

    res = await client.get("/api/v1/scheduler-logs/99999", headers=headers)

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_jobs_devuelve_los_ids_registrados(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin J", no_empleado=7006,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)

    res = await client.get("/api/v1/scheduler-logs/jobs", headers=headers)

    assert res.status_code == 200
    items = res.json()["items"]
    assert "sync_ausencias_fi_re" in items
    assert len(items) == 11
