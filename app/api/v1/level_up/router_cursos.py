from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select
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
    CategoriaCursoLiteral,
    ClasificacionCursoLiteral,
    TipoCursoLiteral,
)
from app.services.level_up_cursos import CursoService

router = APIRouter(prefix="/api/v1/level-up/cursos", tags=["Level Up - Cursos"])


@router.get("", response_model=CursoListResponse)
async def listar_cursos(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(20, ge=1, le=100, description="Items por pagina"),
    tipo: TipoCursoLiteral | None = Query(None, description="Filtrar por tipo"),
    clasificacion: ClasificacionCursoLiteral | None = Query(None, description="Filtrar por clasificacion"),
    obligatorio: bool | None = Query(None, description="Filtrar por obligatorio"),
    categoria: CategoriaCursoLiteral | None = Query(None, description="Filtrar por categoria"),
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
    current_user: Empleado = Depends(role_checker(["rh"])),
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
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un curso del catalogo. Solo RH."""
    service = CursoService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_curso(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
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
    empleados_count: int = 0
    empleados: list[CursoPuestoEmpleado] = []


class CursoEmpleadoDetail(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None


@router.get("/{id}/puestos", response_model=list[CursoPuestoDetail])
async def listar_puestos_del_curso(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los puestos asignados a este curso, con conteo de empleados por puesto."""
    stmt = (
        select(CursoPuesto)
        .options(selectinload(CursoPuesto.puesto_perfil))
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
    """Lista empleados individuales asignados a este curso (no via puesto)."""
    stmt = (
        select(CursoEmpleado)
        .options(selectinload(CursoEmpleado.empleado))
        .where(CursoEmpleado.curso_id == id)
        .order_by(CursoEmpleado.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [
        CursoEmpleadoDetail(
            id=ce.id,
            empleado_id=ce.empleado_id,
            nombre_empleado=ce.empleado.nombre if ce.empleado else None,
            no_empleado=ce.empleado.no_empleado if ce.empleado else None,
        )
        for ce in items
    ]
