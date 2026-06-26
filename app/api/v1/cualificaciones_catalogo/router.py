# app/api/v1/cualificaciones_catalogo/router.py
"""
Router del catálogo configurable de cualificaciones.

Endpoints:
  GET/POST/PATCH/DELETE  /api/v1/cualificaciones-catalogo/tipos
  GET/POST/PATCH/DELETE  /api/v1/cualificaciones-catalogo/metodos
  GET/POST/PATCH/DELETE  /api/v1/cualificaciones-catalogo/metodos/{id}/opciones
  GET/POST/PATCH/DELETE  /api/v1/cualificaciones-catalogo/cualificaciones
  GET                    /api/v1/cualificaciones-catalogo/catalogo-completo
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.cualificaciones_catalogo import (
    CatalogoCompletoResponse,
    CualificacionCatalogoCreate,
    CualificacionCatalogoListResponse,
    CualificacionCatalogoResponse,
    CualificacionCatalogoUpdate,
    MetodoCalificacionCreate,
    MetodoCalificacionListResponse,
    MetodoCalificacionResponse,
    MetodoCalificacionUpdate,
    OpcionCalificacionCreate,
    OpcionCalificacionResponse,
    OpcionCalificacionUpdate,
    TipoCualificacionCreate,
    TipoCualificacionListResponse,
    TipoCualificacionResponse,
    TipoCualificacionUpdate,
)
from app.services.cualificaciones_catalogo_service import CualificacionesCatalogoService

router = APIRouter(prefix="/api/v1/cualificaciones-catalogo", tags=["Cualificaciones Catálogo"])


# ── Tipos ───────────────────────────────────────────────────────────────────


@router.get("/tipos", response_model=TipoCualificacionListResponse)
async def listar_tipos_cualificacion(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.listar_tipos(page, page_size, busqueda, solo_activos)


@router.post("/tipos", response_model=TipoCualificacionResponse, status_code=status.HTTP_201_CREATED)
async def crear_tipo_cualificacion(
    body: TipoCualificacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.crear_tipo(body, current_user)


@router.patch("/tipos/{id}", response_model=TipoCualificacionResponse)
async def actualizar_tipo_cualificacion(
    id: int,
    body: TipoCualificacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.actualizar_tipo(id, body, current_user)


@router.delete("/tipos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tipo_cualificacion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    await service.eliminar_tipo(id, current_user)


# ── Métodos ─────────────────────────────────────────────────────────────────


@router.get("/metodos", response_model=MetodoCalificacionListResponse)
async def listar_metodos_calificacion(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.listar_metodos(page, page_size, busqueda, solo_activos)


@router.post("/metodos", response_model=MetodoCalificacionResponse, status_code=status.HTTP_201_CREATED)
async def crear_metodo_calificacion(
    body: MetodoCalificacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.crear_metodo(body, current_user)


@router.patch("/metodos/{id}", response_model=MetodoCalificacionResponse)
async def actualizar_metodo_calificacion(
    id: int,
    body: MetodoCalificacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.actualizar_metodo(id, body, current_user)


@router.delete("/metodos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_metodo_calificacion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    await service.eliminar_metodo(id, current_user)


# ── Opciones ────────────────────────────────────────────────────────────────


@router.get("/metodos/{metodo_id}/opciones", response_model=list[OpcionCalificacionResponse])
async def listar_opciones_calificacion(
    metodo_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.listar_opciones(metodo_id)


@router.post(
    "/metodos/{metodo_id}/opciones",
    response_model=OpcionCalificacionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_opcion_calificacion(
    metodo_id: int,
    body: OpcionCalificacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.crear_opcion(metodo_id, body, current_user)


@router.patch(
    "/metodos/{metodo_id}/opciones/{opcion_id}",
    response_model=OpcionCalificacionResponse,
)
async def actualizar_opcion_calificacion(
    metodo_id: int,
    opcion_id: int,
    body: OpcionCalificacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.actualizar_opcion(metodo_id, opcion_id, body, current_user)


@router.delete("/metodos/{metodo_id}/opciones/{opcion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_opcion_calificacion(
    metodo_id: int,
    opcion_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    await service.eliminar_opcion(metodo_id, opcion_id, current_user)


# ── Cualificaciones ─────────────────────────────────────────────────────────


@router.get("/cualificaciones", response_model=CualificacionCatalogoListResponse)
async def listar_cualificaciones_catalogo(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None),
    tipo_id: int | None = Query(None),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.listar_cualificaciones(page, page_size, busqueda, tipo_id, solo_activos)


@router.get("/cualificaciones/{id}", response_model=CualificacionCatalogoResponse)
async def obtener_cualificacion_catalogo(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.obtener_cualificacion(id)


@router.post(
    "/cualificaciones",
    response_model=CualificacionCatalogoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_cualificacion_catalogo(
    body: CualificacionCatalogoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.crear_cualificacion(body, current_user)


@router.patch("/cualificaciones/{id}", response_model=CualificacionCatalogoResponse)
async def actualizar_cualificacion_catalogo(
    id: int,
    body: CualificacionCatalogoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.actualizar_cualificacion(id, body, current_user)


@router.delete("/cualificaciones/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_cualificacion_catalogo(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    await service.eliminar_cualificacion(id, current_user)


# ── Catálogo completo ───────────────────────────────────────────────────────


@router.get("/catalogo-completo", response_model=CatalogoCompletoResponse)
async def obtener_catalogo_completo(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CualificacionesCatalogoService(db)
    return await service.obtener_catalogo_completo()
