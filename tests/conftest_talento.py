# tests/conftest_talento.py
"""
Factories para el modulo de Talento (Fase 1) — Puestos Perfil + Competencias.

Patron: funciones async que crean entidades directamente en DB via la sesion de test.
Importar desde tests que requieran datos del modulo de talento.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogos import Area
from app.models.talento import Competencia, CompetenciaRequisito, PuestoPerfil


async def make_area(
    db: AsyncSession,
    *,
    descripcion: str = "Area Prueba",
    estatus_id: int = 1,
) -> Area:
    """Factory para crear un Area de catalogo."""
    uid = str(uuid.uuid4())[:6]
    area = Area(
        area_id=abs(hash(uid)) % 100000,
        descripcion=descripcion or f"Area-{uid}",
        estatus_id=estatus_id,
    )
    db.add(area)
    await db.flush()
    await db.refresh(area)
    return area


async def make_puesto_perfil(
    db: AsyncSession,
    *,
    nombre: str = "Ingeniero de Procesos",
    area_id: int | None = None,
    nivel: str | None = None,
    descripcion: str | None = "Optimizar procesos de manufactura",
    competencias_tecnicas: dict | None = None,
    habilidades_blandas: dict | None = None,
    maquinas_herramientas: dict | None = None,
    activo: bool = True,
    created_by: int | None = None,
) -> PuestoPerfil:
    """
    Factory para crear un PuestoPerfil directamente en DB.
    Genera codigo secuencial automaticamente.
    """
    uid = str(uuid.uuid4())[:6]
    codigo = f"PRF-TEST-{uid.upper()}"

    perfil = PuestoPerfil(
        codigo=codigo,
        nombre=nombre,
        area_id=area_id,
        nivel=nivel,
        descripcion=descripcion,
        competencias_tecnicas=competencias_tecnicas or {},
        habilidades_blandas=habilidades_blandas or {},
        maquinas_herramientas=maquinas_herramientas or {},
        version=1,
        activo=activo,
        created_by=created_by,
        updated_by=created_by,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)
    return perfil


async def make_competencia(
    db: AsyncSession,
    *,
    nombre: str = "Liderazgo",
    categoria: str = "blanda",
    descripcion: str | None = "Capacidad de guiar equipos",
    area_id: int | None = None,
    activo: bool = True,
) -> Competencia:
    """Factory para crear una Competencia."""
    competencia = Competencia(
        nombre=nombre,
        categoria=categoria,
        descripcion=descripcion,
        area_id=area_id,
        activo=activo,
    )
    db.add(competencia)
    await db.flush()
    await db.refresh(competencia)
    return competencia


async def make_competencia_requisito(
    db: AsyncSession,
    *,
    competencia_id: int,
    puesto_perfil_id: int,
    nivel_requerido: int = 3,
) -> CompetenciaRequisito:
    """Factory para crear un CompetenciaRequisito (nivel requerido por puesto)."""
    requisito = CompetenciaRequisito(
        competencia_id=competencia_id,
        puesto_perfil_id=puesto_perfil_id,
        nivel_requerido=nivel_requerido,
    )
    db.add(requisito)
    await db.flush()
    await db.refresh(requisito)
    return requisito
