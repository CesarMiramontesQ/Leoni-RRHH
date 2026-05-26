# tests/test_competencias_cascade.py
"""
Tests de CASCADE delete para competencias — Modulo Talento.

Verifica:
  1. Soft-delete de Competencia no muestra requisitos en la matriz
  2. Soft-delete de una competencia no afecta otras
  3. Competencia eliminada no aparece al consultar perfil (endpoint /matriz)
  4. Soft-delete de PuestoPerfil elimina sus requisitos de la vista matriz

Nota sobre SQLite en tests:
  - PRAGMA foreign_keys no esta habilitado en conftest.py
  - Los services usan soft-delete (activo=False), NO hard-delete
  - El FK CASCADE (ON DELETE CASCADE) solo aplica para hard-deletes reales
  - Los tests verifican el comportamiento de negocio: tras soft-delete,
    los registros dependientes no deben aparecer en las queries filtradas
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.talento import Competencia, CompetenciaRequisito, PuestoPerfil
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_area,
    make_competencia,
    make_competencia_requisito,
    make_puesto_perfil,
)


# ===========================================================================
# Test 1: Eliminar competencia del catalogo — requisitos no visibles en matriz
# ===========================================================================


@pytest.mark.asyncio
async def test_eliminar_competencia_catalogo_cascade_requisitos(
    client: AsyncClient, db
):
    """
    Crear competencia vinculada a 2 puestos via competencia_requisitos,
    eliminar la competencia (soft-delete), verificar que los requisitos
    ya no aparecen en la matriz del area.
    """
    area = await make_area(db, descripcion="Area Cascade 1")
    rh = await make_empleado(db, rol="rh", email="cascade_rh1@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear 2 puestos en la misma area
    puesto_a = await make_puesto_perfil(
        db, nombre="Operador Cascade A", area_id=area.area_id
    )
    puesto_b = await make_puesto_perfil(
        db, nombre="Operador Cascade B", area_id=area.area_id
    )

    # Crear competencia y vincular a ambos puestos
    comp = await make_competencia(
        db, nombre="Seguridad Industrial Cascade", categoria="tecnica", area_id=area.area_id
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto_a.id, nivel_requerido=3
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto_b.id, nivel_requerido=2
    )

    # Verificar que la competencia aparece en la matriz antes del delete
    response = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    comp_ids_antes = [c["competencia_id"] for c in body["competencias"]]
    assert comp.id in comp_ids_antes

    # Soft-delete de la competencia via API
    del_response = await client.delete(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    assert del_response.status_code == 204

    # Verificar que la competencia YA NO aparece en la matriz
    response2 = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response2.status_code == 200
    body2 = response2.json()
    comp_ids_despues = [c["competencia_id"] for c in body2["competencias"]]
    assert comp.id not in comp_ids_despues

    # Los requisitos fisicamente siguen en DB (es soft-delete, no hard-delete)
    result = await db.execute(
        select(CompetenciaRequisito).where(
            CompetenciaRequisito.competencia_id == comp.id
        )
    )
    requisitos_en_db = result.scalars().all()
    assert len(requisitos_en_db) == 2, (
        "Los registros fisicos de requisitos se mantienen tras soft-delete"
    )


# ===========================================================================
# Test 2: Eliminar una competencia no afecta requisitos de otras
# ===========================================================================


@pytest.mark.asyncio
async def test_eliminar_competencia_no_afecta_otras(
    client: AsyncClient, db
):
    """
    Eliminar una competencia no debe afectar los requisitos de otras competencias.
    Solo la competencia eliminada desaparece de la matriz.
    """
    area = await make_area(db, descripcion="Area Cascade 2")
    rh = await make_empleado(db, rol="rh", email="cascade_rh2@leoni.test")
    headers = await auth_headers(client, rh)

    puesto = await make_puesto_perfil(
        db, nombre="Inspector Cascade", area_id=area.area_id
    )

    # Crear 2 competencias
    comp_a = await make_competencia(
        db, nombre="Metrologia Cascade", categoria="tecnica", area_id=area.area_id
    )
    comp_b = await make_competencia(
        db, nombre="Calidad Total Cascade", categoria="tecnica", area_id=area.area_id
    )

    # Vincular ambas al puesto
    await make_competencia_requisito(
        db, competencia_id=comp_a.id, puesto_perfil_id=puesto.id, nivel_requerido=4
    )
    req_b = await make_competencia_requisito(
        db, competencia_id=comp_b.id, puesto_perfil_id=puesto.id, nivel_requerido=2
    )

    # Eliminar comp_a
    del_resp = await client.delete(
        f"/api/v1/competencias/{comp_a.id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verificar la matriz: comp_b debe seguir visible, comp_a no
    response = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()

    comp_ids = [c["competencia_id"] for c in body["competencias"]]
    assert comp_a.id not in comp_ids, "Competencia eliminada no debe aparecer"
    assert comp_b.id in comp_ids, "Competencia activa debe seguir visible"

    # Verificar que el requisito de comp_b sigue en DB
    result = await db.execute(
        select(CompetenciaRequisito).where(
            CompetenciaRequisito.id == req_b.id
        )
    )
    requisito_b = result.scalar_one_or_none()
    assert requisito_b is not None
    assert requisito_b.nivel_requerido == 2


# ===========================================================================
# Test 3: Competencia eliminada no aparece en el perfil
# ===========================================================================


@pytest.mark.asyncio
async def test_competencia_eliminada_no_aparece_en_perfil(
    client: AsyncClient, db
):
    """
    Vincular competencia a un perfil, eliminar la competencia,
    verificar que GET /matriz ya no la muestra para ese perfil.
    """
    area = await make_area(db, descripcion="Area Cascade 3")
    rh = await make_empleado(db, rol="rh", email="cascade_rh3@leoni.test")
    headers = await auth_headers(client, rh)

    puesto = await make_puesto_perfil(
        db, nombre="Tecnico Cascade Perfil", area_id=area.area_id
    )
    comp = await make_competencia(
        db, nombre="Hidraulica Cascade", categoria="tecnica", area_id=area.area_id
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=3
    )

    # Verificar que aparece antes
    response_pre = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response_pre.status_code == 200
    body_pre = response_pre.json()
    assert any(
        c["competencia_id"] == comp.id for c in body_pre["competencias"]
    )

    # Eliminar la competencia
    del_resp = await client.delete(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verificar que NO aparece en la matriz
    response_post = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response_post.status_code == 200
    body_post = response_post.json()

    # La competencia eliminada no debe estar en las filas de la matriz
    comp_ids_post = [c["competencia_id"] for c in body_post["competencias"]]
    assert comp.id not in comp_ids_post

    # Tambien verificar que GET /competencias/{id} retorna 404
    get_resp = await client.get(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    assert get_resp.status_code == 404


# ===========================================================================
# Test 4: Eliminar puesto perfil — sus requisitos no aparecen en la matriz
# ===========================================================================


@pytest.mark.asyncio
async def test_eliminar_puesto_cascade_requisitos(
    client: AsyncClient, db
):
    """
    Eliminar (soft-delete) un PuestoPerfil, verificar que sus
    competencia_requisitos no aparecen en la matriz del area.
    """
    area = await make_area(db, descripcion="Area Cascade 4")
    rh = await make_empleado(db, rol="rh", email="cascade_rh4@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear 2 puestos
    puesto_activo = await make_puesto_perfil(
        db, nombre="Puesto Activo Cascade", area_id=area.area_id
    )
    puesto_eliminar = await make_puesto_perfil(
        db, nombre="Puesto Eliminar Cascade", area_id=area.area_id
    )

    # Crear competencia y vincular a ambos puestos
    comp = await make_competencia(
        db, nombre="Neumatica Cascade", categoria="tecnica", area_id=area.area_id
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto_activo.id, nivel_requerido=3
    )
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto_eliminar.id, nivel_requerido=2
    )

    # Verificar que ambos puestos aparecen en la matriz
    response_pre = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response_pre.status_code == 200
    body_pre = response_pre.json()
    puesto_ids_pre = [p["id"] for p in body_pre["puestos"]]
    assert puesto_activo.id in puesto_ids_pre
    assert puesto_eliminar.id in puesto_ids_pre

    # Soft-delete del puesto via API
    del_resp = await client.delete(
        f"/api/v1/puestos-perfil/{puesto_eliminar.id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verificar que el puesto eliminado ya no aparece en la matriz
    response_post = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert response_post.status_code == 200
    body_post = response_post.json()

    puesto_ids_post = [p["id"] for p in body_post["puestos"]]
    assert puesto_activo.id in puesto_ids_post, "Puesto activo sigue visible"
    assert puesto_eliminar.id not in puesto_ids_post, "Puesto eliminado no visible"

    # Los niveles de la competencia solo deben tener el puesto activo
    comp_row = next(
        (c for c in body_post["competencias"] if c["competencia_id"] == comp.id),
        None,
    )
    assert comp_row is not None
    assert str(puesto_activo.id) in comp_row["niveles"]
    assert str(puesto_eliminar.id) not in comp_row["niveles"]

    # Los requisitos fisicos siguen en DB (soft-delete no borra FK rows)
    result = await db.execute(
        select(CompetenciaRequisito).where(
            CompetenciaRequisito.puesto_perfil_id == puesto_eliminar.id
        )
    )
    requisitos_en_db = result.scalars().all()
    assert len(requisitos_en_db) == 1, (
        "Requisito fisico se mantiene en DB tras soft-delete del puesto"
    )


# ===========================================================================
# Test 5 (bonus): Hard-delete ORM cascade elimina requisitos
# ===========================================================================


@pytest.mark.asyncio
async def test_hard_delete_orm_cascade_elimina_requisitos(db):
    """
    Verificar que el ORM cascade='all, delete-orphan' funciona:
    al hacer session.delete(competencia), los CompetenciaRequisito
    asociados se eliminan automaticamente via SQLAlchemy (no via FK DB).
    """
    area = await make_area(db, descripcion="Area Hard Cascade")
    puesto = await make_puesto_perfil(
        db, nombre="Puesto Hard Cascade", area_id=area.area_id
    )
    comp = await make_competencia(
        db, nombre="Comp Hard Cascade", categoria="tecnica", area_id=area.area_id
    )
    req = await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=4
    )
    req_id = req.id
    comp_id = comp.id

    # Hard-delete via ORM (simula lo que haria un hard-delete real)
    await db.delete(comp)
    await db.flush()

    # El requisito debe haber sido eliminado por el ORM cascade
    result = await db.execute(
        select(CompetenciaRequisito).where(CompetenciaRequisito.id == req_id)
    )
    assert result.scalar_one_or_none() is None, (
        "ORM cascade='all, delete-orphan' debe eliminar requisitos al borrar competencia"
    )

    # La competencia ya no existe
    result2 = await db.execute(
        select(Competencia).where(Competencia.id == comp_id)
    )
    assert result2.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_hard_delete_puesto_orm_cascade_elimina_requisitos(db):
    """
    Verificar que session.delete(puesto_perfil) tambien elimina sus requisitos
    via ORM cascade='all, delete-orphan'.
    """
    area = await make_area(db, descripcion="Area Hard Cascade Puesto")
    puesto = await make_puesto_perfil(
        db, nombre="Puesto Hard Del", area_id=area.area_id
    )
    comp = await make_competencia(
        db, nombre="Comp Hard Del Puesto", categoria="blanda", area_id=area.area_id
    )
    req = await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=puesto.id, nivel_requerido=2
    )
    req_id = req.id
    puesto_id = puesto.id

    # Hard-delete del puesto via ORM
    await db.delete(puesto)
    await db.flush()

    # El requisito debe haber sido eliminado por el ORM cascade
    result = await db.execute(
        select(CompetenciaRequisito).where(CompetenciaRequisito.id == req_id)
    )
    assert result.scalar_one_or_none() is None, (
        "ORM cascade='all, delete-orphan' debe eliminar requisitos al borrar puesto"
    )

    # El puesto ya no existe
    result2 = await db.execute(
        select(PuestoPerfil).where(PuestoPerfil.id == puesto_id)
    )
    assert result2.scalar_one_or_none() is None

    # La competencia sigue existiendo (solo se borro el puesto)
    result3 = await db.execute(
        select(Competencia).where(Competencia.id == comp.id)
    )
    assert result3.scalar_one_or_none() is not None
