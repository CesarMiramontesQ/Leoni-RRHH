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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogos import Area
from app.models.clasificacion_puesto import (
    CareerPath,
    CategoriaTarea,
    DisciplinaPuesto,
    FuncionPuesto,
    GlobalGrade,
    CareerLevelGradeMapping,
)
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    CualificacionCatalogo,
    GradoPuesto,
    GrupoCompetencia,
    MetodoCalificacion,
    MetodoCalificacionCompetencia,
    OpcionCalificacion,
    PerfilFunciones,
    PuestoPerfil,
    PuestoPerfilGrado,
    TipoCualificacionCatalogo,
    TipoCompetencia,
)
from app.utils.competencia_categoria import slug_codigo_grupo
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


async def make_career_path(
    db: AsyncSession,
    *,
    codigo: str = "P",
    nombre: str | None = None,
    activo: bool = True,
) -> CareerPath:
    """
    Factory get-or-create de CareerPath por codigo.

    Casi todos los tests necesitan "el career path", no uno nuevo, asi que
    repetir la llamada devuelve la misma fila (el codigo es unico).
    """
    existente = await db.execute(select(CareerPath).where(CareerPath.codigo == codigo))
    career_path = existente.scalar_one_or_none()
    if career_path:
        return career_path

    _nombre = nombre or ("Professional" if codigo == "P" else f"Career Path {codigo}")
    career_path = CareerPath(codigo=codigo, nombre=_nombre, activo=activo)
    db.add(career_path)
    await db.flush()
    await db.refresh(career_path)
    return career_path


