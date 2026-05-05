# tests/conftest_talento.py
"""
Factories para el modulo de Talento (Fase 1) — Puestos Perfil + Competencias.

Patron: funciones async que crean entidades directamente en DB via la sesion de test.
Importar desde tests que requieran datos del modulo de talento:

    from tests.conftest_talento import make_area, make_puesto_perfil, ...

Nota sobre JSONB:
  El parche JSONB→JSON ya se aplica en tests/conftest.py ANTES de importar modelos,
  por lo que los campos JSONB (competencias_tecnicas, habilidades_blandas, etc.)
  se almacenan como JSON nativo en SQLite sin problema.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogos import Area
from app.models.talento import Competencia, CompetenciaRequisito, PuestoPerfil

# Sentinel para distinguir "no se paso argumento" de "se paso None explicitamente"
_UNSET: Any = object()


async def make_area(
    db: AsyncSession,
    *,
    area_id: int | None = None,
    descripcion: str = "Area Prueba",
    estatus_id: int = 1,
) -> Area:
    """
    Factory para crear un Area de catalogo.

    Genera area_id unico si no se proporciona.
    """
    uid = uuid.uuid4().hex[:8]
    _area_id = area_id if area_id is not None else abs(hash(uid)) % 9_000_000 + 1_000_000

    area = Area(
        area_id=_area_id,
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
    codigo: str | None = None,
    nombre: str = "Ingeniero de Procesos",
    area_id: int | None = None,
    nivel: str | None = None,
    descripcion: str | None = "Optimizar procesos de manufactura",
    competencias_tecnicas: Any = _UNSET,
    habilidades_blandas: Any = _UNSET,
    maquinas_herramientas: Any = _UNSET,
    version: int = 1,
    activo: bool = True,
    created_by: int | None = None,
    updated_by: Any = _UNSET,
) -> PuestoPerfil:
    """
    Factory para crear un PuestoPerfil directamente en DB.

    Genera codigo unico automaticamente si no se proporciona (formato PRF-TEST-XXXXXX,
    dentro del limite de 20 chars del modelo).

    Campos JSONB: por defecto se asignan como dict vacio `{}`. Si se pasa None
    explicitamente se almacena NULL (el modelo lo permite).
    """
    uid = uuid.uuid4().hex[:6].upper()
    _codigo = codigo or f"PRF-T-{uid}"  # 10 chars, bien dentro de los 20 permitidos

    # Resolver campos JSONB: default {} salvo que se pase None explicitamente
    _competencias_tecnicas = {} if competencias_tecnicas is _UNSET else competencias_tecnicas
    _habilidades_blandas = {} if habilidades_blandas is _UNSET else habilidades_blandas
    _maquinas_herramientas = {} if maquinas_herramientas is _UNSET else maquinas_herramientas

    # updated_by: default al mismo que created_by si no se especifica
    _updated_by = created_by if updated_by is _UNSET else updated_by

    perfil = PuestoPerfil(
        codigo=_codigo,
        nombre=nombre,
        area_id=area_id,
        nivel=nivel,
        descripcion=descripcion,
        competencias_tecnicas=_competencias_tecnicas,
        habilidades_blandas=_habilidades_blandas,
        maquinas_herramientas=_maquinas_herramientas,
        version=version,
        activo=activo,
        created_by=created_by,
        updated_by=_updated_by,
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
    """
    Factory para crear una Competencia.

    Parametros:
      - categoria: "tecnica" o "blanda" (default "blanda")
      - area_id: FK a areas.area_id (opcional)
    """
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
    """
    Factory para crear un CompetenciaRequisito (vincula competencia a puesto con nivel).

    Respeta:
      - UniqueConstraint(competencia_id, puesto_perfil_id)
      - CheckConstraint(0 <= nivel_requerido <= 4)

    Parametros:
      - nivel_requerido: 0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto
    """
    requisito = CompetenciaRequisito(
        competencia_id=competencia_id,
        puesto_perfil_id=puesto_perfil_id,
        nivel_requerido=nivel_requerido,
    )
    db.add(requisito)
    await db.flush()
    await db.refresh(requisito)
    return requisito


# Alias corto para conveniencia
make_requisito = make_competencia_requisito
