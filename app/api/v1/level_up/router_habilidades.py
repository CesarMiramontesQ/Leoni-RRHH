from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    HabilidadCreate,
    HabilidadListResponse,
    HabilidadResponse,
    HabilidadUpdate,
    TipoHabilidad,
)
from app.services.level_up_habilidades import HabilidadService

router = APIRouter(prefix="/api/v1/level-up/habilidades", tags=["Level Up - Habilidades"])


@router.get("", response_model=HabilidadListResponse)
async def listar_habilidades(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=100, description="Items por pagina"),
    tipo: TipoHabilidad | None = Query(None, description="Filtrar por tipo"),
    busqueda: str | None = Query(None, max_length=100, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista habilidades con paginacion y filtros opcionales."""
    service = HabilidadService(db)
    return await service.listar(
        page=page, page_size=page_size, tipo=tipo, busqueda=busqueda
    )


@router.post(
    "",
    response_model=HabilidadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_habilidad(
    body: HabilidadCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una nueva habilidad. Solo RH."""
    service = HabilidadService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=HabilidadResponse)
async def obtener_habilidad(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de una habilidad por ID."""
    service = HabilidadService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=HabilidadResponse)
async def actualizar_habilidad(
    id: int,
    body: HabilidadUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una habilidad. Solo RH."""
    service = HabilidadService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_habilidad(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) una habilidad. Solo RH."""
    service = HabilidadService(db)
    await service.eliminar(id=id, current_user=current_user)
