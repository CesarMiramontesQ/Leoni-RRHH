"""Recorrido del subárbol con jerarquías cíclicas.

`lider_id` vive en `empleados`, tabla de Bono que este proyecto solo lee: nada impide
que apunte en círculo. Ocurrió en producción —97 → 775 → 1142 → 97, y un empleado
puesto como líder de sí mismo—, y el BFS de `get_ids_subarbol` no llevaba registro de
lo ya visitado: la frontera volvía a los mismos nodos y el bucle consultaba la BD sin
fin. Para un gerente atrapado en el ciclo, `/empleados/resumen`, `/solicitudes` e
`/incidencias` dejaban de responder y su dashboard se quedaba en el esqueleto.

Cada caso corre con `wait_for`: si la protección desaparece, el test falla por timeout
en vez de colgar la suite.
"""

import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.empleado_repository import EmpleadoRepository
from tests.conftest import make_empleado

#: Un subárbol sano se resuelve en milisegundos; con el ciclo no terminaba nunca.
TIMEOUT_S = 10

ACTIVOS = [1]


async def _ids_subarbol(repo: EmpleadoRepository, empleado_id: int) -> set[int]:
    return await asyncio.wait_for(repo.get_ids_subarbol(empleado_id, ACTIVOS), TIMEOUT_S)


async def _ids_subarbol_sin_filtro(repo: EmpleadoRepository, empleado_id: int) -> set[int]:
    return await asyncio.wait_for(
        repo.get_ids_subarbol_sin_filtro_estado(empleado_id), TIMEOUT_S
    )


@pytest.mark.asyncio
async def test_ciclo_de_tres_no_cuelga(db: AsyncSession):
    """El caso real: A → B → C → A. Antes, consultas a la BD hasta el timeout."""
    a = await make_empleado(db, rol="gerente", email="ciclo_a@leoni.test")
    b = await make_empleado(db, rol="supervisor", email="ciclo_b@leoni.test", lider_id=a.empleado_id)
    c = await make_empleado(db, rol="supervisor", email="ciclo_c@leoni.test", lider_id=b.empleado_id)
    a.lider_id = c.empleado_id  # cierra el círculo
    await db.flush()

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol(repo, a.empleado_id)

    # Los tres se alcanzan desde A; lo que importa es que el recorrido termine.
    assert {b.id, c.id}.issubset(ids)


@pytest.mark.asyncio
async def test_empleado_lider_de_si_mismo_no_cuelga(db: AsyncSession):
    solo = await make_empleado(db, rol="gerente", email="ciclo_self@leoni.test")
    solo.lider_id = solo.empleado_id
    await db.flush()

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol(repo, solo.empleado_id)

    assert ids == {solo.id}


@pytest.mark.asyncio
async def test_ciclo_dentro_del_subarbol_no_esconde_la_rama_sana(db: AsyncSession):
    """Un nieto que apunta de vuelta a su ancestro cierra el ciclo sin sacar a nadie
    del subárbol; el resto del equipo debe seguir apareciendo."""
    jefe = await make_empleado(db, rol="gerente", email="ciclo_jefe@leoni.test")
    sano = await make_empleado(db, rol="empleado", email="ciclo_sano@leoni.test", lider_id=jefe.empleado_id)
    x = await make_empleado(db, rol="supervisor", email="ciclo_x@leoni.test", lider_id=jefe.empleado_id)
    y = await make_empleado(db, rol="empleado", email="ciclo_y@leoni.test", lider_id=x.empleado_id)
    z = await make_empleado(db, rol="empleado", email="ciclo_z@leoni.test", lider_id=y.empleado_id)
    z.lider_id = x.empleado_id  # cierra x → y → z → x, con x aún colgando de jefe
    await db.flush()

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol(repo, jefe.empleado_id)

    assert sano.id in ids
    assert {x.id, y.id, z.id}.issubset(ids)


@pytest.mark.asyncio
async def test_sin_filtro_de_estado_tambien_esta_protegido(db: AsyncSession):
    """La variante que ignora el estado recorre igual y necesita la misma guarda."""
    a = await make_empleado(db, rol="gerente", email="ciclo_sf_a@leoni.test")
    b = await make_empleado(db, rol="empleado", email="ciclo_sf_b@leoni.test", lider_id=a.empleado_id)
    a.lider_id = b.empleado_id
    await db.flush()

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol_sin_filtro(repo, a.empleado_id)

    assert b.id in ids


@pytest.mark.asyncio
async def test_baja_dentro_del_ciclo_no_reabre_el_recorrido(db: AsyncSession):
    """Un inactivo en medio corta la rama por estado, pero el ciclo sigue existiendo."""
    a = await make_empleado(db, rol="gerente", email="ciclo_baja_a@leoni.test")
    b = await make_empleado(
        db, rol="empleado", email="ciclo_baja_b@leoni.test", lider_id=a.empleado_id, estado_id=9
    )
    a.lider_id = b.empleado_id
    await db.flush()

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol(repo, a.empleado_id)

    assert b.id not in ids  # filtrado por estado, no por el ciclo


@pytest.mark.asyncio
async def test_jerarquia_sana_sigue_devolviendo_todo_el_subarbol(db: AsyncSession):
    """La guarda no debe recortar un árbol normal de varios niveles."""
    g = await make_empleado(db, rol="gerente", email="sano_g@leoni.test")
    s1 = await make_empleado(db, rol="supervisor", email="sano_s1@leoni.test", lider_id=g.empleado_id)
    s2 = await make_empleado(db, rol="supervisor", email="sano_s2@leoni.test", lider_id=g.empleado_id)
    e1 = await make_empleado(db, rol="empleado", email="sano_e1@leoni.test", lider_id=s1.empleado_id)
    e2 = await make_empleado(db, rol="empleado", email="sano_e2@leoni.test", lider_id=s2.empleado_id)
    nieto = await make_empleado(db, rol="empleado", email="sano_n@leoni.test", lider_id=e1.empleado_id)

    repo = EmpleadoRepository(db)
    ids = await _ids_subarbol(repo, g.empleado_id)

    assert ids == {s1.id, s2.id, e1.id, e2.id, nieto.id}
