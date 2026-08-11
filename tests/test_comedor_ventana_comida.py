"""Ajustes Comedor: empleado + fecha → turno → posición del ciclo → jornada → comida.

Cubre los escenarios que pidió el requerimiento, con los patrones **reales** de TRESS.
La regla que atraviesa todo el archivo: cuando no hay ventana de comida, la respuesta
dice por qué. Un día de descanso, una jornada que nadie configuró y un turno cuyo patrón
no se interpreta son tres cosas distintas y se atienden distinto.
"""

from datetime import date, datetime, time

import pytest

from app.services.comedor_ventana_comida_service import ComedorVentanaComidaService
from tests.conftest import (
    make_horario,
    make_turno,
    make_turno_empleado,
    make_turno_uso,
    make_ventana_comida,
    reset_turnos_horario,
)

# Patrón real de ROT321, ciclo de 21 días:
#   días 1-5 jornada 003 · 6-7 descanso · 8-12 jornada 002 · 13 jornada 006
#   · 14 descanso · 15-20 jornada 001 · 21 descanso
ROT_PAT = "5:003,2:002,5:002,0,1:006,1:002,6:001,1:001"
ROT_INI = datetime(2020, 3, 9)

# Ciclo corto con el mismo formato, para probar el salto noche → mañana:
#   días 1-2 jornada 003 (noche) · 3-4 jornada 001 (mañana) · 5-6 descanso
NOCHE_MANANA_PAT = "2:003,0,2:001,2:001"
NOCHE_MANANA_INI = datetime(2026, 1, 1)


@pytest.fixture(autouse=True)
async def _reset(db):
    await reset_turnos_horario(db)
    yield


async def _catalogo(db):
    """Jornadas reales de la planta, con su ventana de comida configurada."""
    await make_horario(db, "001", "Matutino 6:00 - 14:00", intime="0600", outtime="1400")
    await make_horario(db, "002", "Vespertino 14:00 - 22:00", intime="1400", outtime="2200")
    await make_horario(db, "003", "Nocturno 22:00 - 06:00", intime="2200", outtime="0600")
    await make_horario(db, "006", "Vespertino 14:00 - 19:00", intime="1400", outtime="1900")
    await make_horario(db, "005A", "Mixto 08:00-17:30", intime="0800", outtime="1730")
    await make_ventana_comida(db, "001", time(10, 0), time(10, 30))
    await make_ventana_comida(db, "003", time(1, 0), time(1, 30))
    await make_ventana_comida(db, "005A", time(13, 0), time(14, 0))


# ───────────────────────────── turno fijo ─────────────────────────────


@pytest.mark.asyncio
async def test_empleado_con_turno_fijo_recibe_la_ventana_de_su_jornada(db):
    await _catalogo(db)
    await make_turno(
        db, "05A", "Mixto administrativo", tips=(0, 0, 0, 0, 0, 2, 2), hors=("005A",) * 7
    )
    await make_turno_empleado(db, "25", "Ana", tu_codigo="05A")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=25, fecha=date(2026, 8, 11)  # martes
    )

    assert res.tipo_turno == "FIJO"
    assert res.estatus == "LABORABLE"
    assert res.ho_codigo == "005A"
    assert (res.hora_inicio_comida, res.hora_fin_comida) == (time(13, 0), time(14, 0))
    assert res.motivo_sin_ventana is None


@pytest.mark.asyncio
async def test_el_fin_de_semana_de_un_turno_fijo_es_descanso_sin_comida(db):
    await _catalogo(db)
    await make_turno(
        db, "05A", "Mixto administrativo", tips=(0, 0, 0, 0, 0, 2, 2), hors=("005A",) * 7
    )
    await make_turno_empleado(db, "25", "Ana", tu_codigo="05A")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=25, fecha=date(2026, 8, 15)  # sábado
    )

    assert res.estatus == "DESCANSO"
    assert res.motivo_sin_ventana == "DESCANSO"
    assert res.hora_inicio_comida is None


# ───────────────────────────── turno rotativo ─────────────────────────────


async def _sembrar_rotativo(db, *, pat=ROT_PAT, ini=ROT_INI, no_empleado="80"):
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=pat, rit_ini=ini)
    await make_turno_empleado(db, no_empleado, "Beto", tu_codigo="ROT321")


