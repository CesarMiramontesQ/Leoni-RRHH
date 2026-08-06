"""Registro directo de permisos con goce en el módulo `faltas-retardos` (Incidencias en la UI)."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.faltas_retardos import FaltaRetardoEvento
from app.models.tress import TressRobotQueue
from app.core.exceptions import ServiceUnavailableError
from app.repositories.datos_analisis_permiso_goce_write_repository import (
    InsertarPermisoGoceResult,
)
from tests.conftest import auth_headers, make_empleado


def _ok_goce_result() -> InsertarPermisoGoceResult:
    return InsertarPermisoGoceResult(
        ok=True,
        codigo_error=None,
        mensaje="ok",
        nueva_llave=1001,
    )


@pytest.mark.asyncio
async def test_create_matrimonio_goce_persiste_y_escribe_tress(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Goce", no_empleado=92001)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Goce", no_empleado=92002)
    headers = await auth_headers(client, rh)

    with patch(
        "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
        new_callable=AsyncMock,
        return_value=_ok_goce_result(),
    ) as mock_tress:
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
    assert evs[0].fecha_evento == date(2026, 5, 4)
    assert evs[0].fecha_fin == date(2026, 5, 5)

    mock_tress.assert_awaited_once()
    call_kw = mock_tress.await_args.kwargs
    assert call_kw["no_empleado"] == 92002
    assert call_kw["fecha_inicio"] == date(2026, 5, 4)
    assert call_kw["fecha_fin"] == date(2026, 5, 5)
    assert call_kw["comentario"] == "MATRIMONIO"

    queue = (await db.execute(select(TressRobotQueue))).scalars().all()
    assert queue == []


@pytest.mark.asyncio
async def test_create_matrimonio_cruza_semana_dos_registros(client: AsyncClient, db):
    """Jue–Vie no cruza; Lun–Mar de otra semana: matrimonio 2 días que cruza domingo."""
    rh = await make_empleado(db, rol="rh", nombre="RH Split", no_empleado=92011)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Split", no_empleado=92012)
    headers = await auth_headers(client, rh)

    # Dom 2026-05-10 + Lun 2026-05-11 = 2 días matrimonio que cruza semana
    with patch(
        "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
        new_callable=AsyncMock,
        return_value=_ok_goce_result(),
    ) as mock_tress:
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-05-10",
                "fecha_fin": "2026-05-11",
            },
        )
    assert res.status_code == 201, res.text

    evs = (
        await db.execute(
            select(FaltaRetardoEvento)
            .where(
                FaltaRetardoEvento.empleado_id == empleado.empleado_id,
                FaltaRetardoEvento.tipo == "matrimonio",
            )
            .order_by(FaltaRetardoEvento.fecha_evento)
        )
    ).scalars().all()
    assert len(evs) == 2
    assert (evs[0].fecha_evento, evs[0].fecha_fin) == (date(2026, 5, 10), date(2026, 5, 10))
    assert (evs[1].fecha_evento, evs[1].fecha_fin) == (date(2026, 5, 11), date(2026, 5, 11))

    assert mock_tress.await_count == 2
    assert mock_tress.await_args_list[0].kwargs["fecha_inicio"] == date(2026, 5, 10)
    assert mock_tress.await_args_list[0].kwargs["fecha_fin"] == date(2026, 5, 10)
    assert mock_tress.await_args_list[1].kwargs["fecha_inicio"] == date(2026, 5, 11)
    assert mock_tress.await_args_list[1].kwargs["fecha_fin"] == date(2026, 5, 11)

    # Respuesta = primer tramo
    assert res.json()["fecha_evento"] == "2026-05-10"
    assert res.json()["fecha_fin"] == "2026-05-10"


@pytest.mark.asyncio
async def test_create_matrimonio_fallo_tress_no_persiste_levelup(client: AsyncClient, db):
    from app.core.exceptions import ConflictError

    rh = await make_empleado(db, rol="rh", nombre="RH Fail", no_empleado=92013)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Fail", no_empleado=92014)
    headers = await auth_headers(client, rh)

    with patch(
        "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
        new_callable=AsyncMock,
        side_effect=ConflictError(detail="Ya existe un permiso para el empleado en ese rango."),
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-05-04",
                "fecha_fin": "2026-05-05",
            },
        )
    assert res.status_code == 409, res.text

    evs = (
        await db.execute(
            select(FaltaRetardoEvento).where(
                FaltaRetardoEvento.empleado_id == empleado.empleado_id,
                FaltaRetardoEvento.tipo == "matrimonio",
            )
        )
    ).scalars().all()
    assert evs == []


@pytest.mark.asyncio
async def test_create_matrimonio_rechaza_inicio_en_descanso(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Descanso", no_empleado=92021)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Descanso", no_empleado=92022
    )
    headers = await auth_headers(client, rh)
    registrar = AsyncMock()

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=[date(2026, 7, 20)],
        ),
        patch(
            "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
            registrar,
        ),
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-07-20",
                "fecha_fin": "2026-07-21",
            },
        )

    assert res.status_code == 422, res.text
    assert "descanso" in res.json()["detail"].lower()
    registrar.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_matrimonio_extiende_y_separa_descansos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Extiende", no_empleado=92023)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Extiende", no_empleado=92024
    )
    headers = await auth_headers(client, rh)

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=[date(2026, 7, 21), date(2026, 7, 22)],
        ),
        patch(
            "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
            new_callable=AsyncMock,
            return_value=_ok_goce_result(),
        ) as registrar,
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-07-20",
                "fecha_fin": "2026-07-21",
            },
        )

    assert res.status_code == 201, res.text
    assert [
        (call.kwargs["fecha_inicio"], call.kwargs["fecha_fin"])
        for call in registrar.await_args_list
    ] == [
        (date(2026, 7, 20), date(2026, 7, 20)),
        (date(2026, 7, 23), date(2026, 7, 23)),
    ]
    evs = (
        await db.execute(
            select(FaltaRetardoEvento)
            .where(FaltaRetardoEvento.empleado_id == empleado.empleado_id)
            .order_by(FaltaRetardoEvento.fecha_evento)
        )
    ).scalars().all()
    assert [(ev.fecha_evento, ev.fecha_fin) for ev in evs] == [
        (date(2026, 7, 20), date(2026, 7, 20)),
        (date(2026, 7, 23), date(2026, 7, 23)),
    ]


@pytest.mark.asyncio
async def test_create_incapacidad_rango_solo_descansos_rechaza(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Solo Desc", no_empleado=92025)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Solo Desc", no_empleado=92026
    )
    headers = await auth_headers(client, rh)

    with patch(
        "app.services.faltas_retardos_service.obtener_descansos_tress",
        new_callable=AsyncMock,
        return_value=[date(2026, 7, 20), date(2026, 7, 21)],
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "incapacidad_interna",
                "fecha_evento": "2026-07-20",
                "fecha_fin": "2026-07-21",
            },
        )

    assert res.status_code == 422, res.text
    assert "descanso" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_fallo_consulta_descansos_ocurre_antes_de_escrituras(
    client: AsyncClient, db,
):
    rh = await make_empleado(db, rol="rh", nombre="RH Falla Desc", no_empleado=92027)
    empleado = await make_empleado(
        db, rol="empleado", nombre="Emp Falla Desc", no_empleado=92028
    )
    headers = await auth_headers(client, rh)
    registrar = AsyncMock()
    crear_levelup = AsyncMock()

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            side_effect=ServiceUnavailableError("No se pudieron consultar los descansos."),
        ),
        patch(
            "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
            registrar,
        ),
        patch(
            "app.services.faltas_retardos_service.FaltasRetardosRepository.create_evento",
            crear_levelup,
        ),
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-07-20",
                "fecha_fin": "2026-07-21",
            },
        )

    assert res.status_code == 503, res.text
    registrar.assert_not_awaited()
    crear_levelup.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_incapacidad_interna_sin_cola_tress(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Inc", no_empleado=92015)
    empleado = await make_empleado(db, rol="empleado", nombre="Emp Inc", no_empleado=92016)
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "incapacidad_interna",
            "fecha_evento": "2026-06-01",
            "fecha_fin": "2026-06-05",
        },
    )
    assert res.status_code == 201, res.text

    queue = (
        await db.execute(
            select(TressRobotQueue).where(
                TressRobotQueue.accion == "REGISTRAR_GOCE_SUELDO_INCAPACIDAD_INTERNA"
            )
        )
    ).scalars().all()
    assert queue == []


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
async def test_list_incluye_goce_levelup_sin_tress(client: AsyncClient, db, monkeypatch):
    """Listado mezcla eventos levelup goce aunque Bono esté vacío / mockeado."""
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

    # incapacidad_interna no existe en TRESS: el listado no debe consultarlo.
    create_engine = MagicMock()
    with patch(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        create_engine,
    ):
        res = await client.get(
            "/api/v1/faltas-retardos?tipo=incapacidad_interna",
            headers=headers,
        )
    create_engine.assert_not_called()
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    item = next(i for i in body["items"] if i["tipo"] == "incapacidad_interna")
    assert item["origen"] == "manual"
    assert item["observaciones"] == "Incapacidad interna RH"
    assert item["fecha_fin"] == "2026-06-05"
