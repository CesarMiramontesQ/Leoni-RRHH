from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.models.level_up import CursoEmpleado, CursoPuesto, CursoSesion
from app.models.talento import PerfilFunciones, PuestoPerfil
from app.schemas.level_up import (
    CursoSesionCreate,
    CursoSesionListResponse,
    CursoSesionResponse,
    CursoSesionUpdate,
    EstadoSesionLiteral,
)
from app.models.level_up import Curso as CursoModel
from app.services.level_up_curso_sesiones import CursoSesionService

router = APIRouter(
    prefix="/api/v1/level-up/cursos/{curso_id}/sesiones",
    tags=["Level Up - Curso Sesiones"],
)

all_sesiones_router = APIRouter(
    prefix="/api/v1/level-up/sesiones",
    tags=["Level Up - Todas las Sesiones"],
)


# ── Todas las sesiones (cross-curso) ────────────────────────────────────────


class SesionGlobalItem(BaseModel):
    id: int
    curso_id: int
    curso_nombre: str | None = None
    fecha_inicio: str
    fecha_fin: str | None = None
    hora_inicio: str | None = None
    hora_fin: str | None = None
    ubicacion: str | None = None
    instructor: str | None = None
    cupo_max: int | None = None
    inscritos_count: int = 0
    estado: str
    created_at: str


class SesionGlobalListResponse(BaseModel):
    items: list[SesionGlobalItem]
    total: int


