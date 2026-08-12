"""Descansos proyectados desde Bono, sin tocar DATOS_ANALISIS.

La cadena es `empleado → turno vigente (levelup_turnos_empleados) → catálogo
(levelup_turnos) → jornadas (levelup_horarios) → proyección del ciclo`. No se consulta el
Kardex ni `dbo.AUSENCIA`: la proyección usa el turno vigente y falla cerrado cuando la
caché no alcanza.
"""

from datetime import date, datetime

import pytest

from app.core.exceptions import ServiceUnavailableError
from tests.conftest import make_empleado, make_horario, make_turno, make_turno_empleado


async def _sembrar_turno_fijo(db, no_empleado: int, *, tu_codigo: str = "F1"):
    """Turno fijo de lunes a sábado; domingo descansa (TU_TIP_7 = 2)."""
    await make_horario(db, "010", "Diurno", intime="0800", outtime="1700")
    await make_turno(
        db,
        tu_codigo,
        "Fijo L-S",
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("010", "010", "010", "010", "010", "010", ""),
    )
    await make_turno_empleado(db, str(no_empleado), "Test", tu_codigo=tu_codigo)
    await db.commit()


@pytest.mark.asyncio
async def test_turno_fijo_descansa_los_domingos(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await _sembrar_turno_fijo(db, 4001)

    # 2026-07-01 es miércoles; los domingos del rango son 5, 12, 19 y 26 de julio.
    descansos = await obtener_descansos_bono(
        db, cb_codigo=4001, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 31)
    )

    assert descansos == [date(2026, 7, 5), date(2026, 7, 12), date(2026, 7, 19), date(2026, 7, 26)]


