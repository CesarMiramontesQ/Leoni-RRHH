# tests/test_competencias_matriz_upsert.py
"""
Tests del comportamiento upsert de CompetenciaRequisitoRepository.

Cubre:
  - Crear nuevo requisito via upsert
  - Actualizar nivel de requisito existente
  - Nivel 0 mantiene el registro (no elimina — cambio respecto a comportamiento anterior)
  - Nivel 0 para par inexistente crea el registro
  - list_by_puesto incluye registros con nivel 0
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.competencia_repository import CompetenciaRequisitoRepository
from tests.conftest_talento import (
    get_default_grado,
    make_competencia,
    make_puesto_perfil,
)


# ===========================================================================
# Upsert: Crear nuevo requisito
# ===========================================================================


@pytest.mark.asyncio
async def test_upsert_crea_nuevo_requisito(db: AsyncSession):
    """Upsert con par inexistente crea un nuevo CompetenciaRequisito."""
    perfil = await make_puesto_perfil(db, nombre="Operador Upsert Nuevo")
    comp = await make_competencia(db, nombre="Soldadura Upsert", categoria="tecnica")

    grado = await get_default_grado(db)
    repo = CompetenciaRequisitoRepository(db)
    resultado = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=3,
    )

    assert resultado is not None
    assert resultado.id is not None
    assert resultado.competencia_id == comp.id
    assert resultado.puesto_perfil_id == perfil.id
    assert resultado.nivel_requerido == 3


# ===========================================================================
# Upsert: Actualizar nivel existente
# ===========================================================================


@pytest.mark.asyncio
async def test_upsert_actualiza_nivel(db: AsyncSession):
    """Upsert sobre par existente actualiza nivel_requerido sin crear duplicado."""
    perfil = await make_puesto_perfil(db, nombre="Tecnico Upsert Actualiza")
    comp = await make_competencia(db, nombre="Metrologia Upsert", categoria="tecnica")

    grado = await get_default_grado(db)
    repo = CompetenciaRequisitoRepository(db)

    # Crear con nivel 2
    original = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=2,
    )
    original_id = original.id

    # Actualizar a nivel 4
    actualizado = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=4,
    )

    assert actualizado.id == original_id  # mismo registro, no duplicado
    assert actualizado.nivel_requerido == 4


# ===========================================================================
# Upsert: Nivel 0 mantiene registro (NO elimina)
# ===========================================================================


@pytest.mark.asyncio
async def test_upsert_nivel_cero_mantiene_registro(db: AsyncSession):
    """Upsert con nivel=0 sobre registro existente lo mantiene con nivel 0 (no elimina)."""
    perfil = await make_puesto_perfil(db, nombre="Inspector Upsert Cero")
    comp = await make_competencia(db, nombre="5S Upsert Cero", categoria="tecnica")

    grado = await get_default_grado(db)
    repo = CompetenciaRequisitoRepository(db)

    # Crear con nivel 3
    original = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=3,
    )
    original_id = original.id

    # Actualizar a nivel 0 — debe mantenerse, no eliminarse
    resultado = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=0,
    )

    assert resultado.id == original_id
    assert resultado.nivel_requerido == 0

    # Verificar que el registro sigue existiendo en DB
    verificacion = await repo.get_by_pair(comp.id, perfil.id, grado.id)
    assert verificacion is not None
    assert verificacion.nivel_requerido == 0


# ===========================================================================
# Upsert: Nivel 0 para par nuevo crea registro
# ===========================================================================


@pytest.mark.asyncio
async def test_upsert_nivel_cero_nuevo_crea_registro(db: AsyncSession):
    """Upsert con nivel=0 para par inexistente crea el registro (no lo omite)."""
    perfil = await make_puesto_perfil(db, nombre="Lider Upsert Cero Nuevo")
    comp = await make_competencia(db, nombre="Liderazgo Upsert Cero", categoria="blanda")

    grado = await get_default_grado(db)
    repo = CompetenciaRequisitoRepository(db)

    # Upsert nivel 0 sobre par que no existe — debe crearse
    resultado = await repo.upsert(
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
        nivel_requerido=0,
    )

    assert resultado is not None
    assert resultado.id is not None
    assert resultado.nivel_requerido == 0

    # Confirmar persistencia
    verificacion = await repo.get_by_pair(comp.id, perfil.id, grado.id)
    assert verificacion is not None
    assert verificacion.id == resultado.id


# ===========================================================================
# list_by_puesto incluye registros con nivel 0
# ===========================================================================


@pytest.mark.asyncio
async def test_list_by_puesto_includes_nivel_cero(db: AsyncSession):
    """list_by_puesto retorna registros con nivel_requerido=0."""
    perfil = await make_puesto_perfil(db, nombre="Supervisor List Cero")
    comp_a = await make_competencia(db, nombre="Competencia Nivel3", categoria="tecnica")
    comp_b = await make_competencia(db, nombre="Competencia Nivel0", categoria="blanda")

    grado = await get_default_grado(db)
    repo = CompetenciaRequisitoRepository(db)

    # Crear uno con nivel 3 y otro con nivel 0
    await repo.upsert(
        competencia_id=comp_a.id, puesto_perfil_id=perfil.id, grado_id=grado.id, nivel_requerido=3
    )
    await repo.upsert(
        competencia_id=comp_b.id, puesto_perfil_id=perfil.id, grado_id=grado.id, nivel_requerido=0
    )

    requisitos = await repo.list_by_puesto(perfil.id)

    assert len(requisitos) == 2
    niveles = {r.nivel_requerido for r in requisitos}
    assert 0 in niveles
    assert 3 in niveles
