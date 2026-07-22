# tests/test_ciclo_desempeno_repository.py
"""Tests directos del repositorio del modulo Ciclo de Desempeno (Tarea 3).

Solo acceso a datos: crear/listar/filtrar ciclos, scope de equipo en
`list_resultados`, `bulk_create_resultados` (materializacion idempotente) y
`upsert_resultado` (crea o actualiza). La logica de negocio (calculo de
calificacion, activacion/cierre) se cubre a nivel service en Tarea 4.
"""

from datetime import date

import pytest

from app.models.ciclo_desempeno import CicloDesempeno
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from tests.conftest import make_empleado

pytestmark = pytest.mark.asyncio


def _ciclo(**overrides):
    data = dict(
        nombre="Ciclo 2026",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 6, 30),
        estado="borrador",
    )
    data.update(overrides)
    return CicloDesempeno(**data)


async def test_create_y_get_ciclo_precarga_resultados_vacios(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())

    assert ciclo.id is not None
    assert ciclo.estado == "borrador"

    obtenido = await repo.get_ciclo(ciclo.id)
    assert obtenido is not None
    assert obtenido.resultados == []


async def test_get_ciclo_inexistente_devuelve_none(db):
    repo = CicloDesempenoRepository(db)
    assert await repo.get_ciclo(999999) is None


async def test_list_ciclos_filtra_por_estado(db):
    repo = CicloDesempenoRepository(db)
    await repo.create_ciclo(_ciclo(nombre="Borrador A", estado="borrador"))
    await repo.create_ciclo(_ciclo(nombre="Activo B", estado="activo"))
    await repo.create_ciclo(_ciclo(nombre="Cerrado C", estado="cerrado"))

    todos = await repo.list_ciclos()
    assert len(todos) == 3

    activos = await repo.list_ciclos(estado="activo")
    assert [c.nombre for c in activos] == ["Activo B"]


async def test_update_ciclo_persiste_mutacion_directa(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())

    ciclo.estado = "activo"
    ciclo.nombre = "Ciclo 2026 renombrado"
    actualizado = await repo.update_ciclo(ciclo)

    assert actualizado.estado == "activo"

    releido = await repo.get_ciclo(ciclo.id)
    assert releido.nombre == "Ciclo 2026 renombrado"
    assert releido.estado == "activo"


async def test_bulk_create_resultados_materializa_filas_vacias_sin_duplicar(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())
    e1 = await make_empleado(db, nombre="Empleado Uno")
    e2 = await make_empleado(db, nombre="Empleado Dos")

    # Preexistente: e1 ya tiene resultado (ej. de una materializacion previa).
    await repo.upsert_resultado(ciclo.id, e1.empleado_id, cumplimiento_metas=80)

    resultados = await repo.bulk_create_resultados(
        ciclo.id, [e1.empleado_id, e2.empleado_id]
    )

    empleado_ids = {r.empleado_id for r in resultados}
    assert empleado_ids == {e1.empleado_id, e2.empleado_id}
    # No se duplico ni se piso el valor ya existente de e1.
    r1 = next(r for r in resultados if r.empleado_id == e1.empleado_id)
    assert r1.cumplimiento_metas == 80

    conteo = await repo.count_participantes(ciclo.id)
    assert conteo == 2

    # Reinvocar con el mismo universo es idempotente (no crea duplicados).
    resultados_2 = await repo.bulk_create_resultados(
        ciclo.id, [e1.empleado_id, e2.empleado_id]
    )
    assert len(resultados_2) == 2


async def test_bulk_create_resultados_universo_vacio_no_falla(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())

    resultados = await repo.bulk_create_resultados(ciclo.id, [])
    assert resultados == []


async def test_list_resultados_scope_equipo_filtra_por_empleado_ids(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())
    e1 = await make_empleado(db, nombre="Del equipo")
    e2 = await make_empleado(db, nombre="Fuera del equipo")
    await repo.bulk_create_resultados(ciclo.id, [e1.empleado_id, e2.empleado_id])

    todos = await repo.list_resultados(ciclo.id)
    assert len(todos) == 2

    scope_equipo = await repo.list_resultados(ciclo.id, {e1.empleado_id})
    assert [r.empleado_id for r in scope_equipo] == [e1.empleado_id]

    scope_vacio = await repo.list_resultados(ciclo.id, set())
    assert scope_vacio == []


async def test_get_resultado_existente_y_ausente(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())
    e1 = await make_empleado(db, nombre="Con resultado")
    e2 = await make_empleado(db, nombre="Sin resultado")
    await repo.upsert_resultado(ciclo.id, e1.empleado_id, potencial=90)

    encontrado = await repo.get_resultado(ciclo.id, e1.empleado_id)
    assert encontrado is not None
    assert encontrado.potencial == 90

    assert await repo.get_resultado(ciclo.id, e2.empleado_id) is None


async def test_upsert_resultado_crea_y_luego_actualiza(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())
    empleado = await make_empleado(db, nombre="Actualizable")

    creado = await repo.upsert_resultado(
        ciclo.id, empleado.empleado_id, cumplimiento_metas=70, banda_desempeno="medio"
    )
    assert creado.cumplimiento_metas == 70
    assert creado.banda_desempeno == "medio"

    actualizado = await repo.upsert_resultado(
        ciclo.id, empleado.empleado_id, cumplimiento_metas=95, banda_desempeno="alto"
    )
    assert actualizado.id == creado.id
    assert actualizado.cumplimiento_metas == 95
    assert actualizado.banda_desempeno == "alto"

    conteo = await repo.count_participantes(ciclo.id)
    assert conteo == 1


async def test_count_con_potencial_solo_cuenta_capturados(db):
    repo = CicloDesempenoRepository(db)
    ciclo = await repo.create_ciclo(_ciclo())
    e1 = await make_empleado(db, nombre="Con potencial")
    e2 = await make_empleado(db, nombre="Sin potencial")
    await repo.bulk_create_resultados(ciclo.id, [e1.empleado_id, e2.empleado_id])
    await repo.upsert_resultado(ciclo.id, e1.empleado_id, potencial=60)

    assert await repo.count_con_potencial(ciclo.id) == 1


async def test_get_nombres_empleados_mapa_y_vacio(db):
    repo = CicloDesempenoRepository(db)
    e1 = await make_empleado(db, nombre="Nombre Uno")
    e2 = await make_empleado(db, nombre="Nombre Dos")

    mapa = await repo.get_nombres_empleados([e1.empleado_id, e2.empleado_id])
    assert mapa == {e1.empleado_id: "Nombre Uno", e2.empleado_id: "Nombre Dos"}

    assert await repo.get_nombres_empleados([]) == {}
