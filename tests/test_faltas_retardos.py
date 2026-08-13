"""Tests del módulo `faltas-retardos` (Incidencias en la UI)."""

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
@pytest.mark.parametrize("tipo", ["retardo", "falta_injustificada", "vacaciones"])
async def test_create_rechaza_tipos_que_calcula_tress(client: AsyncClient, db, tipo):
    """Los pone nómina, no la app: no se capturan a mano ni por API.

    El modal nunca los ofreció; esto cierra la superficie del endpoint.
    """
    rh = await make_empleado(db, rol="rh", nombre="RH Creador")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Afectado")
    headers = await auth_headers(client, rh)

    with _mock_bono_importadas_repo(
        empleado_id=empleado.empleado_id,
        no_empleado=str(empleado.no_empleado),
    ) as repo:
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": tipo,
                "fecha_evento": "2026-06-20",
                "observaciones": "Llegó 15 min tarde",
            },
        )

    assert res.status_code == 422, res.text
    # Nada llegó a importadas_historico.
    repo.insert_evento.assert_not_awaited()


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


def test_ventana_por_defecto_son_seis_meses():
    """Sin filtro de fechas, la página arranca en los últimos 6 meses."""
    from datetime import date, timedelta

    from app.services.faltas_retardos_service import (
        VENTANA_DEFAULT_MESES,
        _ventana_por_defecto,
    )

    assert VENTANA_DEFAULT_MESES == 6
    desde, hasta = _ventana_por_defecto(None, None)
    assert hasta is None
    assert desde is not None
    dias = (date.today() - desde).days
    # ~6 meses: medio año en días, con holgura por el redondeo entero.
    assert 180 <= dias <= 185, dias


def test_ventana_por_defecto_respeta_las_fechas_pedidas():
    from datetime import date

    from app.services.faltas_retardos_service import _ventana_por_defecto

    pedida = date(2020, 1, 1)
    assert _ventana_por_defecto(pedida, None) == (pedida, None)
    assert _ventana_por_defecto(None, pedida) == (None, pedida)


@pytest.mark.asyncio
@pytest.mark.parametrize("rol", ["supervisor", "gerente", "director"])
async def test_create_prohibido_para_gestores(client: AsyncClient, db, rol):
    """Capturar a mano es de RH.

    Estos roles siguen **leyendo** la página —lo que ven llega del sync de nómina—,
    así que el guard tiene que cerrar el POST sin cerrar el GET. La vista
    `faltas-retardos` viene encendida de fábrica para gestores y `gate_api_amplia`
    no amplía con ella justo para que tener la pantalla no abra este endpoint.
    """
    gestor = await make_empleado(db, rol=rol, nombre=f"Gestor {rol}")
    # De su propio equipo a propósito: si fuera un empleado ajeno el 403 lo daría el
    # filtro de alcance del servicio y el test pasaría incluso sin el guard de rol.
    empleado = await make_empleado(
        db, rol="empleado", nombre="Colaborador Propio", lider_id=gestor.empleado_id
    )
    headers = await auth_headers(client, gestor)

    with _mock_bono_importadas_repo(
        empleado_id=empleado.empleado_id,
        no_empleado=str(empleado.no_empleado),
    ) as repo:
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "falta_justificada",
                "fecha_evento": "2026-06-20",
                "observaciones": "No debe registrarse",
            },
        )

    assert res.status_code == 403, res.text
    repo.insert_evento.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("rol", ["supervisor", "gerente", "director"])
async def test_list_sigue_permitido_para_gestores(client: AsyncClient, db, rol):
    """Contraparte del test anterior: cerrar el POST no debe cerrar la lectura."""
    gestor = await make_empleado(db, rol=rol, nombre=f"Lector {rol}")
    headers = await auth_headers(client, gestor)
    with patch(
        "app.services.faltas_retardos_service.FaltasRetardosService.list_eventos",
        new_callable=AsyncMock,
        return_value=_sample_bono_page(),
    ):
        res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200, res.text