@pytest.mark.asyncio
async def test_empleado_rotativo_recibe_la_ventana_del_segmento_del_dia(db):
    await _sembrar_rotativo(db)
    svc = ComedorVentanaComidaService(db)

    # Día 1 del ciclo: jornada 003 (nocturno).
    res = await svc.ventana_por_empleado(no_empleado=80, fecha=ROT_INI.date())

    assert res.tipo_turno == "ROTATIVO"
    assert (res.posicion_ciclo, res.longitud_ciclo) == (1, 21)
    assert res.ho_codigo == "003"
    assert (res.hora_inicio_comida, res.hora_fin_comida) == (time(1, 0), time(1, 30))


@pytest.mark.asyncio
async def test_el_primer_dia_del_ciclo_es_la_fecha_ancla(db):
    await _sembrar_rotativo(db)
    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=80, fecha=ROT_INI.date()
    )
    assert res.posicion_ciclo == 1


@pytest.mark.asyncio
async def test_el_dia_de_descanso_del_ciclo_no_recibe_comida(db):
    await _sembrar_rotativo(db)
    from datetime import timedelta

    # Día 6 del ciclo: primer día de descanso.
    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=80, fecha=(ROT_INI + timedelta(days=5)).date()
    )

    assert res.posicion_ciclo == 6
    assert res.estatus == "DESCANSO"
    assert res.motivo_sin_ventana == "DESCANSO"
    assert res.hora_inicio_comida is None
    assert res.ho_codigo is None


@pytest.mark.asyncio
async def test_al_cambiar_de_segmento_nocturno_a_matutino_cambia_la_comida(db):
    await _catalogo(db)
    await make_turno(
        db, "GX", "Rotativo corto", rit_pat=NOCHE_MANANA_PAT, rit_ini=NOCHE_MANANA_INI
    )
    await make_turno_empleado(db, "406", "Carla", tu_codigo="GX")
    svc = ComedorVentanaComidaService(db)

    noche = await svc.ventana_por_empleado(no_empleado=406, fecha=date(2026, 1, 2))
    manana = await svc.ventana_por_empleado(no_empleado=406, fecha=date(2026, 1, 3))

    assert (noche.ho_codigo, noche.hora_inicio_comida) == ("003", time(1, 0))
    assert (manana.ho_codigo, manana.hora_inicio_comida) == ("001", time(10, 0))


@pytest.mark.parametrize(
    "desde,hasta",
    [
        (date(2026, 1, 31), date(2026, 2, 1)),  # cambio de mes
        (date(2025, 12, 31), date(2026, 1, 1)),  # cambio de año
    ],
)
@pytest.mark.asyncio
async def test_el_ciclo_no_salta_al_cruzar_mes_o_ano(db, desde, hasta):
    await _sembrar_rotativo(db)
    svc = ComedorVentanaComidaService(db)

    antes = await svc.ventana_por_empleado(no_empleado=80, fecha=desde)
    despues = await svc.ventana_por_empleado(no_empleado=80, fecha=hasta)

    assert despues.posicion_ciclo == (antes.posicion_ciclo % 21) + 1


# ───────────────────────────── altas, bajas y cambios ─────────────────────────────


@pytest.mark.asyncio
async def test_empleado_que_cambio_de_rotacion_usa_su_turno_vigente(db):
    """El turno es una foto del último sync, y la respuesta lo declara."""
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno(
        db, "GX", "Rotativo corto", rit_pat=NOCHE_MANANA_PAT, rit_ini=NOCHE_MANANA_INI
    )
    fila = await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    svc = ComedorVentanaComidaService(db)

    antes = await svc.ventana_por_empleado(no_empleado=80, fecha=date(2026, 1, 3))
    assert antes.tu_codigo == "ROT321"

    fila.tu_codigo = "GX"
    fila.sincronizado_en = datetime(2026, 8, 11, 4, 20)
    await db.flush()

    despues = await svc.ventana_por_empleado(no_empleado=80, fecha=date(2026, 1, 3))
    assert despues.tu_codigo == "GX"
    assert despues.ho_codigo == "001"
    assert despues.turno_sincronizado_en is not None


