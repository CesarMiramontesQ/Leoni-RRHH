"""HistorialObjetivoService -- agregador del índice objetivo (Tarea 4).

Mockea los repos/engine de bono (NUNCA toca la BD externa real). Cubre:
- indice_empleado con datos conocidos de las 3 fuentes -> índice/semáforo/desglose a mano.
- Engine único + dispose (incluso si la agregación falla).
- indice_equipo: scope de equipo, limit = tamaño del equipo (no 10), ranking peor-primero.
- Scoping: fuera de alcance -> 403; inexistente -> 404; RH ve a cualquiera.
- Bono no configurado -> degradación con gracia (solo actas).
- Tipo desconocido en conteos -> se ignora explícitamente (no rompe, se loguea).
- Progresivo no penaliza (v1).
- Firmas-espejo fase 2.
"""

from contextlib import contextmanager
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from app.models.actas import ActaAdministrativa
from app.services.historial_objetivo.constants import TIPO_PROGRESIVO_PIERDE_BONO
from app.services.historial_objetivo_service import HistorialObjetivoService
from app.services.incidencia_fuentes.constants import TIPO_INCIDENCIA_CALIDAD
from tests.conftest import make_empleado


async def _crear_acta(db, *, empleado_id: int, generado_por: int, estado: str = "signed"):
    acta = ActaAdministrativa(
        empleado_id=empleado_id,
        generado_por=generado_por,
        estado=estado,
        descripcion_hechos="Hechos de prueba",
        tipo_falta="Falta de prueba",
    )
    db.add(acta)
    await db.flush()
    await db.refresh(acta)
    return acta


@contextmanager
def _mock_bono_repos(
    *,
    incidencias_raw: list | None = None,
    faltas_raw: list | None = None,
    progresivo_raw: dict | None = None,
    engine_configurado: bool = True,
    incidencias_side_effect=None,
    faltas_side_effect=None,
):
    """Patchea `create_read_engine` + los tres repos de bono (incidencias,
    faltas y progresivo) en el namespace del service (igual patrón que
    `tests/test_faltas_retardos.py`). `progresivo_raw` es el dict
    `{empleado_id: semanas_sin_bono}` que devuelve
    `BonoProgresivoRepository.aggregate_semanas_sin_bono_por_empleado`."""
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()

    inc_mock = AsyncMock()
    if incidencias_side_effect is not None:
        inc_mock.aggregate_empleados_top_por_tipo = AsyncMock(side_effect=incidencias_side_effect)
    else:
        inc_mock.aggregate_empleados_top_por_tipo = AsyncMock(
            return_value=incidencias_raw if incidencias_raw is not None else []
        )

    falt_mock = AsyncMock()
    if faltas_side_effect is not None:
        falt_mock.aggregate_empleados_top_por_tipo = AsyncMock(side_effect=faltas_side_effect)
    else:
        falt_mock.aggregate_empleados_top_por_tipo = AsyncMock(
            return_value=faltas_raw if faltas_raw is not None else []
        )

    prog_mock = AsyncMock()
    prog_mock.aggregate_semanas_sin_bono_por_empleado = AsyncMock(
        return_value=progresivo_raw if progresivo_raw is not None else {}
    )

    with (
        patch(
            "app.services.historial_objetivo_service.BonoProductividadReadClient.create_read_engine",
            return_value=(mock_engine if engine_configurado else None),
        ),
        patch(
            "app.services.historial_objetivo_service.BonoHistoricoIncidenciasRepository",
            return_value=inc_mock,
        ),
        patch(
            "app.services.historial_objetivo_service.BonoFaltasRetardosRepository",
            return_value=falt_mock,
        ),
        patch(
            "app.services.historial_objetivo_service.BonoProgresivoRepository",
            return_value=prog_mock,
        ),
    ):
        yield mock_engine, inc_mock, falt_mock


