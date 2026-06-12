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
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    CualificacionCatalogo,
    GradoPuesto,
    GrupoCompetencia,
    MetodoCalificacion,
    MetodoCalificacionCompetencia,
    NivelPuesto,
    OpcionCalificacion,
    PerfilFunciones,
    PuestoPerfil,
    TipoCualificacionCatalogo,
    TipoCompetencia,
)
from app.utils.seed_cualificaciones_catalogo import (
    LEGACY_TIPOS,
    LEGACY_TIPO_METODO,
    METODOS_SEED,
)

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


async def make_nivel_puesto(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    activo: bool = True,
) -> NivelPuesto:
    """Factory para crear un NivelPuesto en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    _nombre = nombre or f"Nivel Test {uid}"
    nivel = NivelPuesto(nombre=_nombre, activo=activo)
    db.add(nivel)
    await db.flush()
    await db.refresh(nivel)
    return nivel


async def make_grado_puesto(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    orden: int | None = None,
    activo: bool = True,
) -> GradoPuesto:
    """Factory para crear un GradoPuesto en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    _orden = orden if orden is not None else abs(hash(uid)) % 90 + 10
    _nombre = nombre or f"Grado Test {uid}"
    grado = GradoPuesto(nombre=_nombre, orden=_orden, activo=activo)
    db.add(grado)
    await db.flush()
    await db.refresh(grado)
    return grado


async def get_default_grado(db: AsyncSession) -> GradoPuesto:
    """Obtiene o crea el Grado 1 por defecto para tests."""
    from sqlalchemy import select

    result = await db.execute(
        select(GradoPuesto).where(GradoPuesto.orden == 1, GradoPuesto.activo.is_(True))
    )
    grado = result.scalar_one_or_none()
    if grado:
        return grado
    return await make_grado_puesto(db, nombre="Grado 1", orden=1)


METODOS_CALIFICACION_COMPETENCIA_SEED = [
    (1, "Planeado", 1),
    (2, "En entrenamiento", 2),
    (3, "Certificado", 3),
    (4, "Experto", 4),
]


async def ensure_metodos_calificacion_competencia(
    db: AsyncSession,
) -> list[MetodoCalificacionCompetencia]:
    """Asegura los 4 metodos de calificacion de competencias en tests."""
    from sqlalchemy import select

    result = await db.execute(
        select(MetodoCalificacionCompetencia).where(
            MetodoCalificacionCompetencia.activo.is_(True)
        )
    )
    existing = list(result.scalars().all())
    if len(existing) >= 4:
        return sorted(existing, key=lambda m: m.orden)

    for valor, nombre, orden in METODOS_CALIFICACION_COMPETENCIA_SEED:
        found = next((m for m in existing if m.valor == valor), None)
        if found:
            continue
        db.add(
            MetodoCalificacionCompetencia(
                valor=valor,
                nombre=nombre,
                orden=orden,
                activo=True,
            )
        )
    await db.flush()
    result = await db.execute(
        select(MetodoCalificacionCompetencia).where(
            MetodoCalificacionCompetencia.activo.is_(True)
        )
    )
    return sorted(list(result.scalars().all()), key=lambda m: m.orden)


async def make_puesto_perfil(
    db: AsyncSession,
    *,
    codigo: str | None = None,
    nombre: str = "Ingeniero de Procesos",
    area_id: int | None = None,
    nivel_id: int | None = None,
    descripcion: str | None = "Optimizar procesos de manufactura",
    version: int = 1,
    activo: bool = True,
    created_by: int | None = None,
    updated_by: Any = _UNSET,
) -> PuestoPerfil:
    """
    Factory para crear un PuestoPerfil directamente en DB.

    Genera codigo unico automaticamente si no se proporciona (formato PRF-TEST-XXXXXX,
    dentro del limite de 20 chars del modelo).
    """
    uid = uuid.uuid4().hex[:6].upper()
    _codigo = codigo or f"PRF-T-{uid}"  # 10 chars, bien dentro de los 20 permitidos

    # updated_by: default al mismo que created_by si no se especifica
    _updated_by = created_by if updated_by is _UNSET else updated_by

    if nivel_id is None:
        nivel = await make_nivel_puesto(db)
        nivel_id = nivel.id

    perfil = PuestoPerfil(
        codigo=_codigo,
        nombre=nombre,
        area_id=area_id,
        nivel_id=nivel_id,
        descripcion=descripcion,
        version=version,
        activo=activo,
        created_by=created_by,
        updated_by=_updated_by,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)
    return perfil


async def make_grupo_competencia(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    activo: bool = True,
) -> GrupoCompetencia:
    """Factory para crear un GrupoCompetencia en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    _nombre = nombre or f"Grupo Test {uid}"
    grupo = GrupoCompetencia(nombre=_nombre, activo=activo)
    db.add(grupo)
    await db.flush()
    await db.refresh(grupo)
    return grupo


async def make_tipo_competencia(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    categoria: str = "blanda",
    grupo_competencia_id: int | None = None,
    activo: bool = True,
) -> TipoCompetencia:
    """Factory para crear un TipoCompetencia en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    _nombre = nombre or f"Tipo Test {uid}"
    if grupo_competencia_id is None:
        grupo = await make_grupo_competencia(db)
        grupo_competencia_id = grupo.id
    tipo = TipoCompetencia(
        nombre=_nombre,
        grupo_competencia_id=grupo_competencia_id,
        activo=activo,
    )
    db.add(tipo)
    await db.flush()
    await db.refresh(tipo)
    return tipo


