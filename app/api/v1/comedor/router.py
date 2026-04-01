# app/api/v1/comedor/router.py
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_huella_ip, role_checker
from app.models.empleados import Empleado
from app.schemas.comedor import (
    ComedorRegistroCreate,
    ComedorRegistroResponse,
    ComedorResponse,
    HuellaValidarRequest,
    HuellaValidarResponse,
    MenuSemanalCreate,
    MenuSemanalResponse,
)
from app.services.comedor_service import ComedorService

router = APIRouter(prefix="/api/v1/comedor", tags=["Comedor"])


@router.get("/comedores", response_model=list[ComedorResponse])
async def list_comedores(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.list_comedores()


@router.get("/menu", response_model=list[MenuSemanalResponse])
async def get_menu(
    comedor_id: int = Query(...),
    semana: date = Query(...),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.get_menu(comedor_id=comedor_id, semana=semana)


@router.post("/menu", response_model=MenuSemanalResponse)
async def publicar_menu(
    body: MenuSemanalCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.publicar_menu(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.post("/registro", response_model=ComedorRegistroResponse)
async def registrar_seleccion(
    body: ComedorRegistroCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor", "gerente", "director", "rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.registrar_seleccion(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.post("/huella/validar", response_model=HuellaValidarResponse)
async def validar_huella(
    body: HuellaValidarRequest,
    _: None = Depends(require_huella_ip),
    db: AsyncSession = Depends(get_db),
):
    """
    Validacion por lector de huella en tiempo real para acceso a comedor.
    Timeout maximo: 500ms. Politica caida: FAIL OPEN.
    Solo accesible desde IPs en HUELLA_WHITELIST_IPS.
    """
    service = ComedorService(db)
    return await service.validar_huella(data=body)


@router.get("/estadisticas")
async def get_estadisticas(
    semana: date | None = Query(None),
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.get_estadisticas(current_user=current_user, semana=semana)


@router.get("/proyecciones")
async def get_proyecciones(
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.get_proyecciones(current_user=current_user)
