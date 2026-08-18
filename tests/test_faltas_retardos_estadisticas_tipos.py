"""Estadísticas de incidencias acotadas a un subconjunto de tipos.

La tarjeta «Incidencias por colaborador» del dashboard de líder/gerente muestra faltas,
retardos, incapacidades y suspensiones — no vacaciones ni permisos con goce. El ranking
de `empleados_con_mas_eventos` se calcula en el servidor, así que el recorte de tipos
tiene que viajar en la consulta: filtrarlo en el cliente dejaría el top ordenado por
eventos que la tarjeta no muestra.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_incidencia_tress

_TIPOS_QS = "tipos=retardo&tipos=falta_injustificada"


async def _sembrar_equipo(db):
    """Ana: 3 vacaciones + 1 retardo. Beto: 2 retardos. Sin filtro gana Ana."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    origen_id = 0
    for tipo in ("vacaciones", "vacaciones", "vacaciones", "retardo"):
        origen_id += 1
        await make_incidencia_tress(
            db,
            origen_id=origen_id,
            no_empleado=553,
            empleado_id=10,
            tipo=tipo,
            fecha_evento=date.today(),
        )
    for _ in range(2):
        origen_id += 1
        await make_incidencia_tress(
            db,
            origen_id=origen_id,
            no_empleado=554,
            empleado_id=11,
            tipo="retardo",
            fecha_evento=date.today(),
        )


@pytest.mark.asyncio
async def test_tipos_acotan_los_totales(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await _sembrar_equipo(db)

    resp = await client.get(
        f"/api/v1/faltas-retardos/estadisticas?{_TIPOS_QS}",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_eventos"] == 3
    assert data["retardo"] == 3
    assert [e["tipo"] for e in data["eventos_por_tipo"]] == ["retardo"]


@pytest.mark.asyncio
async def test_tipos_reordenan_el_top_de_colaboradores(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await _sembrar_equipo(db)

    resp = await client.get(
        f"/api/v1/faltas-retardos/estadisticas?{_TIPOS_QS}",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    top = resp.json()["empleados_con_mas_eventos"]
    assert [(e["nombre"], e["total"]) for e in top] == [("Beto", 2), ("Ana", 1)]


@pytest.mark.asyncio
async def test_top_empleados_recorta_el_ranking(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await _sembrar_equipo(db)

    resp = await client.get(
        f"/api/v1/faltas-retardos/estadisticas?{_TIPOS_QS}&top_empleados=1",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    top = resp.json()["empleados_con_mas_eventos"]
    assert [e["nombre"] for e in top] == ["Beto"]


@pytest.mark.asyncio
async def test_total_colaboradores_no_lo_recorta_el_top(db, client: AsyncClient):
    """El recorte no debe hacer pasar «Top 1» por «solo hay 1 colaborador»."""
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await _sembrar_equipo(db)

    resp = await client.get(
        f"/api/v1/faltas-retardos/estadisticas?{_TIPOS_QS}&top_empleados=1",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 200
    assert resp.json()["total_colaboradores_con_eventos"] == 2


@pytest.mark.asyncio
async def test_tipo_desconocido_es_rechazado(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await _sembrar_equipo(db)

    resp = await client.get(
        "/api/v1/faltas-retardos/estadisticas?tipos=inventado",
        headers=await auth_headers(client, rh),
    )

    assert resp.status_code == 422
