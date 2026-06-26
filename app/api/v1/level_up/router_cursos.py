from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.models.level_up import CursoEmpleado, CursoPuesto
from app.models.talento import PerfilFunciones, PuestoPerfil
from app.schemas.level_up import (
    CursoCreate,
    CursoListResponse,
    CursoResponse,
    CursoUpdate,
)
from app.services.level_up_cursos import CursoService

router = APIRouter(prefix="/api/v1/level-up/cursos", tags=["Level Up - Cursos"])


@router.get("", response_model=CursoListResponse)
async def listar_cursos(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(20, ge=1, le=100, description="Items por pagina"),
    tipo: str | None = Query(None, description="Filtrar por tipo (nombre)"),
    clasificacion: str | None = Query(None, description="Filtrar por clasificacion (nombre)"),
    obligatorio: bool | None = Query(None, description="Filtrar por obligatorio"),
    categoria: str | None = Query(None, description="Filtrar por categoria (nombre)"),
    busqueda: str | None = Query(None, max_length=200, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista cursos del catalogo con paginacion y filtros opcionales."""
    service = CursoService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        tipo=tipo,
        clasificacion=clasificacion,
        obligatorio=obligatorio,
        categoria=categoria,
        busqueda=busqueda,
    )


@router.post(
    "",
    response_model=CursoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_curso(
    body: CursoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo curso en el catalogo. Solo RH."""
    service = CursoService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=CursoResponse)
async def obtener_curso(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un curso por ID."""
    service = CursoService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=CursoResponse)
async def actualizar_curso(
    id: int,
    body: CursoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un curso del catalogo. Solo RH."""
    service = CursoService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_curso(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) un curso del catalogo. Solo RH."""
    service = CursoService(db)
    await service.eliminar(id=id, current_user=current_user)


# ── Puestos y empleados asignados a un curso ────────────────────────────────


class CursoPuestoEmpleado(BaseModel):
    empleado_id: int
    nombre: str | None = None
    no_empleado: str | None = None


class CursoPuestoDetail(BaseModel):
    id: int
    puesto_perfil_id: int
    puesto_nombre: str | None = None
    puesto_codigo: str | None = None
    obligatorio: bool
    sesion_id: int | None = None
    sesion_fecha: str | None = None
    empleados_count: int = 0
    empleados: list[CursoPuestoEmpleado] = []


class CursoEmpleadoDetail(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None
    sesion_id: int | None = None
    sesion_fecha: str | None = None
    asistio: bool | None = None


@router.get("/{id}/puestos", response_model=list[CursoPuestoDetail])
async def listar_puestos_del_curso(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los puestos asignados a este curso, con conteo de empleados por puesto."""
    stmt = (
        select(CursoPuesto)
        .options(selectinload(CursoPuesto.puesto_perfil), selectinload(CursoPuesto.sesion))
        .where(CursoPuesto.curso_id == id)
        .order_by(CursoPuesto.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    response = []
    for cp in items:
        asig_result = await db.execute(
            select(PerfilFunciones)
            .options(selectinload(PerfilFunciones.empleado))
            .where(
                PerfilFunciones.puesto_perfil_id == cp.puesto_perfil_id,
                PerfilFunciones.activo.is_(True),
            )
        )
        asignaciones = asig_result.scalars().all()
        empleados_list = [
            CursoPuestoEmpleado(
                empleado_id=a.empleado_id,
                nombre=a.empleado.nombre if a.empleado else None,
                no_empleado=a.empleado.no_empleado if a.empleado else None,
            )
            for a in asignaciones
        ]

        response.append(CursoPuestoDetail(
            id=cp.id,
            puesto_perfil_id=cp.puesto_perfil_id,
            puesto_nombre=cp.puesto_perfil.nombre if cp.puesto_perfil else None,
            puesto_codigo=cp.puesto_perfil.codigo if cp.puesto_perfil else None,
            obligatorio=cp.obligatorio,
            sesion_id=cp.sesion_id,
            sesion_fecha=str(cp.sesion.fecha_inicio) if cp.sesion else None,
            empleados_count=len(empleados_list),
            empleados=empleados_list,
        ))
    return response


@router.get("/{id}/empleados-extra", response_model=list[CursoEmpleadoDetail])
async def listar_empleados_extra_del_curso(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista empleados asignados directamente (no via puesto), deduplicados."""
    # Empleados cubiertos por un puesto que tiene este curso
    covered_by_puesto = (
        select(PerfilFunciones.empleado_id)
        .join(CursoPuesto, CursoPuesto.puesto_perfil_id == PerfilFunciones.puesto_perfil_id)
        .where(CursoPuesto.curso_id == id, PerfilFunciones.activo.is_(True))
    ).scalar_subquery()

    stmt = (
        select(CursoEmpleado)
        .options(selectinload(CursoEmpleado.empleado), selectinload(CursoEmpleado.sesion))
        .where(CursoEmpleado.curso_id == id, CursoEmpleado.empleado_id.notin_(covered_by_puesto))
        .order_by(CursoEmpleado.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    seen: set[int] = set()
    response = []
    for ce in items:
        if ce.empleado_id in seen:
            continue
        seen.add(ce.empleado_id)
        response.append(CursoEmpleadoDetail(
            id=ce.id,
            empleado_id=ce.empleado_id,
            nombre_empleado=ce.empleado.nombre if ce.empleado else None,
            no_empleado=ce.empleado.no_empleado if ce.empleado else None,
            sesion_id=ce.sesion_id,
            sesion_fecha=str(ce.sesion.fecha_inicio) if ce.sesion else None,
            asistio=ce.asistio,
        ))
    return response


# ── Grupos asignados a un curso (áreas, subáreas, puestos) ───────────────────


class CatalogoItemResponse(BaseModel):
    id: int
    descripcion: str


class CursoCatalogosResponse(BaseModel):
    areas: list[CatalogoItemResponse]
    subareas: list[CatalogoItemResponse]
    puestos: list[CatalogoItemResponse]


@router.get("/{id}/catalogos-asignacion", response_model=CursoCatalogosResponse)
async def catalogos_asignacion_curso(
    id: int,
    area_id: Optional[int] = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Catálogos de áreas, subáreas y puestos para asignación de grupos al curso."""
    from app.models.catalogos import Area, Subarea, Puesto

    areas_q = select(Area.area_id, Area.descripcion).where(Area.estatus_id == 1).order_by(Area.descripcion)
    areas_result = await db.execute(areas_q)
    areas = [CatalogoItemResponse(id=r[0], descripcion=r[1]) for r in areas_result.all()]

    subareas_q = select(Subarea.subarea_id, Subarea.descripcion).where(Subarea.estatus_id == 1)
    if area_id:
        subareas_q = subareas_q.where(Subarea.area_id == area_id)
    subareas_q = subareas_q.order_by(Subarea.descripcion)
    subareas_result = await db.execute(subareas_q)
    subareas = [CatalogoItemResponse(id=r[0], descripcion=r[1]) for r in subareas_result.all()]

    puestos_q = select(Puesto.puesto_id, Puesto.descripcion).where(Puesto.estatus_id == 1)
    if area_id:
        puestos_q = puestos_q.where(Puesto.area_id == area_id)
    puestos_q = puestos_q.order_by(Puesto.descripcion)
    puestos_result = await db.execute(puestos_q)
    puestos = [CatalogoItemResponse(id=r[0], descripcion=r[1]) for r in puestos_result.all()]

    return CursoCatalogosResponse(areas=areas, subareas=subareas, puestos=puestos)


class CursoGrupoEmpleadoItem(BaseModel):
    empleado_id: int
    nombre: str | None = None
    no_empleado: str | None = None


class CursoGrupoResponse(BaseModel):
    id: int
    tipo: str
    referencia_id: int
    nombre: str
    empleados_count: int
    empleados: list[CursoGrupoEmpleadoItem]


@router.get("/{id}/grupos", response_model=list[CursoGrupoResponse])
async def listar_grupos_del_curso(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los grupos (áreas, subáreas, puestos) asignados a este curso con empleados dinámicos."""
    from app.models.level_up import CursoGrupo
    from app.models.catalogos import Area, Subarea, Puesto

    result = await db.execute(
        select(CursoGrupo).where(CursoGrupo.curso_id == id).order_by(CursoGrupo.tipo, CursoGrupo.id)
    )
    grupos = result.scalars().all()

    response = []
    for g in grupos:
        nombre = "—"
        emp_filter = None

        if g.tipo.value == "area":
            area = await db.get(Area, g.referencia_id)
            nombre = area.descripcion if area else f"Área #{g.referencia_id}"
            emp_filter = Empleado.area_id == g.referencia_id
        elif g.tipo.value == "subarea":
            sub = await db.get(Subarea, g.referencia_id)
            nombre = sub.descripcion if sub else f"Subárea #{g.referencia_id}"
            emp_filter = Empleado.subarea_id == g.referencia_id
        elif g.tipo.value == "puesto":
            puesto = await db.get(Puesto, g.referencia_id)
            nombre = puesto.descripcion if puesto else f"Puesto #{g.referencia_id}"
            emp_filter = Empleado.puesto_id == g.referencia_id

        empleados_list: list[CursoGrupoEmpleadoItem] = []
        if emp_filter is not None:
            emp_result = await db.execute(
                select(Empleado.id, Empleado.nombre, Empleado.no_empleado)
                .where(emp_filter)
                .order_by(Empleado.nombre)
            )
            empleados_list = [
                CursoGrupoEmpleadoItem(empleado_id=r[0], nombre=r[1], no_empleado=r[2])
                for r in emp_result.all()
            ]

        response.append(CursoGrupoResponse(
            id=g.id, tipo=g.tipo.value, referencia_id=g.referencia_id,
            nombre=nombre, empleados_count=len(empleados_list),
            empleados=empleados_list,
        ))
    return response


class CursoGrupoCreateBody(BaseModel):
    tipo: str
    referencia_id: int


@router.post("/{id}/grupos", response_model=CursoGrupoResponse, status_code=status.HTTP_201_CREATED)
async def agregar_grupo_al_curso(
    id: int,
    body: CursoGrupoCreateBody,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Asignar un grupo (área, subárea o puesto) al curso."""
    from app.core.exceptions import NotFoundError, ConflictError
    from app.models.level_up import Curso as CursoModel, CursoGrupo, TipoGrupoCurso
    from app.models.catalogos import Area, Subarea, Puesto

    curso = await db.get(CursoModel, id)
    if not curso:
        raise NotFoundError(entidad="Curso", id=id)

    if body.tipo not in ("area", "subarea", "puesto"):
        raise ConflictError(detail="tipo debe ser: area, subarea o puesto")

    tipo_enum = TipoGrupoCurso(body.tipo)

    existing = await db.execute(
        select(CursoGrupo).where(
            CursoGrupo.curso_id == id,
            CursoGrupo.tipo == tipo_enum,
            CursoGrupo.referencia_id == body.referencia_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Este grupo ya está asignado al curso")

    nombre = "—"
    emp_count = 0
    if body.tipo == "area":
        area = await db.get(Area, body.referencia_id)
        if not area:
            raise NotFoundError(entidad="Área", id=body.referencia_id)
        nombre = area.descripcion
        count_r = await db.execute(select(sa_func.count()).where(Empleado.area_id == body.referencia_id))
        emp_count = count_r.scalar() or 0
    elif body.tipo == "subarea":
        sub = await db.get(Subarea, body.referencia_id)
        if not sub:
            raise NotFoundError(entidad="Subárea", id=body.referencia_id)
        nombre = sub.descripcion
        count_r = await db.execute(select(sa_func.count()).where(Empleado.subarea_id == body.referencia_id))
        emp_count = count_r.scalar() or 0
    elif body.tipo == "puesto":
        puesto = await db.get(Puesto, body.referencia_id)
        if not puesto:
            raise NotFoundError(entidad="Puesto", id=body.referencia_id)
        nombre = puesto.descripcion
        count_r = await db.execute(select(sa_func.count()).where(Empleado.puesto_id == body.referencia_id))
        emp_count = count_r.scalar() or 0

    grupo = CursoGrupo(curso_id=id, tipo=tipo_enum, referencia_id=body.referencia_id)
    db.add(grupo)
    await db.flush()

    return CursoGrupoResponse(
        id=grupo.id, tipo=body.tipo, referencia_id=body.referencia_id,
        nombre=nombre, empleados_count=emp_count,
    )


@router.delete("/{id}/grupos/{grupo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def quitar_grupo_del_curso(
    id: int,
    grupo_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    from app.core.exceptions import NotFoundError
    from app.models.level_up import CursoGrupo

    grupo = await db.get(CursoGrupo, grupo_id)
    if not grupo or grupo.curso_id != id:
        raise NotFoundError(entidad="Grupo de curso", id=grupo_id)
    await db.delete(grupo)
    await db.flush()
