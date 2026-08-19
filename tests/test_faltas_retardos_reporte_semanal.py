"""Reporte semanal de incidencias en Excel (botón «Descargar Reporte»).

El endpoint entrega los datos ya cuadriculados: un renglón por empleado de la plantilla
activa y una celda por cada una de las TRES semanas anteriores a la de la descarga —la
actual queda fuera a propósito—. El archivo lo arma el frontend con `xlsx`.

Lo que estos tests fijan: el cálculo de semanas en los bordes (cambio de mes y de año),
que un evento con rango se reparta en todas las semanas que toca sin abrir renglones
nuevos, y que el alcance por rol siga aplicando.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.services.faltas_retardos.constants import TIPO_A_CODIGO_REPORTE
from app.services.faltas_retardos.reporte_semanal import (
    SEMANAS_REPORTE,
    celdas_por_empleado,
    rango_cubierto,
    semanas_previas,
)
from tests.conftest import auth_headers, make_empleado, make_incidencia_tress


# ── Cálculo de semanas (puro) ─────────────────────────────────────────────────


def test_son_las_tres_semanas_anteriores_sin_la_actual():
    # Miércoles 19 de agosto de 2026: semana ISO 34.
    hoy = date(2026, 8, 19)
    assert hoy.isocalendar()[1] == 34

    semanas = semanas_previas(hoy)

    assert [s.numero for s in semanas] == [31, 32, 33]
    assert [s.etiqueta for s in semanas] == ["Semana 31", "Semana 32", "Semana 33"]
    # De lunes a domingo, y el rango termina el día anterior al lunes de la semana en curso.
    assert semanas[0].lunes == date(2026, 7, 27)
    assert semanas[-1].domingo == date(2026, 8, 16)
    assert rango_cubierto(semanas) == (date(2026, 7, 27), date(2026, 8, 16))


def test_las_semanas_cruzan_el_cambio_de_mes():
    # Las tres previas al 5 de marzo de 2026 arrancan en febrero.
    semanas = semanas_previas(date(2026, 3, 5))
    assert semanas[0].lunes == date(2026, 2, 9)
    assert semanas[-1].domingo == date(2026, 3, 1)
    assert [s.numero for s in semanas] == [7, 8, 9]


def test_las_semanas_cruzan_el_cambio_de_anio():
    """En enero, restar al *número* de semana daría 0 y negativos: se resta a la fecha."""
    semanas = semanas_previas(date(2027, 1, 14))  # semana ISO 2

    assert [(s.anio, s.numero) for s in semanas] == [(2026, 52), (2026, 53), (2027, 1)]
    assert semanas[0].lunes == date(2026, 12, 21)
    assert semanas[-1].domingo == date(2027, 1, 10)


def test_el_lunes_pertenece_a_la_semana_en_curso():
    """Descargar un lunes devuelve las tres semanas cerradas, no dos y media."""
    semanas = semanas_previas(date(2026, 8, 17))  # lunes, semana 34
    assert [s.numero for s in semanas] == [31, 32, 33]
    assert semanas[-1].domingo == date(2026, 8, 16)


def test_todo_tipo_del_catalogo_tiene_codigo():
    """Un tipo nuevo sin código saldría con la celda vacía y nadie lo notaría."""
    faltantes = [t for t in FALTA_RETARDO_TIPOS if t not in TIPO_A_CODIGO_REPORTE]
    assert faltantes == []
    assert set(TIPO_A_CODIGO_REPORTE) <= set(FALTA_RETARDO_TIPOS)


# ── Reparto de códigos por celda (puro) ───────────────────────────────────────


def _semanas_ago():
    return semanas_previas(date(2026, 8, 19))


def test_varias_incidencias_de_una_semana_van_en_la_misma_celda():
    semanas = _semanas_ago()  # 31: 27/07–02/08, 32: 03–09/08, 33: 10–16/08
    eventos = [
        {"no_empleado": 1001, "tipo": "falta_injustificada", "fecha_evento": date(2026, 7, 28), "fecha_fin": None},
        {"no_empleado": 1001, "tipo": "retardo", "fecha_evento": date(2026, 7, 30), "fecha_fin": None},
        {"no_empleado": 1001, "tipo": "vacaciones", "fecha_evento": date(2026, 8, 4), "fecha_fin": None},
    ]

    celdas = celdas_por_empleado(eventos, semanas)

    assert celdas[1001] == ["FI, RE", "VAC", ""]


def test_dos_retardos_de_la_misma_semana_no_se_deduplican():
    semanas = _semanas_ago()
    eventos = [
        {"no_empleado": 7, "tipo": "retardo", "fecha_evento": date(2026, 8, 11), "fecha_fin": None},
        {"no_empleado": 7, "tipo": "retardo", "fecha_evento": date(2026, 8, 13), "fecha_fin": None},
    ]

    assert celdas_por_empleado(eventos, semanas)[7] == ["", "", "RE, RE"]


def test_un_evento_con_rango_aparece_en_cada_semana_que_toca():
    """Una incapacidad de tres semanas es una sola incidencia partida por el calendario."""
    semanas = _semanas_ago()
    eventos = [
        {
            "no_empleado": 42,
            "tipo": "incapacidad",
            "fecha_evento": date(2026, 7, 29),
            "fecha_fin": date(2026, 8, 12),
        }
    ]

    assert celdas_por_empleado(eventos, semanas)[42] == ["INC", "INC", "INC"]


def test_los_eventos_fuera_de_las_tres_semanas_no_entran():
    semanas = _semanas_ago()
    eventos = [
        {"no_empleado": 9, "tipo": "retardo", "fecha_evento": date(2026, 8, 18), "fecha_fin": None},  # semana actual
        {"no_empleado": 9, "tipo": "retardo", "fecha_evento": date(2026, 7, 20), "fecha_fin": None},  # semana 30
    ]

    assert celdas_por_empleado(eventos, semanas) == {}


def test_el_permiso_con_goce_sale_como_fj_y_la_incapacidad_interna_como_inc1():
    semanas = _semanas_ago()
    eventos = [
        {"no_empleado": 3, "tipo": "matrimonio", "fecha_evento": date(2026, 8, 3), "fecha_fin": date(2026, 8, 4)},
        {"no_empleado": 4, "tipo": "incapacidad_interna", "fecha_evento": date(2026, 8, 5), "fecha_fin": None},
    ]

    celdas = celdas_por_empleado(eventos, semanas)
    assert celdas[3] == ["", "FJ", ""]
    assert celdas[4] == ["", "INC1", ""]


# ── Endpoint ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reporte_trae_una_fila_por_empleado_y_tres_columnas(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=1001, nombre="Juan Pérez")
    await make_empleado(db, empleado_id=11, no_empleado=1002, nombre="María López")

    # Dos incidencias del mismo empleado en la misma semana: una sola celda, un renglón.
    hoy = date.today()
    lunes_semana_pasada = hoy - __import__("datetime").timedelta(days=hoy.weekday() + 7)
    for i, tipo in enumerate(("falta_injustificada", "retardo")):
        await make_incidencia_tress(
            db,
            origen_id=i + 1,
            no_empleado=1001,
            empleado_id=10,
            tipo=tipo,
            fecha_evento=lunes_semana_pasada,
        )

    resp = await client.get(
        "/api/v1/faltas-retardos/reporte-semanal", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["semanas"]) == SEMANAS_REPORTE
    assert [s["etiqueta"] for s in data["semanas"]] == [
        f"Semana {s['numero']}" for s in data["semanas"]
    ]

    filas = {item["no_empleado"]: item for item in data["items"]}
    # La plantilla activa completa, no solo quien tuvo incidencias.
    assert {100, 1001, 1002} <= set(filas)
    assert len(data["items"]) == len(filas), "cada empleado debe salir una sola vez"
    for item in data["items"]:
        assert len(item["semanas"]) == SEMANAS_REPORTE

    assert filas[1001]["nombre"] == "Juan Pérez"
    assert filas[1001]["semanas"][-1] == "FI, RE"
    assert filas[1002]["semanas"] == ["", "", ""]


@pytest.mark.asyncio
async def test_la_semana_en_curso_no_aparece_en_el_reporte(db, client: AsyncClient):
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=1001, nombre="Juan Pérez")
    await make_incidencia_tress(
        db,
        origen_id=1,
        no_empleado=1001,
        empleado_id=10,
        tipo="retardo",
        fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos/reporte-semanal", headers=await auth_headers(client, rh)
    )

    assert resp.status_code == 200
    filas = {item["no_empleado"]: item for item in resp.json()["items"]}
    assert filas[1001]["semanas"] == ["", "", ""]


@pytest.mark.asyncio
@pytest.mark.parametrize("rol", ["supervisor", "gerente", "director"])
async def test_el_reporte_es_solo_de_rh(db, client: AsyncClient, rol: str):
    """Quien consulta la página no descarga el reporte: es una superficie de RH.

    Los GET del listado y de estadísticas siguen abiertos a estos roles —ven lo que llega
    de nómina—, pero el botón no se les pinta y el endpoint tampoco les responde.
    """
    usuario = await make_empleado(
        db, empleado_id=20, no_empleado=200, nombre="Gestor", rol=rol
    )

    resp = await client.get(
        "/api/v1/faltas-retardos/reporte-semanal",
        headers=await auth_headers(client, usuario),
    )

    assert resp.status_code == 403

    # El listado sí sigue disponible para el mismo usuario: el cierre es del reporte.
    listado = await client.get(
        "/api/v1/faltas-retardos", headers=await auth_headers(client, usuario)
    )
    assert listado.status_code == 200
