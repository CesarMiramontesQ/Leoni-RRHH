"""Router CRUD para catálogos de cursos: categorías, tipos, clasificaciones, instructores externos, proveedores."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.cursos_catalogo import (
    CursoCatSimpleCreate,
    CursoCatSimpleListResponse,
    CursoCatSimpleResponse,
    CursoCatSimpleUpdate,
    InstructorExternoCreate,
    InstructorExternoListResponse,
    InstructorExternoResponse,
    InstructorExternoUpdate,
    InstructorInternoCreate,
    InstructorInternoListResponse,
    InstructorInternoResponse,
    InstructorInternoUpdate,
    ProveedorCreate,
    ProveedorListResponse,
    ProveedorResponse,
    ProveedorUpdate,
)
from app.services.cursos_catalogo_service import CursosCatalogoService

router = APIRouter(prefix="/api/v1/level-up/catalogos", tags=["Level Up - Catálogos Cursos"])


# ── Categorías ─────────────────────────────────────────────────────────────────


@router.get("/categorias", response_model=CursoCatSimpleListResponse)
async def listar_categorias(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_categorias(page, page_size, busqueda, solo_activos)


@router.post("/categorias", response_model=CursoCatSimpleResponse, status_code=status.HTTP_201_CREATED)
async def crear_categoria(
    body: CursoCatSimpleCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_categoria(body, current_user)


@router.put("/categorias/{id}", response_model=CursoCatSimpleResponse)
async def actualizar_categoria(
    id: int,
    body: CursoCatSimpleUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_categoria(id, body, current_user)


@router.delete("/categorias/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_categoria(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_categoria(id, current_user)


# ── Tipos ──────────────────────────────────────────────────────────────────────


@router.get("/tipos", response_model=CursoCatSimpleListResponse)
async def listar_tipos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_tipos(page, page_size, busqueda, solo_activos)


@router.post("/tipos", response_model=CursoCatSimpleResponse, status_code=status.HTTP_201_CREATED)
async def crear_tipo(
    body: CursoCatSimpleCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_tipo(body, current_user)


@router.put("/tipos/{id}", response_model=CursoCatSimpleResponse)
async def actualizar_tipo(
    id: int,
    body: CursoCatSimpleUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_tipo(id, body, current_user)


@router.delete("/tipos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tipo(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_tipo(id, current_user)


# ── Clasificaciones ────────────────────────────────────────────────────────────


@router.get("/clasificaciones", response_model=CursoCatSimpleListResponse)
async def listar_clasificaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_clasificaciones(page, page_size, busqueda, solo_activos)


@router.post("/clasificaciones", response_model=CursoCatSimpleResponse, status_code=status.HTTP_201_CREATED)
async def crear_clasificacion(
    body: CursoCatSimpleCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_clasificacion(body, current_user)


@router.put("/clasificaciones/{id}", response_model=CursoCatSimpleResponse)
async def actualizar_clasificacion(
    id: int,
    body: CursoCatSimpleUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_clasificacion(id, body, current_user)


@router.delete("/clasificaciones/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_clasificacion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_clasificacion(id, current_user)


# ── Instructores Externos ──────────────────────────────────────────────────────


@router.get("/instructores-externos", response_model=InstructorExternoListResponse)
async def listar_instructores_externos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_instructores_externos(page, page_size, busqueda, solo_activos)


@router.post("/instructores-externos", response_model=InstructorExternoResponse, status_code=status.HTTP_201_CREATED)
async def crear_instructor_externo(
    body: InstructorExternoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_instructor_externo(body, current_user)


@router.put("/instructores-externos/{id}", response_model=InstructorExternoResponse)
async def actualizar_instructor_externo(
    id: int,
    body: InstructorExternoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_instructor_externo(id, body, current_user)


@router.delete("/instructores-externos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_instructor_externo(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_instructor_externo(id, current_user)


# ── Instructores Internos ──────────────────────────────────────────────────────


@router.get("/instructores-internos", response_model=InstructorInternoListResponse)
async def listar_instructores_internos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_instructores_internos(page, page_size, busqueda, solo_activos)


@router.post("/instructores-internos", response_model=InstructorInternoResponse, status_code=status.HTTP_201_CREATED)
async def crear_instructor_interno(
    body: InstructorInternoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_instructor_interno(body, current_user)


@router.put("/instructores-internos/{id}", response_model=InstructorInternoResponse)
async def actualizar_instructor_interno(
    id: int,
    body: InstructorInternoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_instructor_interno(id, body, current_user)


@router.delete("/instructores-internos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_instructor_interno(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_instructor_interno(id, current_user)


# ── Proveedores ────────────────────────────────────────────────────────────────


@router.get("/proveedores", response_model=ProveedorListResponse)
async def listar_proveedores(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, max_length=200),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.listar_proveedores(page, page_size, busqueda, solo_activos)


@router.post("/proveedores", response_model=ProveedorResponse, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(
    body: ProveedorCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.crear_proveedor(body, current_user)


@router.put("/proveedores/{id}", response_model=ProveedorResponse)
async def actualizar_proveedor(
    id: int,
    body: ProveedorUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    return await service.actualizar_proveedor(id, body, current_user)


@router.delete("/proveedores/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_proveedor(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CursosCatalogoService(db)
    await service.eliminar_proveedor(id, current_user)
