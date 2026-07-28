# app/api/v1/puestos_perfil/router.py
"""
Router de Puestos Perfil — Modulo Talento Fase 1.

Endpoints:
  GET  /api/v1/puestos-perfil/          — Listar (paginado, filtros)
  POST /api/v1/puestos-perfil/          — Crear (RH)
  GET  /api/v1/puestos-perfil/{id}      — Detalle
  PUT  /api/v1/puestos-perfil/{id}      — Actualizar (RH)
  DELETE /api/v1/puestos-perfil/{id}    — Eliminar (RH)
  POST /api/v1/puestos-perfil/{id}/generar-ia — Generar con IA (RH)
  GET  /api/v1/puestos-perfil/{id}/clasificacion-historial — Bitacora de clasificacion
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.talento import (
    ClasificacionHistorialResponse,
    GenerarPerfilIARequest,
    GenerarPerfilIAResponse,
    PuestoPerfilCreate,
    PuestoPerfilListResponse,
    PuestoPerfilResponse,
    PuestoPerfilUpdate,
    ResumenTarjetasResponse,
)
from app.services.puesto_perfil_service import PuestoPerfilService

router = APIRouter(prefix="/api/v1/puestos-perfil", tags=["Puestos Perfil"])


@router.get("", response_model=PuestoPerfilListResponse)
async def listar_puestos_perfil(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=100, description="Items por pagina"),
    area_id: int | None = Query(None, description="Filtrar por area"),
    grado_id: int | None = Query(None, description="Filtrar por global level"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    career_path_id: int | None = Query(None, description="Filtrar por career path"),
    funcion_id: int | None = Query(None, description="Filtrar por funcion"),
    disciplina_id: int | None = Query(None, description="Filtrar por disciplina"),
    global_grade_id: int | None = Query(None, description="Filtrar por global grade"),
    estado: str | None = Query(
        None, description="activo | inactivo | en_revision"
    ),
    clasificacion_pendiente: bool | None = Query(
        None, description="true = solo perfiles con clasificacion incompleta"
    ),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista puestos perfil con paginacion y filtros."""
    service = PuestoPerfilService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        area_id=area_id,
        grado_id=grado_id,
        busqueda=busqueda,
        career_path_id=career_path_id,
        funcion_id=funcion_id,
        disciplina_id=disciplina_id,
        global_grade_id=global_grade_id,
        estado=estado,
        clasificacion_pendiente=clasificacion_pendiente,
    )


@router.get("/resumen-tarjetas", response_model=ResumenTarjetasResponse)
async def resumen_tarjetas(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve perfiles activos con metricas agregadas para la vista de tarjetas."""
    service = PuestoPerfilService(db)
    return await service.resumen_tarjetas()


@router.post(
    "",
    response_model=PuestoPerfilResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_puesto_perfil(
    body: PuestoPerfilCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo perfil de puesto. Solo RH."""
    service = PuestoPerfilService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=PuestoPerfilResponse)
async def obtener_puesto_perfil(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un perfil de puesto."""
    service = PuestoPerfilService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=PuestoPerfilResponse)
async def actualizar_puesto_perfil(
    id: int,
    body: PuestoPerfilUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un perfil de puesto. Incrementa version. Solo RH."""
    service = PuestoPerfilService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_puesto_perfil(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) un perfil de puesto. Solo RH."""
    service = PuestoPerfilService(db)
    await service.eliminar(id=id, current_user=current_user)


@router.post("/{id}/generar-ia", response_model=GenerarPerfilIAResponse)
async def generar_perfil_ia(
    id: int,
    body: GenerarPerfilIARequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera descripcion y sugerencias de competencias usando IA (Ollama).
    No guarda automaticamente — retorna sugerencias para revision.
    Solo RH.
    """
    service = PuestoPerfilService(db)
    return await service.generar_con_ia(id=id, data=body, current_user=current_user)


@router.get(
    "/{id}/clasificacion-historial", response_model=ClasificacionHistorialResponse
)
async def historial_clasificacion(
    id: int,
    limit: int = Query(100, ge=1, le=500),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Bitacora de la clasificacion organizacional del perfil.

    Cada evento trae el diff (campo, valor anterior, valor nuevo), el motivo, el
    usuario y la fecha, del mas reciente al mas antiguo.
    """
    service = PuestoPerfilService(db)
    return await service.historial_clasificacion(id=id, limit=limit)