@pytest.mark.asyncio
async def test_indice_empleado_combina_las_tres_fuentes_y_calcula_a_mano(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh1@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp1@leoni.test")
    await _crear_acta(db, empleado_id=emp.empleado_id, generado_por=rh.empleado_id, estado="signed")

    incidencias_raw = [
        (emp.empleado_id, str(emp.no_empleado), emp.nombre, 1, {TIPO_INCIDENCIA_CALIDAD: 1})
    ]
    faltas_raw = [(emp.empleado_id, str(emp.no_empleado), emp.nombre, 1, {"RE": 1})]

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(incidencias_raw=incidencias_raw, faltas_raw=faltas_raw):
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    # A mano: actas signed=15*1=15, incidencia calidad=6*1=6, retardo=3*1=3 -> 24 -> indice 76 (amarillo)
    assert resultado.empleado_id == emp.empleado_id
    assert resultado.bono_disponible is True
    assert resultado.resultado.penalizacion_total == 24.0
    assert resultado.resultado.indice == 76.0
    assert resultado.resultado.semaforo == "amarillo"

    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    assert por_fuente["actas"].penalizacion == 15.0
    assert por_fuente["incidencias"].penalizacion == 6.0
    assert por_fuente["faltas"].penalizacion == 3.0
    assert por_fuente["progresivo"].penalizacion == 0.0
    assert por_fuente["progresivo"].tipos == ()


@pytest.mark.asyncio
async def test_engine_unico_se_abre_una_vez_y_dispose_se_invoca(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh2@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp2@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos() as (mock_engine, inc_mock, falt_mock):
        with patch(
            "app.services.historial_objetivo_service.BonoProductividadReadClient.create_read_engine",
            return_value=mock_engine,
        ) as create_engine_mock:
            await service.indice_empleado(rh, emp.empleado_id, None, None)

    create_engine_mock.assert_called_once()
    mock_engine.dispose.assert_awaited_once()
    inc_mock.aggregate_empleados_top_por_tipo.assert_awaited_once()
    falt_mock.aggregate_empleados_top_por_tipo.assert_awaited_once()


@pytest.mark.asyncio
async def test_engine_dispose_se_invoca_incluso_si_la_agregacion_falla(db):
    from sqlalchemy.exc import SQLAlchemyError

    from app.core.exceptions import ServiceUnavailableError

    rh = await make_empleado(db, rol="rh", email="ho_svc_rh3@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp3@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(
        incidencias_side_effect=SQLAlchemyError("boom")
    ) as (mock_engine, inc_mock, falt_mock):
        with pytest.raises(ServiceUnavailableError):
            await service.indice_empleado(rh, emp.empleado_id, None, None)

    mock_engine.dispose.assert_awaited_once()


@pytest.mark.asyncio
async def test_bono_no_configurado_degrada_a_solo_actas(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh4@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp4@leoni.test")
    await _crear_acta(db, empleado_id=emp.empleado_id, generado_por=rh.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(engine_configurado=False):
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.bono_disponible is False
    # Solo actas penaliza: signed=15 -> indice 85 (verde, límite exacto)
    assert resultado.resultado.penalizacion_total == 15.0
    assert resultado.resultado.indice == 85.0
    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    assert por_fuente["incidencias"].penalizacion == 0.0
    assert por_fuente["faltas"].penalizacion == 0.0


@pytest.mark.asyncio
async def test_progresivo_sin_semanas_no_penaliza(db):
    """Sin semanas sin bono (progresivo_raw vacio, el default del mock) la
    fuente progresivo penaliza 0 y el indice queda en 100. Antes se llamaba
    `_v1` por la fase en que progresivo nunca penalizaba; hoy progresivo SI
    penaliza cuando hay semanas (ver `test_progresivo_penaliza_indice_empleado`)
    -- este test blinda el caso complementario: sin semanas, no toca el indice."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh5@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp5@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.resultado.indice == 100.0
    assert resultado.resultado.semaforo == "verde"
    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    assert por_fuente["progresivo"].penalizacion == 0.0


@pytest.mark.asyncio
async def test_tipo_desconocido_en_incidencias_se_ignora_y_no_rompe(db, caplog):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh6@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp6@leoni.test")

    incidencias_raw = [
        (
            emp.empleado_id,
            str(emp.no_empleado),
            emp.nombre,
            2,
            {TIPO_INCIDENCIA_CALIDAD: 1, "tipo_fantasma_no_registrado": 1},
        )
    ]

    service = HistorialObjetivoService(db)
    with caplog.at_level("WARNING"):
        with _mock_bono_repos(incidencias_raw=incidencias_raw):
            resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    # Solo penaliza el tipo conocido (calidad=6); el desconocido se ignora.
    assert resultado.resultado.penalizacion_total == 6.0
    assert resultado.resultado.indice == 94.0
    assert any("tipo_fantasma_no_registrado" in msg for msg in caplog.messages)


@pytest.mark.asyncio
async def test_tipo_desconocido_en_codigo_faltas_se_ignora_y_no_rompe(db, caplog):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh7@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp7@leoni.test")

    faltas_raw = [
        (emp.empleado_id, str(emp.no_empleado), emp.nombre, 2, {"RE": 1, "ZZZ_CODIGO_NUEVO": 1})
    ]

    service = HistorialObjetivoService(db)
    with caplog.at_level("WARNING"):
        with _mock_bono_repos(faltas_raw=faltas_raw):
            resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.resultado.penalizacion_total == 3.0
    assert any("ZZZ_CODIGO_NUEVO" in msg for msg in caplog.messages)


@pytest.mark.asyncio
async def test_indice_empleado_fuera_de_scope_da_forbidden(db):
    jefe_a = await make_empleado(db, rol="supervisor", email="ho_svc_jefeA@leoni.test")
    jefe_b = await make_empleado(db, rol="supervisor", email="ho_svc_jefeB@leoni.test")
    emp_de_b = await make_empleado(
        db, rol="empleado", email="ho_svc_empB@leoni.test", lider_id=jefe_b.empleado_id
    )

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        with pytest.raises(ForbiddenError):
            await service.indice_empleado(jefe_a, emp_de_b.empleado_id, None, None)


@pytest.mark.asyncio
async def test_indice_empleado_inexistente_da_404(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh8@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        with pytest.raises(NotFoundError):
            await service.indice_empleado(rh, 999_999_999, None, None)


@pytest.mark.asyncio
async def test_rh_ve_a_cualquier_empleado(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh9@leoni.test")
    otro_jefe = await make_empleado(db, rol="supervisor", email="ho_svc_jefeC@leoni.test")
    emp = await make_empleado(
        db, rol="empleado", email="ho_svc_empC@leoni.test", lider_id=otro_jefe.empleado_id
    )

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.empleado_id == emp.empleado_id


@pytest.mark.asyncio
async def test_rango_de_fechas_invalido_da_422(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_rh10@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_emp10@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        with pytest.raises(DomainValidationError):
            await service.indice_empleado(
                rh, emp.empleado_id, date(2026, 6, 1), date(2026, 1, 1)
            )


@pytest.mark.asyncio
async def test_indice_equipo_supervisor_solo_ve_su_equipo_y_limit_es_tamano_del_equipo(db):
    jefe_a = await make_empleado(db, rol="supervisor", email="ho_svc_eq_jefeA@leoni.test")
    emp_a1 = await make_empleado(
        db, rol="empleado", email="ho_svc_eq_a1@leoni.test", lider_id=jefe_a.empleado_id
    )
    jefe_b = await make_empleado(db, rol="supervisor", email="ho_svc_eq_jefeB@leoni.test")
    emp_b1 = await make_empleado(
        db, rol="empleado", email="ho_svc_eq_b1@leoni.test", lider_id=jefe_b.empleado_id
    )

    await _crear_acta(db, empleado_id=emp_a1.empleado_id, generado_por=jefe_a.empleado_id, estado="signed")
    await _crear_acta(db, empleado_id=emp_b1.empleado_id, generado_por=jefe_b.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos() as (_engine, inc_mock, falt_mock):
        resultado = await service.indice_equipo(jefe_a, None, None)

    ids_en_resultado = {item.empleado_id for item in resultado.items}
    # El equipo de jefe_a es {jefe_a, emp_a1} (equipo = subordinados directos + él mismo).
    assert ids_en_resultado == {jefe_a.empleado_id, emp_a1.empleado_id}
    assert emp_b1.empleado_id not in ids_en_resultado

    # limit pasado a las agregaciones de bono == tamaño del equipo (2), no 10.
    _, kwargs_inc = inc_mock.aggregate_empleados_top_por_tipo.await_args
    assert kwargs_inc["limit"] == 2
    _, kwargs_falt = falt_mock.aggregate_empleados_top_por_tipo.await_args
    assert kwargs_falt["limit"] == 2


@pytest.mark.asyncio
async def test_indice_equipo_ranking_ordenado_peor_primero(db):
    jefe = await make_empleado(db, rol="supervisor", email="ho_svc_rank_jefe@leoni.test")
    bueno = await make_empleado(
        db, rol="empleado", email="ho_svc_rank_bueno@leoni.test", lider_id=jefe.empleado_id
    )
    malo = await make_empleado(
        db, rol="empleado", email="ho_svc_rank_malo@leoni.test", lider_id=jefe.empleado_id
    )

    await _crear_acta(db, empleado_id=malo.empleado_id, generado_por=jefe.empleado_id, estado="signed")
    # bueno: sin eventos -> índice 100.

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_equipo(jefe, None, None)

    indices = [item.resultado.indice for item in resultado.items]
    assert indices == sorted(indices)  # ascendente == peor primero
    assert resultado.items[0].empleado_id == malo.empleado_id


@pytest.mark.asyncio
async def test_indice_equipo_ranking_ordenado_peor_primero_con_tres_indices_distintos(db):
    """Hueco T8 #4: `test_indice_equipo_ranking_ordenado_peor_primero` ya
    cubre 2 empleados (uno malo, uno perfecto) -- aqui se verifica el orden
    explicito con >=3 empleados de indices distintos (no solo que la lista
    quede ordenada de forma trivial con un solo par)."""
    jefe = await make_empleado(db, rol="supervisor", email="ho_svc_rank3_jefe@leoni.test")
    excelente = await make_empleado(
        db, rol="empleado", email="ho_svc_rank3_excelente@leoni.test", lider_id=jefe.empleado_id
    )
    medio = await make_empleado(
        db, rol="empleado", email="ho_svc_rank3_medio@leoni.test", lider_id=jefe.empleado_id
    )
    pesimo = await make_empleado(
        db, rol="empleado", email="ho_svc_rank3_pesimo@leoni.test", lider_id=jefe.empleado_id
    )

    # excelente: sin eventos -> indice 100.
    # medio: 1 acta signed (15) -> indice 85.
    await _crear_acta(db, empleado_id=medio.empleado_id, generado_por=jefe.empleado_id, estado="signed")
    # pesimo: 2 actas signed (30) -> indice 70.
    await _crear_acta(db, empleado_id=pesimo.empleado_id, generado_por=jefe.empleado_id, estado="signed")
    await _crear_acta(db, empleado_id=pesimo.empleado_id, generado_por=jefe.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_equipo(jefe, None, None)

    # jefe (sin actas propias) tambien queda en indice 100 -- empatado con
    # excelente. El orden relativo entre pesimo/medio/excelente es lo que
    # importa aqui (peor primero); no se fija una posicion para el empate.
    orden_ids = [item.empleado_id for item in resultado.items]
    assert orden_ids.index(pesimo.empleado_id) < orden_ids.index(medio.empleado_id)
    assert orden_ids.index(medio.empleado_id) < orden_ids.index(excelente.empleado_id)

    indices = [item.resultado.indice for item in resultado.items]
    assert indices == sorted(indices)  # ascendente == peor primero
    por_id = {item.empleado_id: item.resultado.indice for item in resultado.items}
    assert por_id[pesimo.empleado_id] == 70.0
    assert por_id[medio.empleado_id] == 85.0
    assert por_id[excelente.empleado_id] == 100.0


@pytest.mark.asyncio
async def test_indice_equipo_rh_sin_filtro_aplica_tope_alto_explicito(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_eq_rh@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos() as (_engine, inc_mock, falt_mock):
        await service.indice_equipo(rh, date(2026, 1, 1), date(2026, 6, 30))

    from app.services.historial_objetivo_service import TOPE_ALTO_EQUIPO

    _, kwargs_inc = inc_mock.aggregate_empleados_top_por_tipo.await_args
    assert kwargs_inc["limit"] == TOPE_ALTO_EQUIPO
    _, kwargs_falt = falt_mock.aggregate_empleados_top_por_tipo.await_args
    assert kwargs_falt["limit"] == TOPE_ALTO_EQUIPO


@pytest.mark.asyncio
async def test_indice_equipo_rh_sin_filtro_y_sin_rango_de_fechas_da_422(db):
    """Fix post-revisión: RH/director sin equipo delimitado (`scope_ids is
    None`) y sin rango de fechas debe rechazarse -- de lo contrario la
    consulta de actas corre sin filtro de empleado NI de fecha."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_eq_rh_sinrango@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        with pytest.raises(DomainValidationError):
            await service.indice_equipo(rh, None, None)
        with pytest.raises(DomainValidationError):
            await service.indice_equipo(rh, date(2026, 1, 1), None)
        with pytest.raises(DomainValidationError):
            await service.indice_equipo(rh, None, date(2026, 6, 30))


@pytest.mark.asyncio
async def test_indice_equipo_rh_sin_filtro_con_rango_de_fechas_funciona(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_eq_rh_conrango@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_eq_emp_conrango@leoni.test")
    await _crear_acta(db, empleado_id=emp.empleado_id, generado_por=rh.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_equipo(rh, date(2026, 1, 1), date(2026, 12, 31))

    ids_en_resultado = {item.empleado_id for item in resultado.items}
    assert emp.empleado_id in ids_en_resultado


@pytest.mark.asyncio
async def test_indice_equipo_supervisor_sin_rango_de_fechas_sigue_funcionando(db):
    """El requisito de rango de fechas aplica solo al universo sin acotar
    (scope_ids is None) -- un equipo delimitado (supervisor/gerente) no
    necesita rango explícito."""
    jefe = await make_empleado(db, rol="supervisor", email="ho_svc_eq_sup_sinrango@leoni.test")
    emp = await make_empleado(
        db, rol="empleado", email="ho_svc_eq_sup_sinrango_emp@leoni.test", lider_id=jefe.empleado_id
    )

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_equipo(jefe, None, None)

    ids_en_resultado = {item.empleado_id for item in resultado.items}
    assert ids_en_resultado == {jefe.empleado_id, emp.empleado_id}


@pytest.mark.asyncio
async def test_indice_equipo_resuelve_nombres_faltantes_en_una_sola_query_bulk(db):
    """Fix post-revisión (N+1): empleados sin eventos de bono en el rango
    deben resolver no_empleado/nombre con UNA sola query bulk, no una
    consulta puntual por empleado."""
    from app.repositories.empleado_repository import EmpleadoRepository

    jefe = await make_empleado(db, rol="supervisor", email="ho_svc_bulk_jefe@leoni.test")
    sin_bono_1 = await make_empleado(
        db, rol="empleado", email="ho_svc_bulk_1@leoni.test", lider_id=jefe.empleado_id
    )
    sin_bono_2 = await make_empleado(
        db, rol="empleado", email="ho_svc_bulk_2@leoni.test", lider_id=jefe.empleado_id
    )

    service = HistorialObjetivoService(db)

    async def _no_deberia_llamarse(*args, **kwargs):
        raise AssertionError(
            "N+1 detectado: get_by_empleado_id no debe llamarse dentro de indice_equipo"
        )

    with _mock_bono_repos():
        with patch.object(EmpleadoRepository, "get_by_empleado_id", _no_deberia_llamarse):
            with patch.object(
                EmpleadoRepository,
                "get_nombres_por_empleado_ids",
                wraps=service.empleado_repo.get_nombres_por_empleado_ids,
            ) as bulk_mock:
                resultado = await service.indice_equipo(jefe, None, None)

    bulk_mock.assert_called_once()

    por_id = {item.empleado_id: (item.no_empleado, item.nombre) for item in resultado.items}
    assert por_id[jefe.empleado_id] == (
        str(jefe.no_empleado) if jefe.no_empleado is not None else None,
        jefe.nombre,
    )
    assert por_id[sin_bono_1.empleado_id] == (
        str(sin_bono_1.no_empleado) if sin_bono_1.no_empleado is not None else None,
        sin_bono_1.nombre,
    )
    assert por_id[sin_bono_2.empleado_id] == (
        str(sin_bono_2.no_empleado) if sin_bono_2.no_empleado is not None else None,
        sin_bono_2.nombre,
    )


@pytest.mark.asyncio
async def test_indice_historial_empleado_mismo_calculo_sin_scoping(db):
    rh = await make_empleado(db, rol="rh", email="ho_svc_mirror_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_mirror_emp@leoni.test")
    await _crear_acta(db, empleado_id=emp.empleado_id, generado_por=rh.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        via_scope = await service.indice_empleado(rh, emp.empleado_id, None, None)
    with _mock_bono_repos():
        via_mirror = await service.indice_historial_empleado(emp.empleado_id, None, None)

    assert via_mirror == via_scope.resultado.indice


@pytest.mark.asyncio
async def test_indice_historial_empleado_o_none_degrada_si_no_existe(db):
    service = HistorialObjetivoService(db)
    with _mock_bono_repos():
        resultado = await service.indice_historial_empleado_o_none(999_999_999, None, None)
    assert resultado is None


# ── Bulk fase 2: indices_historial_por_empleado ──────────────────────────────


@pytest.mark.asyncio
async def test_indices_bulk_un_solo_engine_y_dispose(db):
    """Un solo engine de bono por llamada (no uno por empleado) + dispose, y el
    dict resultante cubre todos los ids con un indice float cada uno."""
    emp1 = await make_empleado(db, rol="empleado", email="ho_svc_bulk_eng1@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="ho_svc_bulk_eng2@leoni.test")
    await _crear_acta(db, empleado_id=emp1.empleado_id, generado_por=emp1.empleado_id, estado="signed")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos() as (mock_engine, inc_mock, falt_mock):
        with patch(
            "app.services.historial_objetivo_service.BonoProductividadReadClient.create_read_engine",
            return_value=mock_engine,
        ) as create_engine_mock:
            out = await service.indices_historial_por_empleado(
                [emp1.empleado_id, emp2.empleado_id], None, None
            )

    # UN solo engine para toda la llamada, con dispose; ambos repos consultados 1 vez.
    create_engine_mock.assert_called_once()
    mock_engine.dispose.assert_awaited_once()
    inc_mock.aggregate_empleados_top_por_tipo.assert_awaited_once()
    falt_mock.aggregate_empleados_top_por_tipo.assert_awaited_once()

    assert set(out.keys()) == {emp1.empleado_id, emp2.empleado_id}
    assert all(isinstance(v, float) for v in out.values())
    # emp1 tiene 1 acta signed (15) -> indice 85; emp2 sin eventos -> 100.
    assert out[emp1.empleado_id] == 85.0
    assert out[emp2.empleado_id] == 100.0


@pytest.mark.asyncio
async def test_indices_bulk_bono_no_disponible_devuelve_none(db):
    """Bono no configurado (engine None) -> senal ausente para TODOS."""
    service = HistorialObjetivoService(db)
    with _mock_bono_repos(engine_configurado=False):
        out = await service.indices_historial_por_empleado([10, 20], None, None)
    assert out == {10: None, 20: None}


@pytest.mark.asyncio
async def test_indices_bulk_error_bono_degrada_a_none(db):
    """Si la consulta de bono falla (SQLAlchemyError -> ServiceUnavailableError),
    se captura y degrada a None para todos, sin crash y con dispose."""
    from sqlalchemy.exc import SQLAlchemyError

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(
        incidencias_side_effect=SQLAlchemyError("boom")
    ) as (mock_engine, _inc_mock, _falt_mock):
        out = await service.indices_historial_por_empleado([10, 20], None, None)
    assert out == {10: None, 20: None}
    mock_engine.dispose.assert_awaited_once()


@pytest.mark.asyncio
async def test_indices_bulk_lista_vacia(db):
    service = HistorialObjetivoService(db)
    assert await service.indices_historial_por_empleado([], None, None) == {}


# ── Progresivo (semanas sin bono) integrado en el indice ─────────────────────


@pytest.mark.asyncio
async def test_progresivo_penaliza_indice_empleado(db):
    """Empleado con 2 semanas sin bono, resto de fuentes limpias -> el indice
    baja por progresivo. Peso PESO_PROGRESIVO_DEFAULT=6 * 2 = 12 -> indice 88."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_prog_rh1@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_prog_emp1@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(progresivo_raw={emp.empleado_id: 2}):
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.bono_disponible is True
    assert resultado.resultado.penalizacion_total == 12.0
    assert resultado.resultado.indice == 88.0
    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    assert por_fuente["progresivo"].penalizacion == 12.0


@pytest.mark.asyncio
async def test_progresivo_un_solo_engine_y_dispose(db):
    """El repo de progresivo se instancia sobre el MISMO engine de bono: una
    sola apertura (`create_read_engine`) y un solo `dispose`, y la agregacion
    de progresivo se consulta una vez."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_prog_rh2@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_prog_emp2@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(progresivo_raw={emp.empleado_id: 1}) as (mock_engine, _inc, _falt):
        with patch(
            "app.services.historial_objetivo_service.BonoProductividadReadClient.create_read_engine",
            return_value=mock_engine,
        ) as create_engine_mock:
            with patch(
                "app.services.historial_objetivo_service.BonoProgresivoRepository"
            ) as prog_cls:
                prog_inst = prog_cls.return_value
                prog_inst.aggregate_semanas_sin_bono_por_empleado = AsyncMock(
                    return_value={emp.empleado_id: 1}
                )
                await service.indice_empleado(rh, emp.empleado_id, None, None)

    create_engine_mock.assert_called_once()
    mock_engine.dispose.assert_awaited_once()
    # El repo de progresivo se construyo sobre el mismo engine ya abierto.
    prog_cls.assert_called_once_with(mock_engine)
    prog_inst.aggregate_semanas_sin_bono_por_empleado.assert_awaited_once()


@pytest.mark.asyncio
async def test_progresivo_bono_no_disponible_no_penaliza(db):
    """Bono no configurado (engine None) -> progresivo 0, sin crash y sin
    penalizar por progresivo."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_prog_rh3@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_prog_emp3@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(engine_configurado=False, progresivo_raw={emp.empleado_id: 5}):
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.bono_disponible is False
    assert resultado.resultado.indice == 100.0
    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    assert por_fuente["progresivo"].penalizacion == 0.0


@pytest.mark.asyncio
async def test_progresivo_en_bulk_fase2(db):
    """`indices_historial_por_empleado` incorpora la penalizacion de progresivo:
    emp1 con 1 semana sin bono -> indice 94; emp2 sin semanas -> indice 100."""
    emp1 = await make_empleado(db, rol="empleado", email="ho_svc_prog_bulk1@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="ho_svc_prog_bulk2@leoni.test")

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(progresivo_raw={emp1.empleado_id: 1}):
        out = await service.indices_historial_por_empleado(
            [emp1.empleado_id, emp2.empleado_id], None, None
        )

    assert out[emp1.empleado_id] == 94.0
    assert out[emp2.empleado_id] == 100.0


@pytest.mark.asyncio
async def test_progresivo_penaliza_indice_en_ranking_de_equipo(db):
    """Hueco #1: un empleado del equipo con semanas sin bono aparece en el
    ranking de equipo con el indice penalizado por progresivo. El companero
    sin semanas conserva su indice 100 y el peor (con progresivo) queda
    primero. Peso PESO_PROGRESIVO_DEFAULT=6 * 3 semanas = 18 -> indice 82."""
    jefe = await make_empleado(db, rol="supervisor", email="ho_svc_prog_eq_jefe@leoni.test")
    con_prog = await make_empleado(
        db, rol="empleado", email="ho_svc_prog_eq_con@leoni.test", lider_id=jefe.empleado_id
    )
    sin_prog = await make_empleado(
        db, rol="empleado", email="ho_svc_prog_eq_sin@leoni.test", lider_id=jefe.empleado_id
    )

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(progresivo_raw={con_prog.empleado_id: 3}):
        resultado = await service.indice_equipo(jefe, None, None)

    por_id = {item.empleado_id: item for item in resultado.items}
    # El empleado del equipo con semanas sin bono aparece penalizado.
    assert con_prog.empleado_id in por_id
    assert por_id[con_prog.empleado_id].resultado.indice == 82.0
    desglose_con = {d.fuente: d for d in por_id[con_prog.empleado_id].resultado.desglose}
    assert desglose_con["progresivo"].penalizacion == 18.0
    # El companero sin semanas no se penaliza por progresivo.
    assert por_id[sin_prog.empleado_id].resultado.indice == 100.0
    desglose_sin = {d.fuente: d for d in por_id[sin_prog.empleado_id].resultado.desglose}
    assert desglose_sin["progresivo"].penalizacion == 0.0
    # Peor indice primero: el de progresivo encabeza el ranking.
    assert resultado.items[0].empleado_id == con_prog.empleado_id


@pytest.mark.asyncio
async def test_progresivo_incluye_empleado_en_ranking_universo_rh(db):
    """Bug de revision: en el universo de RH (`scope_ids is None`) un
    empleado cuya UNICA senal negativa son semanas sin bono (progresivo) --
    sin actas, faltas ni incidencias -- debe aparecer en el ranking global
    con su indice penalizado. Antes `ids_universo` solo unia actas + faltas
    + incidencias y dejaba fuera a este empleado (peso 6 * 3 semanas = 18 ->
    indice 82)."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_prog_universo_rh@leoni.test")
    solo_prog = await make_empleado(
        db, rol="empleado", email="ho_svc_prog_universo_emp@leoni.test"
    )

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(progresivo_raw={solo_prog.empleado_id: 3}):
        resultado = await service.indice_equipo(rh, date(2026, 1, 1), date(2026, 6, 30))

    por_id = {item.empleado_id: item for item in resultado.items}
    assert solo_prog.empleado_id in por_id
    assert por_id[solo_prog.empleado_id].resultado.indice == 82.0
    desglose = {d.fuente: d for d in por_id[solo_prog.empleado_id].resultado.desglose}
    assert desglose["progresivo"].penalizacion == 18.0


@pytest.mark.asyncio
async def test_progresivo_no_hace_doble_conteo_con_faltas_actas_e_incidencias(db):
    """Hueco #3: un empleado con acta + falta + incidencia Y semanas sin bono
    penaliza por CADA fuente de forma independiente (progresivo no altera el
    conteo de faltas/incidencias/actas ni viceversa). A mano: acta signed=15,
    incidencia calidad=6, retardo RE=3, progresivo 6*2=12 -> total 36 ->
    indice 64. Cada fuente conserva su penalizacion aislada."""
    rh = await make_empleado(db, rol="rh", email="ho_svc_dbl_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="ho_svc_dbl_emp@leoni.test")
    await _crear_acta(db, empleado_id=emp.empleado_id, generado_por=rh.empleado_id, estado="signed")

    incidencias_raw = [
        (emp.empleado_id, str(emp.no_empleado), emp.nombre, 1, {TIPO_INCIDENCIA_CALIDAD: 1})
    ]
    faltas_raw = [(emp.empleado_id, str(emp.no_empleado), emp.nombre, 1, {"RE": 1})]

    service = HistorialObjetivoService(db)
    with _mock_bono_repos(
        incidencias_raw=incidencias_raw,
        faltas_raw=faltas_raw,
        progresivo_raw={emp.empleado_id: 2},
    ):
        resultado = await service.indice_empleado(rh, emp.empleado_id, None, None)

    assert resultado.resultado.penalizacion_total == 36.0
    assert resultado.resultado.indice == 64.0
    por_fuente = {d.fuente: d for d in resultado.resultado.desglose}
    # Cada fuente penaliza exactamente su valor aislado -- ninguna se contamina
    # con el conteo de otra (sin doble conteo entre progresivo y las demas).
    assert por_fuente["actas"].penalizacion == 15.0
    assert por_fuente["incidencias"].penalizacion == 6.0
    assert por_fuente["faltas"].penalizacion == 3.0
    assert por_fuente["progresivo"].penalizacion == 12.0
    # El conteo de faltas es exactamente 1 retardo (progresivo no lo inflo) y el
    # de progresivo exactamente 2 semanas (las faltas no lo inflaron).
    tipos_faltas = {t.tipo: t.conteo for t in por_fuente["faltas"].tipos}
    assert tipos_faltas == {"retardo": 1}
    tipos_prog = {t.tipo: t.conteo for t in por_fuente["progresivo"].tipos}
    assert tipos_prog == {TIPO_PROGRESIVO_PIERDE_BONO: 2}