@pytest.mark.asyncio
async def test_empleado_nuevo_sin_sincronizar_no_inventa_una_ventana(db):
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=99999, fecha=date(2026, 8, 11)
    )

    assert res.motivo_sin_ventana == "SIN_TURNO"
    assert res.hora_inicio_comida is None
    assert res.aviso is not None


@pytest.mark.asyncio
async def test_empleado_con_turno_que_la_replica_no_tiene_se_degrada(db):
    """TRESS puede tener un turno que el catálogo replicado todavía no incluya."""
    await _catalogo(db)
    await make_turno_empleado(db, "80", "Beto", tu_codigo="LCI")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=80, fecha=date(2026, 8, 11)
    )

    assert res.motivo_sin_ventana == "TURNO_FUERA_DE_CATALOGO"
    assert res.tu_codigo == "LCI"


@pytest.mark.asyncio
async def test_el_numero_de_empleado_con_sufijo_punto_cero_resuelve_igual(db):
    """El seed viejo de Excel dejó filas como "553.0"."""
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_empleado(db, "553.0", "Dora", tu_codigo="ROT321")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=553, fecha=ROT_INI.date()
    )

    assert res.tu_codigo == "ROT321"
    assert res.ho_codigo == "003"


# ───────────────────────────── configuración de la jornada ─────────────────────────────


@pytest.mark.asyncio
async def test_una_jornada_sin_configurar_no_devuelve_horas_inventadas(db):
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    from datetime import timedelta

    # Día 8 del ciclo: jornada 002, que a propósito no tiene ventana configurada.
    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=80, fecha=(ROT_INI + timedelta(days=7)).date()
    )

    assert res.ho_codigo == "002"
    assert res.motivo_sin_ventana == "JORNADA_SIN_CONFIGURAR"
    assert res.hora_inicio_comida is None
    # La jornada sí se identifica, aunque no tenga comida configurada.
    assert res.hora_entrada == time(14, 0)


@pytest.mark.asyncio
async def test_cambiar_la_ventana_de_una_jornada_alcanza_a_todos_sus_turnos(db):
    """Es el efecto buscado del modelo por jornada, y la razón de avisarlo en la UI."""
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno(
        db, "GX", "Rotativo corto", rit_pat=NOCHE_MANANA_PAT, rit_ini=NOCHE_MANANA_INI
    )
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    await make_turno_empleado(db, "406", "Carla", tu_codigo="GX")
    svc = ComedorVentanaComidaService(db)

    ventana = await svc.repo.get_ventana("003")
    ventana.hora_inicio_comida = time(2, 0)
    ventana.hora_fin_comida = time(2, 30)
    await db.flush()

    uno = await svc.ventana_por_empleado(no_empleado=80, fecha=ROT_INI.date())
    otro = await svc.ventana_por_empleado(no_empleado=406, fecha=date(2026, 1, 1))

    assert uno.hora_inicio_comida == time(2, 0)
    assert otro.hora_inicio_comida == time(2, 0)


@pytest.mark.asyncio
async def test_una_ventana_que_cruza_medianoche_se_conserva(db):
    """La jornada de 18:00-06:00 come cerca de medianoche; el modelo tiene que admitirlo."""
    await make_horario(db, "011", "18:00 a 06:00", intime="1800", outtime="0600")
    await make_ventana_comida(db, "011", time(23, 30), time(0, 30))
    await make_turno(db, "GA1", "Grupo 1", rit_pat="2:011,0,2:011", rit_ini=datetime(2026, 1, 1))
    await make_turno_empleado(db, "2294", "Eva", tu_codigo="GA1")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=2294, fecha=date(2026, 1, 1)
    )

    assert (res.hora_inicio_comida, res.hora_fin_comida) == (time(23, 30), time(0, 30))


# ───────────────────────────── turnos que no se pueden calcular ─────────────────────────────


@pytest.mark.asyncio
async def test_un_patron_no_interpretable_degrada_en_vez_de_reventar(db):
    await _catalogo(db)
    await make_turno(
        db, "GS1", "Grupo Seguridad 1", rit_pat="1:026S,0,1:024S", rit_ini=datetime(2018, 9, 17)
    )
    await make_turno_empleado(db, "700", "Fito", tu_codigo="GS1")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=700, fecha=date(2026, 8, 11)
    )

    assert res.motivo_sin_ventana == "PATRON_INVALIDO"
    assert res.aviso is not None


