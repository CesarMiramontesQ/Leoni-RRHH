# app/api/v1/competencias/router.py
"""
Router de Competencias — Modulo Talento Fase 1.

Endpoints:
  GET  /api/v1/competencias/              — Listar (paginado, filtros)
  POST /api/v1/competencias/              — Crear (RH)
  GET  /api/v1/competencias/{id}          — Detalle
  PUT  /api/v1/competencias/{id}          — Actualizar (RH)
  DELETE /api/v1/competencias/{id}        — Eliminar (RH)
  GET  /api/v1/competencias/matriz        — Vista matriz por area
  PUT  /api/v1/competencias/matriz        — Bulk update matriz (RH)
  GET  /api/v1/competencias/resumen-area  — Resumen cumplimiento area
  GET  /api/v1/competencias/brechas       — Brechas criticas area
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.talento import (
    BrechasResponse,
    CompetenciaCreate,
    CompetenciaListResponse,
    CompetenciaResponse,
    CompetenciaUpdate,
    FilterOptionsResponse,
    MatrizBulkUpdate,
    MatrizResponse,
    MultihabilidadesPuestoOption,
    MultihabilidadesResponse,
    ResumenAreaResponse,
)
from app.services.competencia_service import CompetenciaService

router = APIRouter(prefix="/api/v1/competencias", tags=["Competencias"])


# ── Endpoints especiales (antes de /{id} para evitar conflicto de path) ──────


@router.get("/filter-options", response_model=FilterOptionsResponse)
async def obtener_filter_options(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opciones de filtro para la matriz: areas, lineas, sectores."""
    service = CompetenciaService(db)
    return await service.obtener_filter_options()


@router.get("/matriz", response_model=MatrizResponse)
async def obtener_matriz(
    area_id: int | None = Query(None, description="ID del area"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Matriz de competencias: filas=competencias, columnas=puestos del area.
    Cada celda contiene el nivel_requerido (0-4).
    """
    if area_id is None:
        return MatrizResponse(area_id=0, area_nombre=None, puestos=[], competencias=[])
    service = CompetenciaService(db)
    return await service.obtener_matriz(area_id=area_id)


@router.put("/matriz")
async def actualizar_matriz(
    body: MatrizBulkUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Actualiza en bulk los niveles de la matriz.
    Recibe lista de {competencia_id, puesto_perfil_id, nivel_requerido}.
    Nivel 0 elimina el requisito. Solo RH.
    """
    service = CompetenciaService(db)
    result = await service.actualizar_matriz(data=body, current_user=current_user)
    return result


@router.get("/resumen-area", response_model=ResumenAreaResponse)
async def resumen_area(
    area_id: int | None = Query(None, description="ID del area"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Resumen del area: cumplimiento %, total empleados, puestos, competencias,
    requisitos activos.
    """
    if area_id is None:
        return ResumenAreaResponse(
            area_id=0, area_nombre=None, total_empleados=0,
            total_puestos_perfil=0, total_competencias=0,
            requisitos_activos=0, cumplimiento_porcentaje=0.0,
        )
    service = CompetenciaService(db)
    return await service.resumen_area(area_id=area_id)


@router.get("/brechas", response_model=BrechasResponse)
async def obtener_brechas(
    area_id: int | None = Query(None, description="ID del area"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Brechas criticas: competencias con mayor gap de cumplimiento en el area.
    Ordenadas de mayor a menor gap.
    """
    if area_id is None:
        return BrechasResponse(area_id=0, area_nombre=None, brechas=[])
    service = CompetenciaService(db)
    return await service.obtener_brechas(area_id=area_id)


# ── Multihabilidades (Matriz por Puesto) ─────────────────────────────────────


@router.get("/multihabilidades/puestos", response_model=list[MultihabilidadesPuestoOption])
async def listar_puestos_multihabilidades(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista puestos disponibles para la matriz de multihabilidades."""
    service = CompetenciaService(db)
    return await service.listar_puestos_multihabilidades()


@router.get("/multihabilidades", response_model=MultihabilidadesResponse)
async def obtener_multihabilidades(
    puesto_perfil_id: int = Query(..., description="ID del puesto perfil"),
    nombre: str | None = Query(None, description="Filtro parcial por nombre del empleado"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Matriz multihabilidades: empleados x competencias para un puesto."""
    service = CompetenciaService(db)
    return await service.obtener_multihabilidades(
        puesto_perfil_id=puesto_perfil_id,
        nombre_filtro=nombre,
    )


# ── CRUD basico ──────────────────────────────────────────────────────────────


@router.get("", response_model=CompetenciaListResponse)
async def listar_competencias(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=200, description="Items por pagina"),
    categoria: str | None = Query(None, description="Filtrar por categoria: tecnica|blanda"),
    area_id: int | None = Query(None, description="Filtrar por area"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista competencias con paginacion y filtros."""
    service = CompetenciaService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        categoria=categoria,
        area_id=area_id,
        busqueda=busqueda,
    )


@router.post(
    "",
    response_model=CompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_competencia(
    body: CompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una nueva competencia. Solo RH."""
    service = CompetenciaService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=CompetenciaResponse)
async def obtener_competencia(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de una competencia."""
    service = CompetenciaService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=CompetenciaResponse)
async def actualizar_competencia(
    id: int,
    body: CompetenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una competencia. Solo RH."""
    service = CompetenciaService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.get("/{id}/puestos")
async def listar_puestos_asociados(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los puestos que tienen esta competencia como requisito."""
    service = CompetenciaService(db)
    return await service.listar_puestos_asociados(id=id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_competencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) una competencia. Solo RH."""
    service = CompetenciaService(db)
    await service.eliminar(id=id, current_user=current_user)
