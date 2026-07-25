from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import EstadoSesionLiteral
from app.schemas.level_up_dashboard import (
    CursosDashboardEmpleadoHistorialResponse,
    CursosDashboardRegistrosResponse,
    CursosDashboardResumenResponse,
    EstadoCursoEmpleadoLiteral,
)
from app.services.level_up_cursos_dashboard import LevelUpCursosDashboardService

router = APIRouter(
    prefix="/api/v1/level-up/cursos/dashboard",
    tags=["Level Up - Cursos Dashboard"],
)


@router.get("/resumen", response_model=CursosDashboardResumenResponse)
async def dashboard_resumen(
    solo_activos: bool = Query(
        True,
        description="Si es true, excluye cursos completados y sesiones ya cerradas con asistencia.",
    ),
    area_id: int | None = Query(
        None,
        description="Recorta el resumen a un area: los pares por empleado y las sesiones por tener inscritos de esa area.",
    ),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = LevelUpCursosDashboardService(db)
    return await service.obtener_resumen(solo_activos=solo_activos, area_id=area_id)


@router.get("/registros", response_model=CursosDashboardRegistrosResponse)
async def dashboard_registros(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    empleado_id: int | None = Query(None),
    curso_id: int | None = Query(None),
    area_id: int | None = Query(None),
    puesto_id: int | None = Query(None),
    estado_curso: EstadoCursoEmpleadoLiteral | None = Query(None),
    estado_sesion: EstadoSesionLiteral | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    q: str | None = Query(None, max_length=200),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = LevelUpCursosDashboardService(db)
    return await service.listar_registros(
        page=page,
        page_size=page_size,
        empleado_id=empleado_id,
        curso_id=curso_id,
        area_id=area_id,
        puesto_id=puesto_id,
        estado_curso=estado_curso,
        estado_sesion=estado_sesion,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        q=q,
    )


@router.get(
    "/empleados/{empleado_id}/historial",
    response_model=CursosDashboardEmpleadoHistorialResponse,
)
async def dashboard_historial_empleado(
    empleado_id: int,
    estado_curso: EstadoCursoEmpleadoLiteral | None = Query(None),
    solo_activos: bool = Query(
        True,
        description="Si es true, excluye cursos completados y sesiones ya cerradas con asistencia.",
    ),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    service = LevelUpCursosDashboardService(db)
    return await service.historial_empleado(
        empleado_id=empleado_id,
        estado_curso=estado_curso,
        solo_activos=solo_activos,
    )
