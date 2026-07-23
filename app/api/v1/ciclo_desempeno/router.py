# app/api/v1/ciclo_desempeno/router.py
"""
Router del modulo Ciclo de Desempeno (orquestador de Metas + Evaluacion 360°).

Convenciones (copiadas de `app/api/v1/metas/router.py`, ver ese docstring
para el detalle): administracion de ciclos (crear/activar/cerrar/actualizar)
exige `role_checker(["operativo"])` (RH con modulo 'ciclo-desempeno', o
admin en Modo RH operativo). Lectura de ciclos, resultados, 9-Box y captura
de potencial usan `_gestion_or_equipo()` (RH global O jefe con scoping de
equipo via `Empleado.lider_id`, ver `_resolve_scope`).

"Mis resultados" es self-service (`get_current_user`); su prefijo
(`/mis-resultados`) esta en `RH_SELF_SERVICE_API_PREFIXES` para que el
middleware de permisos por modulo no lo bloquee. El empleado siempre usa
`current_user.empleado_id` — nunca un empleado_id del body/query.

El router SOLO instancia `CicloDesempenoService` (nunca el repository
directamente) y no contiene logica de dominio: scoping de equipo y mapeo
de excepciones de dominio -> HTTP (manejado por el handler global via las
excepciones de `app.core.exceptions`).
"""

from __future__ import annotations

from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, gestor_team_role_checker, role_checker
from app.core.exceptions import ForbiddenError
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.ciclo_desempeno import (
    CalibracionRequest,
    CicloDesempenoCerrarRequest,
    CicloDesempenoCreate,
    CicloDesempenoResponse,
    CicloDesempenoResultadoResponse,
    CicloDesempenoUpdate,
    DistribucionResponse,
    MisResultadoResponse,
    NueveBoxResponse,
    PotencialUpdateRequest,
)
from app.services.ciclo_desempeno_service import CicloDesempenoService

router = APIRouter(prefix="/api/v1/ciclo-desempeno", tags=["Talento - Ciclo de Desempeno"])


def _svc(db: AsyncSession = Depends(get_db)) -> CicloDesempenoService:
    return CicloDesempenoService(db)


# ══════════════════════════════════════════════════════════════════════════
# Autorizacion y scoping por equipo (mismo patron que app/api/v1/metas/router.py)
# ══════════════════════════════════════════════════════════════════════════
def _gestion_or_equipo():
    """RH con modulo 'ciclo-desempeno' (`role_checker(["operativo"])`) O jefe
    con scoping de equipo (`gestor_team_role_checker`). Reutiliza ambos
    factories de `app/core/dependencies.py` sin duplicar su logica; si el
    primero rechaza (RH sin modulo / no admin operativo), se intenta el
    segundo."""
    rh_dep = role_checker(["operativo"])
    equipo_dep = gestor_team_role_checker(["supervisor", "gerente"])

    async def check(
        request: Request,
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    ) -> Empleado:
        try:
            return await rh_dep(
                request=request, current_user=current_user, db=db, rh_ui_mode=rh_ui_mode
            )
        except HTTPException:
            return await equipo_dep(current_user=current_user, rh_ui_mode=rh_ui_mode)

    return check


async def _resolve_scope(
    current_user: Empleado, rh_ui_mode: Optional[str], db: AsyncSession
) -> Optional[set[int]]:
    """`None` = acceso global (RH con modulo 'ciclo-desempeno' en modo
    operativo). De lo contrario, set de `empleado_id` (reportes directos,
    `Empleado.lider_id`) que el jefe puede gestionar."""
    from app.core.config import settings
    from app.core.rh_module_registry import user_has_module
    from app.core.rh_ui_mode import is_admin_user, is_rh_operativo_ui_mode

    if is_admin_user(current_user):
        is_global = is_rh_operativo_ui_mode(current_user, rh_ui_mode)
    else:
        rol_nombre = current_user.rol.nombre if current_user.rol else "empleado"
        is_global = rol_nombre == "rh" and user_has_module(current_user, "ciclo-desempeno")

    if is_global:
        return None

    repo = EmpleadoRepository(db)
    subordinados = await repo.get_subordinados(
        current_user.empleado_id, estados_activos=settings.ESTADOS_ACTIVOS_IDS
    )
    return {e.empleado_id for e in subordinados}