@all_sesiones_router.get("", response_model=SesionGlobalListResponse)
async def listar_todas_sesiones(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    estado: EstadoSesionLiteral | None = Query(None),
    q: str = Query("", max_length=200),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, case

    count_sub = (
        select(func.count())
        .select_from(CursoEmpleado)
        .where(CursoEmpleado.sesion_id == CursoSesion.id)
        .correlate(CursoSesion)
        .scalar_subquery()
    )

    stmt = (
        select(CursoSesion, CursoModel.nombre.label("curso_nombre"), count_sub.label("inscritos"))
        .join(CursoModel, CursoModel.id == CursoSesion.curso_id)
    )

    if estado:
        stmt = stmt.where(CursoSesion.estado == estado)
    if q.strip():
        search = f"%{q.strip()}%"
        stmt = stmt.where(
            CursoModel.nombre.ilike(search)
            | CursoSesion.ubicacion.ilike(search)
            | CursoSesion.instructor.ilike(search)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(CursoSesion.fecha_inicio.desc(), CursoSesion.id.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    rows = result.all()

    items = [
        SesionGlobalItem(
            id=row.CursoSesion.id,
            curso_id=row.CursoSesion.curso_id,
            curso_nombre=row.curso_nombre,
            fecha_inicio=str(row.CursoSesion.fecha_inicio),
            fecha_fin=str(row.CursoSesion.fecha_fin) if row.CursoSesion.fecha_fin else None,
            hora_inicio=str(row.CursoSesion.hora_inicio) if row.CursoSesion.hora_inicio else None,
            hora_fin=str(row.CursoSesion.hora_fin) if row.CursoSesion.hora_fin else None,
            ubicacion=row.CursoSesion.ubicacion,
            instructor=row.CursoSesion.instructor,
            cupo_max=row.CursoSesion.cupo_max,
            inscritos_count=row.inscritos or 0,
            estado=row.CursoSesion.estado.value if hasattr(row.CursoSesion.estado, 'value') else row.CursoSesion.estado,
            created_at=row.CursoSesion.created_at.isoformat(),
        )
        for row in rows
    ]
    return SesionGlobalListResponse(items=items, total=total)


# ── CRUD Sesiones ────────────────────────────────────────────────────────────


@router.get("", response_model=CursoSesionListResponse)
async def listar_sesiones(
    curso_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    estado: EstadoSesionLiteral | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursoSesionService(db)
    return await service.listar(curso_id=curso_id, page=page, page_size=page_size, estado=estado)


@router.get("/{sesion_id}", response_model=CursoSesionResponse)
async def obtener_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursoSesionService(db)
    return await service.obtener(curso_id=curso_id, sesion_id=sesion_id)


@router.post("", response_model=CursoSesionResponse, status_code=status.HTTP_201_CREATED)
async def crear_sesion(
    curso_id: int,
    body: CursoSesionCreate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursoSesionService(db)
    return await service.crear(curso_id=curso_id, data=body, current_user=current_user)


@router.put("/{sesion_id}", response_model=CursoSesionResponse)
async def actualizar_sesion(
    curso_id: int,
    sesion_id: int,
    body: CursoSesionUpdate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursoSesionService(db)
    return await service.actualizar(
        curso_id=curso_id, sesion_id=sesion_id, data=body, current_user=current_user
    )


@router.delete("/{sesion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursoSesionService(db)
    await service.eliminar(curso_id=curso_id, sesion_id=sesion_id, current_user=current_user)


# ── Inscripciones: Puestos ───────────────────────────────────────────────────


class SesionPuestoCreate(BaseModel):
    puesto_perfil_id: int
    obligatorio: bool = False


class SesionPuestoEmpleado(BaseModel):
    empleado_id: int
    nombre: str | None = None
    no_empleado: str | None = None


class SesionPuestoResponse(BaseModel):
    id: int
    puesto_perfil_id: int
    puesto_nombre: str | None = None
    puesto_codigo: str | None = None
    obligatorio: bool
    empleados_count: int = 0
    empleados: list[SesionPuestoEmpleado] = []


@router.get("/{sesion_id}/puestos", response_model=list[SesionPuestoResponse])
async def listar_puestos_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sesion = await db.get(CursoSesion, sesion_id)
    if not sesion or sesion.curso_id != curso_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Sesión", id=sesion_id)

    stmt = (
        select(CursoPuesto)
        .options(selectinload(CursoPuesto.puesto_perfil))
        .where(CursoPuesto.sesion_id == sesion_id)
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
            SesionPuestoEmpleado(
                empleado_id=a.empleado_id,
                nombre=a.empleado.nombre if a.empleado else None,
                no_empleado=a.empleado.no_empleado if a.empleado else None,
            )
            for a in asignaciones
        ]
        response.append(SesionPuestoResponse(
            id=cp.id,
            puesto_perfil_id=cp.puesto_perfil_id,
            puesto_nombre=cp.puesto_perfil.nombre if cp.puesto_perfil else None,
            puesto_codigo=cp.puesto_perfil.codigo if cp.puesto_perfil else None,
            obligatorio=cp.obligatorio,
            empleados_count=len(empleados_list),
            empleados=empleados_list,
        ))
    return response


@router.post(
    "/{sesion_id}/puestos",
    response_model=SesionPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def inscribir_puesto_sesion(
    curso_id: int,
    sesion_id: int,
    body: SesionPuestoCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    sesion = await db.get(CursoSesion, sesion_id)
    if not sesion or sesion.curso_id != curso_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Sesión", id=sesion_id)

    existing = await db.execute(
        select(CursoPuesto).where(
            CursoPuesto.curso_id == curso_id,
            CursoPuesto.puesto_perfil_id == body.puesto_perfil_id,
            CursoPuesto.sesion_id == sesion_id,
        )
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError(detail="Este puesto ya está inscrito en esta sesión")

    cp = CursoPuesto(
        curso_id=curso_id,
        puesto_perfil_id=body.puesto_perfil_id,
        sesion_id=sesion_id,
        obligatorio=body.obligatorio,
    )
    db.add(cp)
    await db.flush()
    await db.refresh(cp, attribute_names=["puesto_perfil"])

    return SesionPuestoResponse(
        id=cp.id,
        puesto_perfil_id=cp.puesto_perfil_id,
        puesto_nombre=cp.puesto_perfil.nombre if cp.puesto_perfil else None,
        puesto_codigo=cp.puesto_perfil.codigo if cp.puesto_perfil else None,
        obligatorio=cp.obligatorio,
    )


@router.delete("/{sesion_id}/puestos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def quitar_puesto_sesion(
    curso_id: int,
    sesion_id: int,
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    cp = await db.get(CursoPuesto, id)
    if not cp or cp.sesion_id != sesion_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Inscripción puesto", id=id)
    await db.delete(cp)
    await db.flush()


# ── Inscripciones: Empleados ─────────────────────────────────────────────────


class SesionEmpleadoCreate(BaseModel):
    empleado_id: int


class SesionEmpleadoResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None
    asistio: bool | None = None


@router.get("/{sesion_id}/empleados", response_model=list[SesionEmpleadoResponse])
async def listar_empleados_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sesion = await db.get(CursoSesion, sesion_id)
    if not sesion or sesion.curso_id != curso_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Sesión", id=sesion_id)

    stmt = (
        select(CursoEmpleado)
        .options(selectinload(CursoEmpleado.empleado))
        .where(CursoEmpleado.sesion_id == sesion_id)
        .order_by(CursoEmpleado.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [
        SesionEmpleadoResponse(
            id=ce.id,
            empleado_id=ce.empleado_id,
            nombre_empleado=ce.empleado.nombre if ce.empleado else None,
            no_empleado=ce.empleado.no_empleado if ce.empleado else None,
            asistio=ce.asistio,
        )
        for ce in items
    ]


class EmpleadoElegibleResponse(BaseModel):
    id: int
    nombre: str | None = None
    no_empleado: str | None = None
    origen: str


@router.get("/{sesion_id}/empleados-elegibles", response_model=list[EmpleadoElegibleResponse])
async def listar_empleados_elegibles(
    curso_id: int,
    sesion_id: int,
    q: str = Query("", max_length=100),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Empleados que pueden inscribirse: asignados a puestos con el curso, o con el curso como extra."""
    sesion = await db.get(CursoSesion, sesion_id)
    if not sesion or sesion.curso_id != curso_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Sesión", id=sesion_id)

    already_inscribed = select(CursoEmpleado.empleado_id).where(
        CursoEmpleado.sesion_id == sesion_id
    ).scalar_subquery()

    # Empleados en puestos que tienen el curso asignado
    from_puestos = (
        select(Empleado.id, Empleado.nombre, Empleado.no_empleado)
        .join(PerfilFunciones, PerfilFunciones.empleado_id == Empleado.id)
        .join(CursoPuesto, CursoPuesto.puesto_perfil_id == PerfilFunciones.puesto_perfil_id)
        .where(
            CursoPuesto.curso_id == curso_id,
            PerfilFunciones.activo.is_(True),
            Empleado.id.notin_(already_inscribed),
        )
    )

    # Empleados con curso extra asignado
    from_extras = (
        select(Empleado.id, Empleado.nombre, Empleado.no_empleado)
        .join(CursoEmpleado, CursoEmpleado.empleado_id == Empleado.id)
        .where(
            CursoEmpleado.curso_id == curso_id,
            CursoEmpleado.sesion_id.is_(None),
            Empleado.id.notin_(already_inscribed),
        )
    )

    if q.strip():
        search = f"%{q.strip()}%"
        from_puestos = from_puestos.where(
            Empleado.nombre.ilike(search) | Empleado.no_empleado.ilike(search)
        )
        from_extras = from_extras.where(
            Empleado.nombre.ilike(search) | Empleado.no_empleado.ilike(search)
        )

    combined = union_all(from_puestos, from_extras).limit(20)
    result = await db.execute(combined)
    rows = result.all()

    seen: set[int] = set()
    response: list[EmpleadoElegibleResponse] = []
    for row in rows:
        if row[0] in seen:
            continue
        seen.add(row[0])
        response.append(EmpleadoElegibleResponse(
            id=row[0], nombre=row[1], no_empleado=row[2], origen="puesto",
        ))
    return response


@router.post(
    "/{sesion_id}/empleados",
    response_model=SesionEmpleadoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def inscribir_empleado_sesion(
    curso_id: int,
    sesion_id: int,
    body: SesionEmpleadoCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func as sa_func
    from app.core.exceptions import NotFoundError, ConflictError

    sesion = await db.get(CursoSesion, sesion_id)
    if not sesion or sesion.curso_id != curso_id:
        raise NotFoundError(entidad="Sesión", id=sesion_id)

    if sesion.estado.value in ("cancelada", "completada"):
        raise ConflictError(detail=f"No se puede inscribir en una sesión {sesion.estado.value}")

    emp = await db.get(Empleado, body.empleado_id)
    if not emp:
        raise NotFoundError(entidad="Empleado", id=body.empleado_id)

    existing = await db.execute(
        select(CursoEmpleado).where(
            CursoEmpleado.curso_id == curso_id,
            CursoEmpleado.empleado_id == body.empleado_id,
            CursoEmpleado.sesion_id == sesion_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Este empleado ya está inscrito en esta sesión")

    if sesion.cupo_max:
        count_result = await db.execute(
            select(sa_func.count()).where(
                CursoEmpleado.sesion_id == sesion_id
            )
        )
        current_count = count_result.scalar() or 0
        if current_count >= sesion.cupo_max:
            raise ConflictError(detail=f"Cupo máximo alcanzado ({sesion.cupo_max})")

    ce = CursoEmpleado(
        curso_id=curso_id,
        empleado_id=body.empleado_id,
        sesion_id=sesion_id,
    )
    db.add(ce)
    await db.flush()
    await db.refresh(ce, attribute_names=["empleado"])

    return SesionEmpleadoResponse(
        id=ce.id,
        empleado_id=ce.empleado_id,
        nombre_empleado=ce.empleado.nombre if ce.empleado else None,
        no_empleado=ce.empleado.no_empleado if ce.empleado else None,
        asistio=ce.asistio,
    )


class SesionEmpleadoUpdate(BaseModel):
    asistio: bool | None = None


@router.patch("/{sesion_id}/empleados/{id}", response_model=SesionEmpleadoResponse)
async def actualizar_asistencia_empleado(
    curso_id: int,
    sesion_id: int,
    id: int,
    body: SesionEmpleadoUpdate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    ce = await db.get(CursoEmpleado, id)
    if not ce or ce.sesion_id != sesion_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Inscripción empleado", id=id)
    ce.asistio = body.asistio
    await db.flush()
    await db.refresh(ce, attribute_names=["empleado"])
    return SesionEmpleadoResponse(
        id=ce.id,
        empleado_id=ce.empleado_id,
        nombre_empleado=ce.empleado.nombre if ce.empleado else None,
        no_empleado=ce.empleado.no_empleado if ce.empleado else None,
        asistio=ce.asistio,
    )


@router.delete("/{sesion_id}/empleados/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def quitar_empleado_sesion(
    curso_id: int,
    sesion_id: int,
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    ce = await db.get(CursoEmpleado, id)
    if not ce or ce.sesion_id != sesion_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(entidad="Inscripción empleado", id=id)
    await db.delete(ce)
    await db.flush()
