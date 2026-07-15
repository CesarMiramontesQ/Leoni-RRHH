"""Tests del módulo Faltas y retardos."""

from contextlib import contextmanager
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.faltas_retardos import FaltaRetardoResponse, FaltasRetardosEstadisticasResponse, FaltasRetardosPageResponse
from tests.conftest import auth_headers, make_empleado


@contextmanager
def _mock_bono_importadas_repo(
    *,
    origen_id: int = 9001,
    tipo_codigo: str = "RE",
    empleado_id: int = 1,
    no_empleado: str = "100",
    fecha_evento: date = date(2026, 6, 20),
    insert_ids: list[int] | None = None,
):
    ids = insert_ids or [origen_id]
    insert_mock = AsyncMock(side_effect=list(ids))
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()
    repo_instance = AsyncMock(
        resolve_semana_id=AsyncMock(return_value=77),
        list_semana_ids_en_rango=AsyncMock(return_value=[77, 78]),
        insert_evento=insert_mock,
        fetch_evento_row=AsyncMock(
            return_value={
                "origen": "importadas_historico",
                "origen_id": origen_id,
                "empleado_id": empleado_id,
                "no_empleado": no_empleado,
                "nombre": "EMPLEADO TEST",
                "tipo_codigo": tipo_codigo,
                "tipo_descripcion": "Evento",
                "fecha_evento": fecha_evento,
                "fecha_fin": None,
            }
        ),
    )
    with (
        patch(
            "app.services.faltas_retardos_service.BonoProductividadReadClient.create_read_engine",
            return_value=mock_engine,
        ),
        patch(
            "app.services.faltas_retardos_service.BonoImportadasHistoricoRepository",
            return_value=repo_instance,
        ),
    ):
        yield repo_instance


def _sample_bono_page() -> FaltasRetardosPageResponse:
    return FaltasRetardosPageResponse(
        items=[
            FaltaRetardoResponse(
                id=1_000_000_124,
                empleado_id=122,
                empleado_nombre="PEREZ, JUAN",
                numero_empleado="122",
                tipo="retardo",
                fecha_evento=date(2026, 6, 20),
                fecha_fin=None,
                observaciones="Retardo",
                registrado_por_id=None,
                registrado_por_nombre=None,
                created_at=datetime(2026, 6, 20, tzinfo=timezone.utc),
                origen="importadas_historico",
                origen_id=124,
            )
        ],
        total=1,
        page=1,
        page_size=20,
    )


@pytest.mark.asyncio
async def test_list_faltas_retardos_desde_bono(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Faltas")
    headers = await auth_headers(client, rh)
    with patch(
        "app.services.faltas_retardos_service.FaltasRetardosService.list_eventos",
        new_callable=AsyncMock,
        return_value=_sample_bono_page(),
    ):
        res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["tipo"] == "retardo"
    assert body["items"][0]["origen"] == "importadas_historico"


@pytest.mark.asyncio
async def test_estadisticas_faltas_retardos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Stats")
    headers = await auth_headers(client, rh)
    with patch(
        "app.services.faltas_retardos_service.FaltasRetardosService.estadisticas_eventos",
        new_callable=AsyncMock,
        return_value=FaltasRetardosEstadisticasResponse(
            total_eventos=10,
            falta_justificada=3,
            falta_injustificada=2,
            retardo=4,
            incapacidad=1,
            suspension=0,
            eventos_por_mes=[{"periodo": "2026-06", "total": 5}],
            eventos_por_tipo=[{"tipo": "retardo", "total": 4, "porcentaje": 40.0}],
            empleados_con_mas_eventos=[
                {
                    "empleado_id": 1,
                    "no_empleado": "100",
                    "nombre": "JUAN",
                    "total": 3,
                    "por_tipo": [
                        {"tipo": "retardo", "total": 2},
                        {"tipo": "falta_justificada", "total": 1},
                    ],
                }
            ],
        ),
    ):
        res = await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_eventos"] == 10
    assert data["retardo"] == 4


@pytest.mark.asyncio
async def test_create_falta_retardo_retardo(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Creador")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Afectado")
    headers = await auth_headers(client, rh)

    with _mock_bono_importadas_repo(
        origen_id=9001,
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
                "observaciones": "Llegó 15 min tarde",
            },
        )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["empleado_id"] == empleado.empleado_id
    assert data["tipo"] == "retardo"
    assert data["fecha_evento"] == "2026-06-20"
    assert data["registrado_por_id"] == rh.empleado_id
    assert data["origen"] == "manual"
    assert data["origen_id"] == 9001
    assert data["observaciones"] == "Llegó 15 min tarde"