# ══════════════════════════════════════════════════════════════════════════
# Ciclos — administracion (solo RH global con modulo 'ciclo-desempeno')
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ciclos", response_model=list[CicloDesempenoResponse])
async def list_ciclos(
    estado: Optional[str] = Query(None),
    current_user: Empleado = Depends(_gestion_or_equipo()),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.list_ciclos(estado=estado)


@router.post("/ciclos", response_model=CicloDesempenoResponse, status_code=status.HTTP_201_CREATED)
async def create_ciclo(
    data: CicloDesempenoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.crear_ciclo(data, creado_por_id=current_user.empleado_id)


@router.get("/ciclos/{ciclo_id}", response_model=CicloDesempenoResponse)
async def get_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.get_ciclo(ciclo_id)


@router.put("/ciclos/{ciclo_id}", response_model=CicloDesempenoResponse)
async def update_ciclo(
    ciclo_id: int,
    data: CicloDesempenoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.actualizar_ciclo(ciclo_id, data)


@router.post("/ciclos/{ciclo_id}/activar", response_model=CicloDesempenoResponse)
async def activar_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.activar_ciclo(ciclo_id)


@router.post("/ciclos/{ciclo_id}/cerrar", response_model=CicloDesempenoResponse)
async def cerrar_ciclo(
    ciclo_id: int,
    data: CicloDesempenoCerrarRequest = CicloDesempenoCerrarRequest(),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.cerrar_ciclo(ciclo_id, forzar=data.forzar)


# ══════════════════════════════════════════════════════════════════════════
# Resultados / 9-Box / Potencial — gestion con scoping de equipo
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ciclos/{ciclo_id}/resultados", response_model=list[CicloDesempenoResultadoResponse])
async def resultados_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await svc.resultados_ciclo(ciclo_id, empleado_ids_scope=scope)


@router.get("/ciclos/{ciclo_id}/9box", response_model=NueveBoxResponse)
async def nueve_box(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await svc.construir_9box(ciclo_id, empleado_ids_scope=scope)


@router.put("/ciclos/{ciclo_id}/potencial", response_model=list[CicloDesempenoResultadoResponse])
async def set_potencial(
    ciclo_id: int,
    data: PotencialUpdateRequest,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await svc.set_potencial(
        ciclo_id,
        data.items,
        current_user_id=current_user.empleado_id,
        empleado_ids_scope=scope,
    )


# ══════════════════════════════════════════════════════════════════════════
# Calibracion — ajuste directo de banda (solo RH global) + distribucion
# ══════════════════════════════════════════════════════════════════════════
@router.put(
    "/ciclos/{ciclo_id}/calibracion",
    response_model=list[CicloDesempenoResultadoResponse],
)
async def calibrar_ciclo(
    ciclo_id: int,
    data: CalibracionRequest,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    """Calibracion es potestad de RH corporativo (alcance global). Un jefe de
    equipo (scope != None) recibe 403."""
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    if scope is not None:
        raise ForbiddenError("La calibracion es exclusiva de RH (alcance global)")
    return await svc.ajustar_banda(
        ciclo_id, data.items, current_user_id=current_user.empleado_id
    )


@router.get("/ciclos/{ciclo_id}/distribucion", response_model=DistribucionResponse)
async def distribucion_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await svc.distribucion_ciclo(ciclo_id, empleado_ids_scope=scope)


# ══════════════════════════════════════════════════════════════════════════
# Export — Excel basico de resultados (el service no expone un export propio;
# `CicloDesempenoService` no tiene equivalente a `MetasService.exportar_ciclo_excel`
# aun, ver brief de Tarea 5 -- se arma aqui un export minimo, sin logica de
# dominio, solo formato de columnas sobre `resultados_ciclo` ya scoped).
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ciclos/{ciclo_id}/export/excel")
async def export_ciclo_excel(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    from openpyxl import Workbook

    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    resultados = await svc.resultados_ciclo(ciclo_id, empleado_ids_scope=scope)

    wb = Workbook()
    ws = wb.active
    ws.title = "Resultados"
    ws.append([
        "empleado_id", "empleado_nombre", "cumplimiento_metas", "calificacion_360_norm",
        "calificacion_desempeno", "banda_desempeno", "potencial", "banda_potencial", "segmento_9box",
    ])
    for r in resultados:
        ws.append([
            r.empleado_id, r.empleado_nombre, r.cumplimiento_metas, r.calificacion_360_norm,
            r.calificacion_desempeno, r.banda_desempeno, r.potencial, r.banda_potencial, r.segmento_9box,
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ciclo_desempeno_{ciclo_id}.xlsx"},
    )


# ══════════════════════════════════════════════════════════════════════════
# Self-service — mis resultados (sin permiso de modulo)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/mis-resultados", response_model=list[MisResultadoResponse])
async def mis_resultados(
    current_user: Empleado = Depends(get_current_user),
    svc: CicloDesempenoService = Depends(_svc),
):
    return await svc.mis_resultados(current_user.empleado_id)
