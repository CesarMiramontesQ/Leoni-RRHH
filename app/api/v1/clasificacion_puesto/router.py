"""
Router de la clasificacion de puestos (Willis Towers Watson) — CRUD de catalogos.

Los tres catalogos van bajo un mismo prefijo porque son un solo concepto de negocio
y porque `role_checker` resuelve el modulo RH desde la ruta: un prefijo, una entrada
en el registry.

Endpoints:
  GET/POST      /api/v1/clasificacion-puesto/career-paths
  GET/PATCH/DEL /api/v1/clasificacion-puesto/career-paths/{id}
  GET/POST      /api/v1/clasificacion-puesto/funciones
  GET/PATCH/DEL /api/v1/clasificacion-puesto/funciones/{id}
  GET/POST      /api/v1/clasificacion-puesto/disciplinas      (filtro ?funcion_id=)
  GET/PATCH/DEL /api/v1/clasificacion-puesto/disciplinas/{id}
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.clasificacion_puesto import (
    CareerPathCreate,
    CareerPathListResponse,
    CareerPathResponse,
    CareerPathUpdate,
    DisciplinaPuestoCreate,
    DisciplinaPuestoListResponse,
    DisciplinaPuestoResponse,
    DisciplinaPuestoUpdate,
    FuncionPuestoCreate,
    FuncionPuestoListResponse,
    FuncionPuestoResponse,
    FuncionPuestoUpdate,
)
from app.services.clasificacion_puesto_service import (
    CareerPathService,
    DisciplinaPuestoService,
    FuncionPuestoService,
)

router = APIRouter(
    prefix="/api/v1/clasificacion-puesto", tags=["Clasificacion de Puesto"]
)


# ── Career Paths ─────────────────────────────────────────────────────────────


@router.get("/career-paths", response_model=CareerPathListResponse)
async def listar_career_paths(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los career paths del catalogo."""
    return await CareerPathService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "/career-paths",
    response_model=CareerPathResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_career_path(
    body: CareerPathCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un career path. Solo RH."""
    return await CareerPathService(db).crear(data=body, current_user=current_user)


@router.get("/career-paths/{id}", response_model=CareerPathResponse)
async def obtener_career_path(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de un career path."""
    return await CareerPathService(db).obtener(id=id)


@router.patch("/career-paths/{id}", response_model=CareerPathResponse)
async def actualizar_career_path(
    id: int,
    body: CareerPathUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un career path. Solo RH."""
    return await CareerPathService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/career-paths/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_career_path(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un career path (soft delete). Solo RH."""
    await CareerPathService(db).eliminar(id=id, current_user=current_user)


# ── Funciones ────────────────────────────────────────────────────────────────


@router.get("/funciones", response_model=FuncionPuestoListResponse)
async def listar_funciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las funciones (job families) del catalogo."""
    return await FuncionPuestoService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "/funciones",
    response_model=FuncionPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_funcion(
    body: FuncionPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una funcion. Solo RH."""
    return await FuncionPuestoService(db).crear(data=body, current_user=current_user)


@router.get("/funciones/{id}", response_model=FuncionPuestoResponse)
async def obtener_funcion(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una funcion."""
    return await FuncionPuestoService(db).obtener(id=id)


@router.patch("/funciones/{id}", response_model=FuncionPuestoResponse)
async def actualizar_funcion(
    id: int,
    body: FuncionPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una funcion. Solo RH."""
    return await FuncionPuestoService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/funciones/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_funcion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una funcion (soft delete). Solo RH."""
    await FuncionPuestoService(db).eliminar(id=id, current_user=current_user)


# ── Disciplinas ──────────────────────────────────────────────────────────────


@router.get("/disciplinas", response_model=DisciplinaPuestoListResponse)
async def listar_disciplinas(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    funcion_id: int | None = Query(None, gt=0, description="Filtrar por funcion"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las disciplinas, opcionalmente acotadas a una funcion."""
    return await DisciplinaPuestoService(db).listar(
        page=page,
        page_size=page_size,
        funcion_id=funcion_id,
        busqueda=busqueda,
        solo_activos=solo_activos,
    )


@router.post(
    "/disciplinas",
    response_model=DisciplinaPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_disciplina(
    body: DisciplinaPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una disciplina dentro de una funcion. Solo RH."""
    return await DisciplinaPuestoService(db).crear(
        data=body, current_user=current_user
    )


@router.get("/disciplinas/{id}", response_model=DisciplinaPuestoResponse)
async def obtener_disciplina(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una disciplina."""
    return await DisciplinaPuestoService(db).obtener(id=id)


@router.patch("/disciplinas/{id}", response_model=DisciplinaPuestoResponse)
async def actualizar_disciplina(
    id: int,
    body: DisciplinaPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una disciplina. Solo RH."""
    return await DisciplinaPuestoService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/disciplinas/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_disciplina(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una disciplina (soft delete). Solo RH."""
    await DisciplinaPuestoService(db).eliminar(id=id, current_user=current_user)
