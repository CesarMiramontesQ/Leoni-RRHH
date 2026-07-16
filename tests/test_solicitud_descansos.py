from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_solicitud


APROBACION = {
    "accion": "approve",
    "nivel": 1,
    "comentario": "Aprobado",
}


@pytest.mark.asyncio
async def test_aprobar_solicitud_goce_reconsulta_y_escribe_solo_tramos_efectivos(
    client: AsyncClient, db,
):
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol_desc_sup@test", no_empleado=93001
    )
    empleado = await make_empleado(
        db,
        rol="empleado",
        email="sol_desc_emp@test",
        no_empleado=93002,
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="matrimonio",
        estado="pending",
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 21),
    )
    headers = await auth_headers(client, supervisor)
    registrar = AsyncMock(return_value=[])
    encolar = AsyncMock()

    with (
        patch(
            "app.services.solicitud_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=[date(2026, 7, 21), date(2026, 7, 22)],
        ) as consultar,
        patch(
            "app.services.solicitud_service.registrar_permisos_goce_tramos_en_tress",
            registrar,
        ),
        patch("app.services.solicitud_service.encolar_tress", encolar),
    ):
        response = await client.put(
            f"/api/v1/solicitudes/{solicitud.id}/approve",
            json=APROBACION,
            headers=headers,
        )

    assert response.status_code == 200, response.text
    consultar.assert_awaited_once()
    assert consultar.await_args.kwargs["cb_codigo"] == 93002
    registrar.assert_awaited_once_with(
        no_empleado=93002,
        tramos=[
            (date(2026, 7, 20), date(2026, 7, 20)),
            (date(2026, 7, 23), date(2026, 7, 23)),
        ],
        comentario="MATRIMONIO",
    )
    encolar.assert_not_awaited()


@pytest.mark.asyncio
async def test_revision_solicitud_goce_rechaza_inicio_en_descanso(
    client: AsyncClient, db,
):
    empleado = await make_empleado(
        db, rol="empleado", email="sol_desc_revision@test", no_empleado=93003
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="matrimonio",
        estado="changes_requested",
        fecha_inicio=date(2026, 7, 13),
        fecha_fin=date(2026, 7, 14),
    )
    headers = await auth_headers(client, empleado)

    with patch(
        "app.services.solicitud_service.obtener_descansos_tress",
        new_callable=AsyncMock,
        return_value=[date(2026, 7, 20)],
    ):
        response = await client.patch(
            f"/api/v1/solicitudes/{solicitud.id}/revision",
            json={
                "fecha_inicio": "2026-07-20",
                "fecha_fin": "2026-07-21",
            },
            headers=headers,
        )

    assert response.status_code == 422, response.text
    assert "descanso" in response.json()["detail"].lower()
