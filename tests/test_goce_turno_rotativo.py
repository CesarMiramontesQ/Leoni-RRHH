"""Permisos con goce frente a turno rotativo (patrón G11 / FN_GeneraRitmo).

Usa el mismo patrón real de TRESS y escenarios de julio 2026 donde los
descansos vienen en pares consecutivos (3–4, 11–12, 19–20, 27–28).
"""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.faltas_retardos import FaltaRetardoEvento
from app.repositories.datos_analisis_permiso_goce_write_repository import (
    InsertarPermisoGoceResult,
)
from app.utils.descansos_fechas import (
    avanzar_hasta_reunir_dias,
    fechas_efectivas_en_rango,
    partir_tramos_por_semanas,
    tramos_consecutivos,
)
from app.utils.turno_calendario import TurnoTress, proyectar_dia
from tests.conftest import auth_headers, make_empleado
from tests.test_turno_calendario import PATRON_G11


def _turno_g11() -> TurnoTress:
    return TurnoTress(
        codigo="G11",
        rit_pat=PATRON_G11,
        rit_ini=date(2025, 6, 16),
        tips=(0, 0, 0, 0, 0, 1, 2),
        hors=("", "", "", "", "", "", ""),
    )


def _descansos_julio_g11() -> list[date]:
    turno = _turno_g11()
    ini, fin = date(2026, 7, 1), date(2026, 7, 31)
    out: list[date] = []
    cursor = ini
    while cursor <= fin:
        if proyectar_dia(turno, cursor).estatus == "DESCANSO":
            out.append(cursor)
        cursor += timedelta(days=1)
    return out


def _ok_goce() -> InsertarPermisoGoceResult:
    return InsertarPermisoGoceResult(
        ok=True,
        codigo_error=None,
        mensaje="ok",
        nueva_llave=2001,
    )


def test_g11_julio_genera_pares_consecutivos_de_descanso():
    descansos = _descansos_julio_g11()
    assert descansos == [
        date(2026, 7, 3),
        date(2026, 7, 4),
        date(2026, 7, 11),
        date(2026, 7, 12),
        date(2026, 7, 19),
        date(2026, 7, 20),
        date(2026, 7, 27),
        date(2026, 7, 28),
    ]
    # Siempre pares consecutivos
    for i in range(0, len(descansos), 2):
        assert descansos[i + 1] == descansos[i] + timedelta(days=1)


def test_matrimonio_salta_par_rotativo_domingo_lunes():
    """Inicio viernes 17: salta 19–20 (par G11) → viernes + sábado."""
    descansos = set(_descansos_julio_g11())
    fechas = avanzar_hasta_reunir_dias(date(2026, 7, 17), 2, descansos)
    assert fechas == [date(2026, 7, 17), date(2026, 7, 18)]
    assert date(2026, 7, 19) not in fechas
    assert date(2026, 7, 20) not in fechas


def test_matrimonio_antes_del_par_extiende_a_martes():
    """Inicio sábado 18: 18 laborable + salta 19–20 → martes 21."""
    descansos = set(_descansos_julio_g11())
    fechas = avanzar_hasta_reunir_dias(date(2026, 7, 18), 2, descansos)
    assert fechas == [date(2026, 7, 18), date(2026, 7, 21)]
    assert tramos_consecutivos(fechas) == [
        (date(2026, 7, 18), date(2026, 7, 18)),
        (date(2026, 7, 21), date(2026, 7, 21)),
    ]


def test_defuncion_tres_dias_salta_par_rotativo():
    """Inicio 18 jul: 18, salta 19–20, 21, 22 → 3 días efectivos."""
    descansos = set(_descansos_julio_g11())
    fechas = avanzar_hasta_reunir_dias(date(2026, 7, 18), 3, descansos)
    assert fechas == [
        date(2026, 7, 18),
        date(2026, 7, 21),
        date(2026, 7, 22),
    ]


def test_paternidad_siete_habiles_salta_pares_rotativos():
    """Paternidad lun–vie: inicio lunes 13; salta 19–20 del rango hábil."""
    descansos = set(_descansos_julio_g11())
    # 13 es lunes pero es DESCANSO en G11 → no se puede iniciar ahí
    assert date(2026, 7, 13) not in descansos  # 13-14? julio pares son 11-12, 19-20
    # lunes 13 es laborable en G11 julio; martes 14 también
    fechas = avanzar_hasta_reunir_dias(
        date(2026, 7, 13),
        7,
        descansos,
        solo_lunes_viernes=True,
    )
    assert len(fechas) == 7
    assert date(2026, 7, 19) not in fechas
    assert date(2026, 7, 20) not in fechas
    # 13–17 (5) + 21–22 (2) = 7 hábiles saltando el par 19–20
    assert fechas == [
        date(2026, 7, 13),
        date(2026, 7, 14),
        date(2026, 7, 15),
        date(2026, 7, 16),
        date(2026, 7, 17),
        date(2026, 7, 21),
        date(2026, 7, 22),
    ]


