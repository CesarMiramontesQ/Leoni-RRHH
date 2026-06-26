from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.actas import (
    ActaAnularRequest,
    ActaCreateRequest,
    ActaEditarRequest,
    ActasDashboardMetricasResponse,
    ActaMejoraIaResponse,
    ActaRagStatusResponse,
    ActaResponse,
)
from app.services.legal_rag_service import legal_rag_service
from app.services.acta_service import ActaService

router = APIRouter(prefix="/api/v1/actas", tags=["Actas Administrativas"])


@router.get("/")
async def health():
    return {"modulo": "actas", "status": "activo", "version": "1.0.0"}


@router.get("", response_model=PaginatedResponse[ActaResponse])
async def list_actas(
    cursor: int | None = Query(None, description="ID del ultimo item recibido."),
    limit: int = Query(100, ge=1, le=500, description="Items por pagina."),
    current_user: Empleado = Depends(role_checker(["operativo", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.list_actas(
        cursor=cursor,
        limit=limit,
        current_user=current_user,
    )


@router.get(
    "/metricas-dashboard",
    response_model=ActasDashboardMetricasResponse,
)
async def actas_metricas_dashboard(
    current_user: Empleado = Depends(role_checker(["operativo", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.get_dashboard_metricas(current_user=current_user)


@router.post("", response_model=ActaResponse, status_code=status.HTTP_201_CREATED)
async def create_acta(
    body: ActaCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.crear_acta_desde_formulario(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.post("/generar/{incidencia_id}")
async def generar_acta(
    incidencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
):
    # TODO: Llamar a Ollama LLM para generar borrador
    return {"message": "Generación desde incidencia en desarrollo", "incidencia_id": incidencia_id}


@router.get("/rag/status", response_model=ActaRagStatusResponse)
async def rag_status(
    current_user: Empleado = Depends(role_checker(["operativo", "gerente", "director"])),
):
    return await legal_rag_service.status()


@router.post("/rag/reindex", response_model=ActaRagStatusResponse)
async def rag_reindex(
    current_user: Empleado = Depends(role_checker(["operativo"])),
):
    await legal_rag_service.rebuild_index()
    return await legal_rag_service.status()


@router.get("/{id}", response_model=ActaResponse)
async def get_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.get_acta(
        id=id,
        current_user=current_user,
    )


@router.post("/{id}/mejorar-ia", response_model=ActaMejoraIaResponse)
async def mejorar_acta_con_ia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    texto = await service.mejorar_redaccion_acta(
        id=id,
        current_user=current_user,
    )
    return ActaMejoraIaResponse(texto_mejorado=texto)


@router.put("/{id}/editar", response_model=ActaResponse)
async def editar_acta(
    id: int,
    body: ActaEditarRequest,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.editar_acta(
        id=id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{id}/firmar")
async def firmar_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["gerente", "director", "operativo"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.put("/{id}/aprobar", response_model=ActaResponse)
async def aprobar_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.aprobar_acta(
        id=id,
        current_user=current_user,
    )


@router.put("/{id}/anular", response_model=ActaResponse)
async def anular_acta(
    id: int,
    body: ActaAnularRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = ActaService(db)
    return await service.anular_acta(
        id=id,
        data=body,
        current_user=current_user,
    )


@router.get("/{id}/pdf")
async def download_acta_pdf(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo", "gerente"])),
):
    return {"message": "Generacion PDF en desarrollo", "id": id}