async def make_funcion_puesto(
    db: AsyncSession,
    *,
    codigo: str | None = None,
    nombre: str | None = None,
    activo: bool = True,
) -> FuncionPuesto:
    """Factory para crear una FuncionPuesto en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    funcion = FuncionPuesto(
        codigo=codigo or f"F{uid}",
        nombre=nombre or f"Funcion Test {uid}",
        activo=activo,
    )
    db.add(funcion)
    await db.flush()
    await db.refresh(funcion)
    return funcion


async def make_disciplina_puesto(
    db: AsyncSession,
    *,
    funcion_id: int | None = None,
    nombre: str | None = None,
    codigo: str | None = None,
    activo: bool = True,
) -> DisciplinaPuesto:
    """Factory para crear una DisciplinaPuesto (crea su funcion si no se pasa)."""
    uid = uuid.uuid4().hex[:6]
    if funcion_id is None:
        funcion = await make_funcion_puesto(db)
        funcion_id = funcion.id
    disciplina = DisciplinaPuesto(
        funcion_id=funcion_id,
        nombre=nombre or f"Disciplina Test {uid}",
        codigo=codigo,
        activo=activo,
    )
    db.add(disciplina)
    await db.flush()
    await db.refresh(disciplina)
    return disciplina


async def make_categoria_tarea(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    activo: bool = True,
) -> CategoriaTarea:
    """Factory para crear una CategoriaTarea en el catalogo."""
    uid = uuid.uuid4().hex[:6]
    categoria = CategoriaTarea(
        nombre=nombre or f"Categoria Test {uid}", activo=activo
    )
    db.add(categoria)
    await db.flush()
    await db.refresh(categoria)
    return categoria


async def make_grado_puesto(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    codigo: str | None = None,
    orden: int | None = None,
    career_path_id: int | None = None,
    career_path_codigo: str = "P",
    con_equivalencia: bool = True,
    ordenes_extra: list[int] | None = None,
    activo: bool = True,
) -> GradoPuesto:
    """
    Factory para crear un GradoPuesto (Career Level) en el catalogo.

    El nivel ya no tiene orden propio: su posicion la da el Global Grade al que
    equivale. `orden` se conserva en la firma porque es como los tests expresan
    "el nivel que va en la posicion N", y se traduce a un GG de ese orden mas su
    equivalencia.

    Con `con_equivalencia=False` el nivel queda sin posicion, que es el estado
    que el backend rechaza al armar el rango de un perfil.

    `ordenes_extra` agrega mas global grades al nivel: un career level abarca un
    TRAMO, no un grade suelto (M4 = GG17 + GG18).
    """
    uid = uuid.uuid4().hex[:6]
    if career_path_id is None:
        career_path = await make_career_path(db, codigo=career_path_codigo)
        career_path_id = career_path.id
        _prefijo = career_path.codigo
    else:
        career_path = await db.get(CareerPath, career_path_id)
        _prefijo = career_path.codigo if career_path else "P"

    _orden = orden if orden is not None else abs(hash(uid)) % 90 + 10
    _nombre = nombre or f"Grado Test {uid}"
    _codigo = codigo or f"{_prefijo}{_orden}"
    grado = GradoPuesto(
        career_path_id=career_path_id,
        codigo=_codigo,
        nombre=_nombre,
        activo=activo,
    )
    db.add(grado)
    await db.flush()
    await db.refresh(grado)

    if con_equivalencia:
        for orden_grade in [_orden, *(ordenes_extra or [])]:
            grade = await make_global_grade(
                db, codigo=f"GG{orden_grade:02d}", orden=orden_grade
            )
            await make_equivalencia(
                db, career_level_id=grado.id, global_grade_id=grade.id
            )
        await db.refresh(grado)
    return grado


async def get_default_grado(db: AsyncSession) -> GradoPuesto:
    """Obtiene o crea el career level de orden 1 del career path por defecto."""
    await ensure_metodos_calificacion_competencia(db)
    career_path = await make_career_path(db)

    result = await db.execute(
        select(GradoPuesto).where(
            GradoPuesto.career_path_id == career_path.id,
            GradoPuesto.codigo == f"{career_path.codigo}1",
            GradoPuesto.activo.is_(True),
        )
    )
    grado = result.scalar_one_or_none()
    if grado:
        return grado
    return await make_grado_puesto(
        db, nombre="Grado 1", orden=1, career_path_id=career_path.id
    )


async def make_grados_consecutivos(
    db: AsyncSession,
    *,
    ordenes: list[int],
    career_path_codigo: str = "P",
    con_equivalencia: bool = True,
) -> list[GradoPuesto]:
    """
    Factory para crear (o reusar) career levels activos en las posiciones
    indicadas, todos dentro del mismo career path.

    `ordenes` ya no es una columna del nivel: es la posicion del global grade al
    que equivale, que es lo que ubica al nivel. Cada uno se crea con codigo
    `<path><orden>` y su equivalencia. Devuelve la lista ordenada por posicion.
    """
    career_path = await make_career_path(db, codigo=career_path_codigo)

    creados: list[tuple[int, GradoPuesto]] = []
    for orden in ordenes:
        # Se identifica por codigo: el nivel ya no lleva orden propio.
        result = await db.execute(
            select(GradoPuesto).where(
                GradoPuesto.career_path_id == career_path.id,
                GradoPuesto.codigo == f"{career_path.codigo}{orden}",
                GradoPuesto.activo.is_(True),
            )
        )
        grado = result.scalar_one_or_none()
        if grado is None:
            uid = uuid.uuid4().hex[:6]
            grado = await make_grado_puesto(
                db,
                nombre=f"Grado O{orden} {uid}",
                orden=orden,
                career_path_id=career_path.id,
                con_equivalencia=con_equivalencia,
            )
        creados.append((orden, grado))
    return [g for _, g in sorted(creados, key=lambda par: par[0])]


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
    grado_ids: list[int] | None = None,
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

    Parametros:
      - grado_ids: grados de progresion configurados para el perfil (filas
        PuestoPerfilGrado). Si no se especifica, se usa el grado por defecto
        (get_default_grado) para mantener compatibilidad con tests existentes.
    """
    uid = uuid.uuid4().hex[:6].upper()
    _codigo = codigo or f"PRF-T-{uid}"  # 10 chars, bien dentro de los 20 permitidos

    # updated_by: default al mismo que created_by si no se especifica
    _updated_by = created_by if updated_by is _UNSET else updated_by

    await ensure_metodos_calificacion_competencia(db)

    perfil = PuestoPerfil(
        codigo=_codigo,
        nombre=nombre,
        area_id=area_id,
        tipo="administrativo",
        descripcion=descripcion,
        version=version,
        activo=activo,
        created_by=created_by,
        updated_by=_updated_by,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)

    if grado_ids is None:
        default_grado = await get_default_grado(db)
        grado_ids = [default_grado.id]

    for grado_id in grado_ids:
        db.add(PuestoPerfilGrado(puesto_perfil_id=perfil.id, grado_id=grado_id))
    await db.flush()

    return perfil


