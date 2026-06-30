"""Endpoints del flujo de encuestas post curso (Level Up).

- admin_router: habilitación/estado/cierre por sesión + resumen por curso (rol operativo).
- dashboard_router: dashboard global de resultados para RH (rol operativo).
- empleado_router: pendientes / detalle / responder (empleado autenticado).
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.level_up_encuestas import (
    CursoEncuestasResumenResponse,
    EncuestaDetalleResponse,
    EncuestaEstadoResponse,
    EncuestaHabilitarRequest,
    EncuestaPendienteListResponse,
    EncuestaRespuestaCreate,
    EncuestaRespuestaResponse,
    EncuestasDashboardResponse,
    EncuestaUpdateRequest,
)
from app.services.level_up_encuestas import EncuestaService

admin_router = APIRouter(
    prefix="/api/v1/level-up/cursos/{curso_id}",
    tags=["Level Up - Encuestas (Admin)"],
)

dashboard_router = APIRouter(
    prefix="/api/v1/level-up/cursos/dashboard",
    tags=["Level Up - Encuestas (Admin)"],
)

empleado_router = APIRouter(
    prefix="/api/v1/level-up/encuestas",
    tags=["Level Up - Encuestas (Empleado)"],
)


# ── Administración (RH) ──────────────────────────────────────────────────────


@admin_router.get(
    "/sesiones/{sesion_id}/encuesta", response_model=EncuestaEstadoResponse
)
async def estado_encuesta_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).estado_sesion(curso_id, sesion_id)


@admin_router.post(
    "/sesiones/{sesion_id}/encuesta",
    response_model=EncuestaEstadoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def habilitar_encuesta_sesion(
    curso_id: int,
    sesion_id: int,
    body: EncuestaHabilitarRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).habilitar(curso_id, sesion_id, body, current_user)


@admin_router.patch(
    "/sesiones/{sesion_id}/encuesta", response_model=EncuestaEstadoResponse
)
async def actualizar_encuesta_sesion(
    curso_id: int,
    sesion_id: int,
    body: EncuestaUpdateRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).actualizar(curso_id, sesion_id, body, current_user)


@admin_router.delete(
    "/sesiones/{sesion_id}/encuesta", status_code=status.HTTP_204_NO_CONTENT
)
async def deshabilitar_encuesta_sesion(
    curso_id: int,
    sesion_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    await EncuestaService(db).deshabilitar(curso_id, sesion_id, current_user)


@admin_router.get(
    "/encuestas/resumen", response_model=CursoEncuestasResumenResponse
)
async def resumen_encuestas_curso(
    curso_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).resumen_curso(curso_id)


# ── Dashboard global (RH) ────────────────────────────────────────────────────


@dashboard_router.get("/encuestas", response_model=EncuestasDashboardResponse)
async def dashboard_encuestas(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).dashboard_global()


# ── Empleado ─────────────────────────────────────────────────────────────────


@empleado_router.get("/pendientes", response_model=EncuestaPendienteListResponse)
async def mis_encuestas_pendientes(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).pendientes_empleado(current_user.empleado_id)


@empleado_router.get("/{encuesta_id}", response_model=EncuestaDetalleResponse)
async def detalle_encuesta(
    encuesta_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).detalle_para_responder(
        encuesta_id, current_user.empleado_id
    )


@empleado_router.post(
    "/{encuesta_id}/respuesta",
    response_model=EncuestaRespuestaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def responder_encuesta(
    encuesta_id: int,
    body: EncuestaRespuestaCreate,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await EncuestaService(db).responder(
        encuesta_id, current_user.empleado_id, body
    )