@pytest.mark.asyncio
async def test_create_incapacidad_requiere_fecha_fin(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Validacion")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Incap")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "incapacidad",
            "fecha_evento": "2026-06-01",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_incapacidad_con_rango(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Incap")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Rango")
    headers = await auth_headers(client, rh)

    with _mock_bono_importadas_repo(
        origen_id=9002,
        tipo_codigo="INC",
        empleado_id=empleado.empleado_id,
        no_empleado=str(empleado.no_empleado),
        fecha_evento=date(2026, 6, 1),
        insert_ids=[9002, 9003],
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "incapacidad",
                "fecha_evento": "2026-06-01",
                "fecha_fin": "2026-06-05",
                "observaciones": "Incapacidad IMSS",
            },
        )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["fecha_fin"] == "2026-06-05"
    assert data["origen"] == "manual"
    assert data["observaciones"] == "Incapacidad IMSS"


@pytest.mark.asyncio
async def test_list_con_filtro_busqueda(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Filtro")
    headers = await auth_headers(client, rh)
    page = FaltasRetardosPageResponse(
        items=[
            FaltaRetardoResponse(
                id=1_000_000_001,
                empleado_id=1,
                empleado_nombre="JUAN PEREZ LOPEZ",
                numero_empleado="1",
                tipo="falta_injustificada",
                fecha_evento=date.today(),
                fecha_fin=None,
                observaciones=None,
                registrado_por_id=None,
                registrado_por_nombre=None,
                created_at=datetime.now(timezone.utc),
                origen="importadas_historico",
                origen_id=1,
            )
        ],
        total=1,
        page=1,
        page_size=20,
    )
    with patch(
        "app.services.faltas_retardos_service.FaltasRetardosService.list_eventos",
        new_callable=AsyncMock,
        return_value=page,
    ):
        res = await client.get(
            "/api/v1/faltas-retardos?busqueda=JUAN",
            headers=headers,
        )
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_map_bono_row_no_usa_tipo_descripcion_como_observaciones():
    from app.services.faltas_retardos.mapper import map_bono_row

    mapped = map_bono_row(
        {
            "origen": "importadas_historico",
            "origen_id": 55,
            "empleado_id": 1,
            "no_empleado": "100",
            "nombre": "TEST",
            "tipo_codigo": "SUS",
            "tipo_descripcion": "Suspension catalogo",
            "fecha_evento": date(2026, 7, 20),
            "fecha_fin": None,
            "observaciones": None,
        }
    )
    assert mapped is not None
    assert mapped.tipo == "suspension"
    assert mapped.observaciones is None
    assert mapped.origen == "importadas_historico"


@pytest.mark.asyncio
async def test_enrich_registrado_por_restaura_motivo_y_origen_manual(db):
    from app.models.faltas_retardos import FaltaRetardoRegistroAuditoria
    from app.services.faltas_retardos_service import FaltasRetardosService

    rh = await make_empleado(db, rol="rh", nombre="RH Enrich")
    audit = FaltaRetardoRegistroAuditoria(
        bono_origen="importadas_historico",
        bono_origen_id=4242,
        registrado_por_id=rh.empleado_id,
        observaciones="MOTIVO SUSPENSION",
        fecha_fin=date(2026, 7, 22),
    )
    db.add(audit)
    await db.commit()

    item = FaltaRetardoResponse(
        id=1_000_004_242,
        empleado_id=1,
        empleado_nombre="EMP",
        numero_empleado="1",
        tipo="suspension",
        fecha_evento=date(2026, 7, 20),
        fecha_fin=None,
        observaciones=None,
        registrado_por_id=None,
        registrado_por_nombre=None,
        created_at=datetime.now(timezone.utc),
        origen="importadas_historico",
        origen_id=4242,
    )
    svc = FaltasRetardosService(db)
    enriched = await svc._enrich_registrado_por([item])
    assert len(enriched) == 1
    assert enriched[0].origen == "manual"
    assert enriched[0].observaciones == "MOTIVO SUSPENSION"
    assert enriched[0].fecha_fin == date(2026, 7, 22)
    assert enriched[0].registrado_por_id == rh.empleado_id
    assert enriched[0].id == 1_000_004_242