async def make_grupo_competencia(
    db: AsyncSession,
    *,
    nombre: str | None = None,
    codigo: str | None = None,
    activo: bool = True,
) -> GrupoCompetencia:
    """
    Factory para crear una categoria de competencia (GrupoCompetencia).

    Es get-or-create por `codigo`: el codigo se deriva del nombre y es unico, asi
    que dos llamadas que pidan la misma categoria ("Tecnica X" y "Tecnica Y")
    devuelven la misma fila, igual que en produccion — una categoria, una fila.
    """
    uid = uuid.uuid4().hex[:6]
    _nombre = nombre or f"Grupo Test {uid}"
    _codigo = codigo or slug_codigo_grupo(_nombre)

    existente = await db.execute(
        select(GrupoCompetencia).where(GrupoCompetencia.codigo == _codigo)
    )
    grupo = existente.scalar_one_or_none()
    if grupo:
        return grupo

    grupo = GrupoCompetencia(nombre=_nombre, codigo=_codigo, activo=activo)
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
        # El nombre del grupo determina la categoría derivada por
        # categoria_desde_grupo_nombre ("tecnica"/"blanda"), usada al crear
        # competencias vía API. Se nombra según la categoría solicitada.
        grupo_nombre = "Técnica" if categoria == "tecnica" else "Habilidad blanda"
        grupo = await make_grupo_competencia(db, nombre=f"{grupo_nombre} {uid}")
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
    general: bool = False,
) -> CompetenciaRequisito:
    """
    Factory para crear un CompetenciaRequisito (vincula competencia a puesto con nivel).

    Respeta:
      - UniqueConstraint(competencia_id, puesto_perfil_id, grado_id)
      - Indice unico parcial (competencia_id, puesto_perfil_id) WHERE grado_id IS NULL
      - CheckConstraint(0 <= nivel_requerido <= 4)

    Parametros:
      - nivel_requerido: 0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto
      - general: si True, crea el requisito como general (grado_id=None),
        aplicable a todos los grados del perfil (ignora grado_id).
    """
    if general:
        grado_id = None
    elif grado_id is None:
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


async def make_global_grade(
    db: AsyncSession,
    *,
    codigo: str | None = None,
    nombre: str | None = None,
    orden: int | None = None,
    activo: bool = True,
) -> GlobalGrade:
    """Factory get-or-create de GlobalGrade por codigo (codigo y orden son unicos)."""
    uid = uuid.uuid4().hex[:6]
    _codigo = codigo or f"GG{uid}"

    existente = await db.execute(
        select(GlobalGrade).where(GlobalGrade.codigo == _codigo)
    )
    grade = existente.scalar_one_or_none()
    if grade:
        return grade

    if orden is None:
        orden = (await db.scalar(select(func.max(GlobalGrade.orden))) or 0) + 1
    grade = GlobalGrade(
        codigo=_codigo,
        nombre=nombre or f"Global Grade {_codigo}",
        orden=orden,
        activo=activo,
    )
    db.add(grade)
    await db.flush()
    await db.refresh(grade)
    return grade


async def make_equivalencia(
    db: AsyncSession,
    *,
    career_level_id: int,
    global_grade_id: int | None = None,
    activo: bool = True,
) -> CareerLevelGradeMapping:
    """Equivalencia Career Level → Global Grade (unica por nivel)."""
    if global_grade_id is None:
        global_grade_id = (await make_global_grade(db)).id
    mapping = CareerLevelGradeMapping(
        career_level_id=career_level_id,
        global_grade_id=global_grade_id,
        activo=activo,
    )
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)
    return mapping


async def make_clasificacion_payload(
    db: AsyncSession,
    *,
    ordenes: list[int] | None = None,
    con_equivalencia: bool = True,
) -> dict:
    """
    Crea los catalogos de clasificacion y devuelve el fragmento de payload que el
    alta de perfil exige: career path, funcion, disciplina y career level.

    El perfil lleva UN nivel: el primero de `ordenes`. El parametro sigue
    aceptando varios porque muchos tests necesitan mas niveles EN EL CATALOGO
    (para probar que se rechaza el de otro path, por ejemplo); esos se recuperan
    con `make_grados_consecutivos`, que es get-or-create.

    Con `con_equivalencia=True` (por defecto) los niveles llevan su equivalencia, de
    modo que tienen posicion y el global grade del perfil se autocompleta. Con
    `False` quedan sin posicion, que es el estado que el backend rechaza al armar
    el rango.
    """
    # Los niveles ya nacen con su equivalencia (es lo que los posiciona), asi que
    # `con_equivalencia` se propaga al factory en vez de crear una aparte.
    grados = await make_grados_consecutivos(
        db, ordenes=ordenes or [1, 2], con_equivalencia=con_equivalencia
    )
    funcion = await make_funcion_puesto(db)
    disciplina = await make_disciplina_puesto(db, funcion_id=funcion.id)
    return {
        "career_path_id": grados[0].career_path_id,
        "funcion_id": funcion.id,
        "disciplina_id": disciplina.id,
        "grado_id": grados[0].id,
    }