@pytest.mark.asyncio
async def test_un_rotativo_sin_ancla_no_devuelve_una_posicion_falsa(db):
    """`1899-12-30` es el "vacío" de TRESS; usarlo daría una posición creíble y errónea."""
    await _catalogo(db)
    await make_turno(db, "ROTX", "Sin ancla", rit_pat=ROT_PAT)  # rit_ini por defecto
    await make_turno_empleado(db, "701", "Gina", tu_codigo="ROTX")

    res = await ComedorVentanaComidaService(db).ventana_por_empleado(
        no_empleado=701, fecha=date(2026, 8, 11)
    )

    assert res.motivo_sin_ventana == "ANCLA_INVALIDA"
    assert res.posicion_ciclo is None


# ───────────────────────────── resumen de turnos y jornadas ─────────────────────────────


@pytest.mark.asyncio
async def test_el_resumen_agrupa_el_ciclo_y_cuenta_las_jornadas_configuradas(db):
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_uso(db, "ROT321", 61)

    items = await ComedorVentanaComidaService(db).resumen_turnos()
    turno = next(i for i in items if i.tu_codigo == "ROT321")

    assert turno.tipo_turno == "ROTATIVO"
    assert turno.longitud_ciclo == 21
    # 7 bloques en vez de 21 renglones.
    assert len(turno.bloques) == 7
    assert turno.jornadas == ["003", "002", "006", "001"]
    # Solo 003 y 001 tienen ventana en este catálogo.
    assert turno.jornadas_configuradas == 2
    assert turno.empleados_activos == 61


@pytest.mark.asyncio
async def test_los_bloques_de_descanso_nunca_traen_ventana(db):
    await _catalogo(db)
    # Jornada 001 configurada y usada tanto en fase hábil como en fase descanso.
    await make_turno(db, "GX", "Corto", rit_pat="2:001,2:001", rit_ini=datetime(2026, 1, 1))

    items = await ComedorVentanaComidaService(db).resumen_turnos(solo_en_uso=False)
    turno = next(i for i in items if i.tu_codigo == "GX")
    descanso = [b for b in turno.bloques if b.estatus == "DESCANSO"]

    assert descanso and all(b.hora_inicio_comida is None for b in descanso)
    assert all(b.configurada is False for b in descanso)


@pytest.mark.asyncio
async def test_un_turno_sin_personal_no_se_cuela_por_compartir_jornada(db):
    """Con la configuración por jornada, «lo ya configurado no se oculta» rompería el filtro.

    La jornada 001 la comparten 16 turnos del catálogo. Si configurar esa jornada bastara
    para exentar del filtro a todos ellos, «solo turnos en uso» dejaría de filtrar.
    """
    await _catalogo(db)  # 001 y 003 quedan configuradas
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno(db, "ZZZ", "Turno sin gente", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_uso(db, "ROT321", 61)

    items = await ComedorVentanaComidaService(db).resumen_turnos()

    assert {i.tu_codigo for i in items} == {"ROT321"}


@pytest.mark.asyncio
async def test_el_alcance_de_una_jornada_solo_cuenta_turnos_con_personal(db):
    """«Afecta a G5, G7» es accionable; enumerar turnos vacíos no dice nada."""
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno(db, "ZZZ", "Turno sin gente", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_uso(db, "ROT321", 61)

    jornadas = await ComedorVentanaComidaService(db).listar_jornadas()
    nocturna = next(j for j in jornadas if j.ho_codigo == "003")

    assert nocturna.turnos == ["ROT321"]
    assert nocturna.empleados_activos == 61


@pytest.mark.asyncio
async def test_la_jornada_declara_a_que_turnos_alcanza(db):
    await _catalogo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno(
        db, "GX", "Rotativo corto", rit_pat=NOCHE_MANANA_PAT, rit_ini=NOCHE_MANANA_INI
    )
    await make_turno_uso(db, "ROT321", 61)
    await make_turno_uso(db, "GX", 39)

    jornadas = await ComedorVentanaComidaService(db).listar_jornadas()
    nocturna = next(j for j in jornadas if j.ho_codigo == "003")

    assert nocturna.turnos == ["GX", "ROT321"]
    assert nocturna.empleados_activos == 100
    assert nocturna.hora_entrada == time(22, 0)
    assert nocturna.hora_salida == time(6, 0)