def test_incapacidad_rango_que_cruza_par_excluye_descansos():
    descansos = _descansos_julio_g11()
    efectivo = fechas_efectivas_en_rango(
        date(2026, 7, 17),
        date(2026, 7, 22),
        descansos,
    )
    assert date(2026, 7, 19) not in efectivo
    assert date(2026, 7, 20) not in efectivo
    assert efectivo == [
        date(2026, 7, 17),
        date(2026, 7, 18),
        date(2026, 7, 21),
        date(2026, 7, 22),
    ]
    tramos = partir_tramos_por_semanas(tramos_consecutivos(efectivo))
    assert tramos == [
        (date(2026, 7, 17), date(2026, 7, 18)),
        (date(2026, 7, 21), date(2026, 7, 22)),
    ]


@pytest.mark.asyncio
async def test_api_matrimonio_con_patron_rotativo_g11_julio(client: AsyncClient, db):
    """API: matrimonio iniciando el día previo al par 19–20 → dos tramos TRESS.

    El body envía fin calendario consecutivo (+1 día); el servicio recalcula
    días otorgados saltando el par rotativo.
    """
    rh = await make_empleado(db, rol="rh", email="goce-rot-rh@test", no_empleado=95001)
    empleado = await make_empleado(
        db, rol="empleado", email="goce-rot-emp@test", no_empleado=95002
    )
    headers = await auth_headers(client, rh)
    descansos = _descansos_julio_g11()

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=descansos,
        ),
        patch(
            "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
            new_callable=AsyncMock,
            return_value=_ok_goce(),
        ) as registrar,
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "matrimonio",
                "fecha_evento": "2026-07-18",
                # Fin calendario formal (+1); el motor otorga 18 y 21.
                "fecha_fin": "2026-07-19",
            },
        )

    assert res.status_code == 201, res.text
    assert [
        (c.kwargs["fecha_inicio"], c.kwargs["fecha_fin"]) for c in registrar.await_args_list
    ] == [
        (date(2026, 7, 18), date(2026, 7, 18)),
        (date(2026, 7, 21), date(2026, 7, 21)),
    ]
    evs = (
        await db.execute(
            select(FaltaRetardoEvento)
            .where(FaltaRetardoEvento.empleado_id == empleado.empleado_id)
            .order_by(FaltaRetardoEvento.fecha_evento)
        )
    ).scalars().all()
    assert [(e.fecha_evento, e.fecha_fin) for e in evs] == [
        (date(2026, 7, 18), date(2026, 7, 18)),
        (date(2026, 7, 21), date(2026, 7, 21)),
    ]


@pytest.mark.asyncio
async def test_api_rechaza_matrimonio_iniciando_en_par_rotativo(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="goce-rot-rh2@test", no_empleado=95003)
    empleado = await make_empleado(
        db, rol="empleado", email="goce-rot-emp2@test", no_empleado=95004
    )
    headers = await auth_headers(client, rh)
    registrar = AsyncMock()

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=_descansos_julio_g11(),
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
                "fecha_evento": "2026-07-19",
                "fecha_fin": "2026-07-20",
            },
        )

    assert res.status_code == 422, res.text
    assert "descanso" in res.json()["detail"].lower()
    registrar.assert_not_awaited()


@pytest.mark.asyncio
async def test_api_defuncion_salta_pares_rotativos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="goce-rot-rh3@test", no_empleado=95005)
    empleado = await make_empleado(
        db, rol="empleado", email="goce-rot-emp3@test", no_empleado=95006
    )
    headers = await auth_headers(client, rh)

    with (
        patch(
            "app.services.faltas_retardos_service.obtener_descansos_tress",
            new_callable=AsyncMock,
            return_value=_descansos_julio_g11(),
        ),
        patch(
            "app.services.tress_goce_service.registrar_permiso_goce_en_tress",
            new_callable=AsyncMock,
            return_value=_ok_goce(),
        ) as registrar,
    ):
        res = await client.post(
            "/api/v1/faltas-retardos",
            headers=headers,
            json={
                "empleado_id": empleado.empleado_id,
                "tipo": "defuncion",
                "fecha_evento": "2026-07-18",
                # Fin calendario formal (+2); el motor otorga 18, 21 y 22.
                "fecha_fin": "2026-07-20",
            },
        )

    assert res.status_code == 201, res.text
    # 18 | 21–22 (salta 19–20)
    assert [
        (c.kwargs["fecha_inicio"], c.kwargs["fecha_fin"]) for c in registrar.await_args_list
    ] == [
        (date(2026, 7, 18), date(2026, 7, 18)),
        (date(2026, 7, 21), date(2026, 7, 22)),
    ]


@pytest.mark.asyncio
async def test_proyeccion_tress_real_empleado_4005_coincide_con_g11():
    """Smoke contra DATOS_ANALISIS (backend image); se omite si no hay driver/ODBC."""
    try:
        from app.integrations.datos_analisis_db import DatosAnalisisReadClient
        from app.services.descansos_empleado_service import obtener_descansos_tress
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"Integración TRESS no disponible: {exc}")

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:
        pytest.skip(f"No se pudo crear engine DATOS_ANALISIS: {exc}")

    if engine is None:
        pytest.skip("DATOS_ANALISIS no configurado en este entorno")

    reales = await obtener_descansos_tress(
        cb_codigo=4005,
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 31),
    )
    assert reales == _descansos_julio_g11()