async def make_competencia(
    db: AsyncSession,
    *,
    nombre: str = "Liderazgo",
    categoria: str = "blanda",
    descripcion: str | None = "Capacidad de guiar equipos",
    area_id: int | None = None,
    tipo_competencia_id: int | None = None,
    activo: bool = True,
) -> Competencia:
    """
    Factory para crear una Competencia.

    Parametros:
      - categoria: "tecnica" o "blanda" (default "blanda")
      - tipo_competencia_id: FK al catalogo (se crea uno si no se pasa)
      - area_id: FK a areas.area_id (opcional)
    """
    if tipo_competencia_id is None:
        tipo = await make_tipo_competencia(db, categoria=categoria)
        tipo_competencia_id = tipo.id

    competencia = Competencia(
        nombre=nombre,
        categoria=categoria,
        descripcion=descripcion,
        tipo_competencia_id=tipo_competencia_id,
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
    grado_id: int | None = None,
    nivel_requerido: int = 3,
) -> CompetenciaRequisito:
    """
    Factory para crear un CompetenciaRequisito (vincula competencia a puesto con nivel).

    Respeta:
      - UniqueConstraint(competencia_id, puesto_perfil_id, grado_id)
      - CheckConstraint(0 <= nivel_requerido <= 4)

    Parametros:
      - nivel_requerido: 0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto
    """
    if grado_id is None:
        grado = await get_default_grado(db)
        grado_id = grado.id
    requisito = CompetenciaRequisito(
        competencia_id=competencia_id,
        puesto_perfil_id=puesto_perfil_id,
        grado_id=grado_id,
        nivel_requerido=nivel_requerido,
    )
    db.add(requisito)
    await db.flush()
    await db.refresh(requisito)
    return requisito


async def make_perfil_funciones(
    db: AsyncSession,
    *,
    puesto_perfil_id: int,
    empleado_id: int,
    grado_id: int | None = None,
    departamento: str | None = None,
    activo: bool = True,
) -> PerfilFunciones:
    """Factory para crear una asignacion PerfilFunciones."""
    if grado_id is None:
        grado = await get_default_grado(db)
        grado_id = grado.id
    asignacion = PerfilFunciones(
        puesto_perfil_id=puesto_perfil_id,
        empleado_id=empleado_id,
        grado_id=grado_id,
        departamento=departamento,
        activo=activo,
    )
    db.add(asignacion)
    await db.flush()
    await db.refresh(asignacion)
    return asignacion


# Alias corto para conveniencia
make_requisito = make_competencia_requisito


async def seed_cualificaciones_catalogo(db: AsyncSession) -> dict[str, int]:
    """Siembra catálogo de cualificaciones (idempotente por base de datos)."""
    from sqlalchemy import func, select

    existing = await db.scalar(select(func.count()).select_from(CualificacionCatalogo))
    if existing and existing > 0:
        result = await db.execute(
            select(CualificacionCatalogo).where(CualificacionCatalogo.legacy_tipo.isnot(None))
        )
        items = list(result.scalars().all())
        return {c.legacy_tipo: c.id for c in items if c.legacy_tipo}

    metodo_ids: dict[str, int] = {}
    for m in METODOS_SEED:
        metodo = MetodoCalificacion(
            nombre=m["nombre"],
            tipo=m["tipo"],
            descripcion=m.get("descripcion"),
            config=m["config"],
            activo=True,
        )
        db.add(metodo)
        await db.flush()
        metodo_ids[m["slug"]] = metodo.id
        for op in m.get("opciones", []):
            db.add(OpcionCalificacion(
                metodo_calificacion_id=metodo.id,
                etiqueta=op["etiqueta"],
                valor=op["valor"],
                orden=op["orden"],
                peso=op.get("peso"),
                activo=True,
            ))
        await db.flush()

    tipo_ids: dict[str, int] = {}
    catalogo_ids: dict[str, int] = {}
    for item in LEGACY_TIPOS:
        legacy = item["legacy_tipo"]
        tipo = TipoCualificacionCatalogo(
            nombre=item["nombre"],
            descripcion=item.get("descripcion"),
            activo=True,
        )
        db.add(tipo)
        await db.flush()
        tipo_ids[legacy] = tipo.id
        metodo_slug = LEGACY_TIPO_METODO[legacy]
        cat = CualificacionCatalogo(
            tipo_cualificacion_id=tipo.id,
            metodo_calificacion_id=metodo_ids[metodo_slug],
            nombre=item["nombre"],
            descripcion=item.get("descripcion"),
            obligatorio=True,
            activo=True,
            legacy_tipo=legacy,
        )
        db.add(cat)
        await db.flush()
        catalogo_ids[legacy] = cat.id

    return catalogo_ids