@pytest.mark.asyncio
async def test_turno_rotativo_usa_el_patron_y_el_ancla(db):
    """Ciclo de 4 días: 2 laborables + 2 de descanso, anclado el 2026-07-01."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R1",
        "Rotativo 2x2",
        rit_pat="2:011,2:000",
        rit_ini=datetime(2026, 7, 1),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4002", "Rotativo", tu_codigo="R1")
    await db.commit()

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4002, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 8)
    )

    # 1 y 2 laborables, 3 y 4 descanso, 5 y 6 laborables, 7 y 8 descanso.
    assert descansos == [date(2026, 7, 3), date(2026, 7, 4), date(2026, 7, 7), date(2026, 7, 8)]


@pytest.mark.asyncio
async def test_no_abre_conexion_a_datos_analisis(db, monkeypatch):
    """Regresión del objetivo del cambio: cero ODBC en el camino de descansos."""
    from app.integrations import datos_analisis_db
    from app.services.descansos_empleado_service import obtener_descansos_bono

    def _prohibido(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("Los descansos no deben abrir un engine a datos-analisis")

    monkeypatch.setattr(
        datos_analisis_db.DatosAnalisisReadClient, "create_read_engine", _prohibido
    )
    await _sembrar_turno_fijo(db, 4003, tu_codigo="F3")

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4003, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
    )

    assert descansos == [date(2026, 7, 5)]


@pytest.mark.asyncio
async def test_falla_cerrado_sin_fila_en_la_cache_de_turnos(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    with pytest.raises(ServiceUnavailableError, match="no se ha sincronizado"):
        await obtener_descansos_bono(
            db, cb_codigo=4004, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_con_tu_codigo_vacio(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno_empleado(db, "4005", "Sin turno", tu_codigo=None)
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no se ha sincronizado"):
        await obtener_descansos_bono(
            db, cb_codigo=4005, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_turno_no_esta_en_el_catalogo(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno_empleado(db, "4006", "Turno fantasma", tu_codigo="ZZ")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="catálogo"):
        await obtener_descansos_bono(
            db, cb_codigo=4006, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_rotativo_no_tiene_ancla(db):
    """`tu_rit_ini = 1899-12-30` es el «vacío» de TRESS: daría una posición creíble y falsa."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R2",
        "Rotativo sin ancla",
        rit_pat="2:011,2:000",
        rit_ini=datetime(1899, 12, 30),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4007", "Sin ancla", tu_codigo="R2")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="inicio de ciclo"):
        await obtener_descansos_bono(
            db, cb_codigo=4007, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_patron_no_se_interpreta(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno(
        db,
        "R3",
        "Patrón inválido",
        rit_pat="esto-no-es-un-patron",
        rit_ini=datetime(2026, 7, 1),
    )
    await make_turno_empleado(db, "4008", "Patrón roto", tu_codigo="R3")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no interpreta"):
        await obtener_descansos_bono(
            db, cb_codigo=4008, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_la_fecha_es_anterior_al_ancla(db):
    """El motor no puede ubicar en el ciclo una fecha previa a `TU_RIT_INI`."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R4",
        "Rotativo reciente",
        rit_pat="2:011,2:000",
        rit_ini=datetime(2026, 7, 1),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4009", "Antes del ancla", tu_codigo="R4")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no se pudo calcular"):
        await obtener_descansos_bono(
            db, cb_codigo=4009, fecha_inicio=date(2026, 6, 1), fecha_fin=date(2026, 6, 7)
        )


@pytest.mark.asyncio
async def test_valida_el_rango_antes_de_tocar_la_bd(db):
    from app.core.exceptions import DomainValidationError
    from app.services.descansos_empleado_service import obtener_descansos_bono

    with pytest.raises(DomainValidationError, match="posterior"):
        await obtener_descansos_bono(
            db, cb_codigo=4010, fecha_inicio=date(2026, 7, 2), fecha_fin=date(2026, 7, 1)
        )

    with pytest.raises(DomainValidationError, match="366"):
        await obtener_descansos_bono(
            db, cb_codigo=4010, fecha_inicio=date(2025, 1, 1), fecha_fin=date(2026, 1, 2)
        )


@pytest.mark.asyncio
async def test_tolera_el_sufijo_punto_cero_del_seed_viejo(db):
    """El seed de Excel dejó números como "4011.0"; el turno debe encontrarse igual."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "010", "Diurno", intime="0800", outtime="1700")
    await make_turno(
        db,
        "F4",
        "Fijo L-S",
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("010", "010", "010", "010", "010", "010", ""),
    )
    await make_turno_empleado(db, "4011.0", "Sufijo viejo", tu_codigo="F4")
    await db.commit()

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4011, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
    )

    assert descansos == [date(2026, 7, 5)]


@pytest.mark.asyncio
async def test_endpoint_descansos_resuelve_no_empleado_y_ordena(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-emp@test")
    await _sembrar_turno_fijo(db, emp.no_empleado, tu_codigo="F9")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-14"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 200
    assert res.json() == {
        "empleado_id": emp.id,
        "no_empleado": emp.no_empleado,
        "fecha_inicio": "2026-07-01",
        "fecha_fin": "2026-07-14",
        "descansos": ["2026-07-05", "2026-07-12"],
    }


@pytest.mark.asyncio
async def test_endpoint_descansos_sin_turno_en_cache_devuelve_503(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-503-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-503-emp@test")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 503
    assert "no se ha sincronizado" in res.json()["detail"]


@pytest.mark.asyncio
async def test_endpoint_descansos_requiere_rol_de_directorio(client, db):
    from tests.conftest import auth_headers

    solicitante = await make_empleado(db, rol="empleado", email="descansos-no-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-objetivo@test")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, solicitante),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_endpoint_descansos_permite_ver_los_propios(client, db):
    """Cualquiera puede consultar sus propios descansos, sin rol de directorio.

    El formulario de nueva solicitud pinta el calendario con este endpoint y **bloquea el
    envío** mientras no lo haya cargado, así que exigir aquí rol de gestor dejaba a un
    colaborador de a pie sin poder pedir vacaciones.
    """
    from tests.conftest import auth_headers

    emp = await make_empleado(db, rol="empleado", email="descansos-propios@test")
    await _sembrar_turno_fijo(db, emp.no_empleado, tu_codigo="F9")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-07"},
        headers=await auth_headers(client, emp),
    )

    assert res.status_code == 200
    assert res.json()["descansos"] == ["2026-07-05"]


@pytest.mark.asyncio
async def test_endpoint_descansos_permite_supervisor_con_su_subordinado(client, db):
    from tests.conftest import auth_headers

    supervisor = await make_empleado(db, rol="supervisor", email="descansos-sup@test")
    emp = await make_empleado(
        db, rol="empleado", email="descansos-sup-obj@test", lider_id=supervisor.empleado_id
    )
    await _sembrar_turno_fijo(db, emp.no_empleado, tu_codigo="F8")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-07"},
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["descansos"] == ["2026-07-05"]


@pytest.mark.asyncio
async def test_endpoint_descansos_rechaza_empleado_fuera_del_alcance_del_supervisor(client, db):
    """Tener rol de gestor no basta: el colaborador debe estar en su equipo.

    Los días que alguien descansa son un dato personal, y el resto del módulo de
    empleados (Vista 360, métricas) ya se filtra por alcance. Sin esto, cualquier
    supervisor podía consultar el calendario de descansos de toda la planta.
    """
    from tests.conftest import auth_headers

    supervisor = await make_empleado(db, rol="supervisor", email="descansos-sup-ajeno@test")
    ajeno = await make_empleado(db, rol="empleado", email="descansos-ajeno@test")
    await _sembrar_turno_fijo(db, ajeno.no_empleado, tu_codigo="F7")

    res = await client.get(
        f"/api/v1/empleados/{ajeno.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-07"},
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_endpoint_descansos_permite_gerente_con_su_subarbol(client, db):
    """El gerente alcanza a todo su subárbol, no solo a sus reportes directos."""
    from tests.conftest import auth_headers

    gerente = await make_empleado(db, rol="gerente", email="descansos-ger@test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="descansos-ger-sup@test", lider_id=gerente.empleado_id
    )
    nieto = await make_empleado(
        db, rol="empleado", email="descansos-ger-nieto@test", lider_id=supervisor.empleado_id
    )
    await _sembrar_turno_fijo(db, nieto.no_empleado, tu_codigo="F6")

    res = await client.get(
        f"/api/v1/empleados/{nieto.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-07"},
        headers=await auth_headers(client, gerente),
    )

    assert res.status_code == 200
    assert res.json()["descansos"] == ["2026-07-05"]


@pytest.mark.asyncio
async def test_endpoint_descansos_rechaza_rango_mayor_a_366_dias(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-rango-rh@test")

    # El id no necesita existir: la validación de rango corta antes de buscar al empleado.
    res = await client.get(
        "/api/v1/empleados/99999999/descansos",
        params={"fecha_inicio": "2025-01-01", "fecha_fin": "2026-01-02"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 422


@pytest.mark.asyncio
async def test_endpoint_descansos_empleado_inexistente_404(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-404-rh@test")

    res = await client.get(
        "/api/v1/empleados/99999999/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 404
