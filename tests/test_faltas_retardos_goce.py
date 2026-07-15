"""Registro directo de permisos con goce en Faltas y retardos."""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.faltas_retardos import FaltaRetardoEvento
from app.models.tress import TressRobotQueue
from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_create_matrimonio_goce_en_faltas_persiste_y_encola(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Goce", no_empleado=92001)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Goce", no_empleado=92002)
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "matrimonio",
            "fecha_evento": "2026-05-04",
            "fecha_fin": "2026-05-05",
            "observaciones": "Permiso matrimonio",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["tipo"] == "matrimonio"
    assert data["origen"] == "manual"
    assert data["fecha_fin"] == "2026-05-05"
    assert data["observaciones"] == "Permiso matrimonio"

    evs = (
        await db.execute(
            select(FaltaRetardoEvento).where(
                FaltaRetardoEvento.empleado_id == empleado.empleado_id,
                FaltaRetardoEvento.tipo == "matrimonio",
            )
        )
    ).scalars().all()
    assert len(evs) == 1
    assert evs[0].observaciones == "Permiso matrimonio"

    queue = (
        await db.execute(
            select(TressRobotQueue).where(
                TressRobotQueue.accion == "REGISTRAR_GOCE_SUELDO_MATRIMONIO"
            )
        )
    ).scalars().all()
    assert len(queue) >= 1
    assert queue[-1].payload["referencia_id"] == evs[0].id
    assert queue[-1].payload["fecha_inicio"] == "2026-05-04"


@pytest.mark.asyncio
async def test_create_matrimonio_rango_invalido(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Goce Inv", no_empleado=92003)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Goce Inv", no_empleado=92004)
    headers = await auth_headers(client, rh)
    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "matrimonio",
            "fecha_evento": "2026-05-04",
            "fecha_fin": "2026-05-10",
        },
    )
    assert res.status_code == 422
    assert "2 días" in res.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_list_incluye_goce_levelup_sin_bono(client: AsyncClient, db, monkeypatch):
    """Listado mezcla eventos levelup goce aunque Bono esté vacío / mockeado."""
    from unittest.mock import AsyncMock, MagicMock, patch

    rh = await make_empleado(db, rol="rh", nombre="RH List Goce", no_empleado=92005)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp List Goce", no_empleado=92006)
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "incapacidad_interna",
            "fecha_evento": "2026-06-01",
            "fecha_fin": "2026-06-05",
            "observaciones": "Incapacidad interna RH",
        },
    )
    assert create.status_code == 201, create.text

    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()
    repo = AsyncMock(
        count=AsyncMock(return_value=0),
        list_offset=AsyncMock(return_value=[]),
    )
    with (
        patch(
            "app.services.faltas_retardos_service.BonoProductividadReadClient.create_read_engine",
            return_value=mock_engine,
        ),
        patch(
            "app.services.faltas_retardos_service.BonoFaltasRetardosRepository",
            return_value=repo,
        ),
    ):
        res = await client.get(
            "/api/v1/faltas-retardos?tipo=incapacidad_interna",
            headers=headers,
        )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    item = next(i for i in body["items"] if i["tipo"] == "incapacidad_interna")
    assert item["origen"] == "manual"
    assert item["observaciones"] == "Incapacidad interna RH"
    assert item["fecha_fin"] == "2026-06-05"
