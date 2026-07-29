# tests/test_wtw_mapa.py
"""
Mapa WTW: la estructura de grados sobre un eje comun de global grades.

No calcula nada nuevo — es la misma posicion que ubica el rango de un perfil —,
asi que lo que hay que fijar es la FORMA: que el eje venga ordenado, que el
tramo de cada nivel llegue completo, que un nivel sin equivalencias no
desaparezca, y que la vista sea consultable por quien no administra el catalogo.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_career_path,
    make_global_grade,
    make_grado_puesto,
)

URL = "/api/v1/puestos-perfil/wtw"


@pytest.mark.asyncio
async def test_el_eje_llega_ordenado_por_orden(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="wtw_eje@leoni.test")
    for orden in (19, 8, 12):
        await make_global_grade(db, codigo=f"GG{orden:02d}", orden=orden)
    headers = await auth_headers(client, rh)

    response = await client.get(URL, headers=headers)

    assert response.status_code == 200, response.text
    ordenes = [g["orden"] for g in response.json()["global_grades"]]
    assert ordenes == sorted(ordenes)


@pytest.mark.asyncio
async def test_un_nivel_reporta_su_tramo_completo(client: AsyncClient, db):
    """M4 = GG17 + GG18 debe llegar como [17, 18], no solo como su extremo."""
    rh = await make_empleado(db, rol="rh", email="wtw_tramo@leoni.test")
    await make_grado_puesto(
        db, codigo="M4", nombre="Group Manager", orden=17, ordenes_extra=[18],
        career_path_codigo="M",
    )
    headers = await auth_headers(client, rh)

    response = await client.get(URL, headers=headers)

    assert response.status_code == 200, response.text
    path = next(p for p in response.json()["career_paths"] if p["codigo"] == "M")
    nivel = next(n for n in path["niveles"] if n["codigo"] == "M4")
    assert (nivel["posicion_desde"], nivel["posicion_hasta"]) == (17, 18)
    assert nivel["global_grades"] == ["GG17", "GG18"]


@pytest.mark.asyncio
async def test_un_nivel_sin_equivalencias_no_desaparece(client: AsyncClient, db):
    """
    Sin equivalencias el nivel no tiene posicion y no se puede dibujar en el eje.

    Se devuelve aparte en vez de omitirlo: ocultarlo haria creer que el catalogo
    esta completo cuando falta configurarlo.
    """
    rh = await make_empleado(db, rol="rh", email="wtw_sin_eq@leoni.test")
    path = await make_career_path(db, codigo="P")
    await make_grado_puesto(
        db, codigo="P1", nombre="Entry", career_path_id=path.id, con_equivalencia=False
    )
    headers = await auth_headers(client, rh)

    response = await client.get(URL, headers=headers)

    assert response.status_code == 200, response.text
    item = next(p for p in response.json()["career_paths"] if p["codigo"] == "P")
    assert [n["codigo"] for n in item["sin_posicion"]] == ["P1"]
    assert "P1" not in [n["codigo"] for n in item["niveles"]]


@pytest.mark.asyncio
async def test_dos_paths_caen_en_la_misma_columna(client: AsyncClient, db):
    """
    La lectura que justifica la pagina: un P4 y un M1 pesan lo mismo.

    Es la consecuencia de que el Global Grade sea el ordenador y los career paths
    alternativas, y no se ve en ninguna otra pantalla.
    """
    rh = await make_empleado(db, rol="rh", email="wtw_columna@leoni.test")
    gg12 = await make_global_grade(db, codigo="GG12", orden=12)
    profesional = await make_career_path(db, codigo="P")
    management = await make_career_path(db, codigo="M", nombre="Management")
    await make_grado_puesto(
        db, codigo="P4", nombre="Specialist", orden=12, career_path_id=profesional.id
    )
    await make_grado_puesto(
        db, codigo="M1", nombre="Team Leader", orden=12, career_path_id=management.id
    )
    headers = await auth_headers(client, rh)

    response = await client.get(URL, headers=headers)

    assert response.status_code == 200, response.text
    por_codigo = {p["codigo"]: p for p in response.json()["career_paths"]}
    p4 = next(n for n in por_codigo["P"]["niveles"] if n["codigo"] == "P4")
    m1 = next(n for n in por_codigo["M"]["niveles"] if n["codigo"] == "M1")
    assert p4["posicion_desde"] == m1["posicion_desde"] == gg12.orden


@pytest.mark.asyncio
async def test_la_ve_quien_tiene_puestos_sin_administrar_el_catalogo(
    client: AsyncClient, db
):
    """
    El motivo de que el endpoint viva bajo `/puestos-perfil`.

    Los catalogos que tienen estos datos pertenecen al modulo `puestos-ajustes`;
    componer la vista desde el cliente la habria dejado solo para quien
    administra el catalogo.
    """
    from app.core.rh_module_registry import resolve_module_from_api_path

    assert resolve_module_from_api_path(URL) == "puestos"
