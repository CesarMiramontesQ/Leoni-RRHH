"""
Router de Categorias de Tarea — CRUD del catalogo.

Endpoints:
  GET    /api/v1/categorias-tarea        — Listar (paginado, filtros)
  POST   /api/v1/categorias-tarea        — Crear (RH)
  GET    /api/v1/categorias-tarea/{id}   — Detalle
  PATCH  /api/v1/categorias-tarea/{id}   — Actualizar (RH)
  DELETE /api/v1/categorias-tarea/{id}   — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.categorias_tarea import (
    CategoriaTareaCreate,
    CategoriaTareaListResponse,
    CategoriaTareaResponse,
    CategoriaTareaUpdate,
)
from app.services.categoria_tarea_service import CategoriaTareaService

router = APIRouter(prefix="/api/v1/categorias-tarea", tags=["Categorias Tarea"])


@router.get("", response_model=CategoriaTareaListResponse)
async def listar_categorias_tarea(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las categorias de tarea del catalogo."""
    return await CategoriaTareaService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "", response_model=CategoriaTareaResponse, status_code=status.HTTP_201_CREATED
)
async def crear_categoria_tarea(
    body: CategoriaTareaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una categoria de tarea. Solo RH."""
    return await CategoriaTareaService(db).crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=CategoriaTareaResponse)
async def obtener_categoria_tarea(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una categoria de tarea."""
    return await CategoriaTareaService(db).obtener(id=id)


@router.patch("/{id}", response_model=CategoriaTareaResponse)
async def actualizar_categoria_tarea(
    id: int,
    body: CategoriaTareaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una categoria de tarea. Solo RH."""
    return await CategoriaTareaService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_categoria_tarea(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una categoria de tarea (soft delete). Solo RH."""
    await CategoriaTareaService(db).eliminar(id=id, current_user=current_user)
