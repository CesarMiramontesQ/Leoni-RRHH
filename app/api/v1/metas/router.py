# app/api/v1/metas/router.py
"""
Router del modulo Metas (OKR ligero) — objetivos con resultados clave.

Convenciones (ver app/api/v1/encuestas_rh/router.py):
  - Ciclos: gestion global de RH, exige `role_checker(["operativo"])` (RH con
    modulo 'metas' via middleware de permisos, o admin en Modo RH operativo).
  - Metas / resultados clave / checkin de ajuste / equipo / cumplimiento:
    gestion con SCOPING DE EQUIPO. Acceso combinado (ver `_gestion_or_equipo`):
    RH con modulo 'metas' en modo operativo (acceso global, sin scoping) O
    jefe (supervisor/gerente nativo, o admin/RH legacy en Modo lider/gerente)
    con scoping por equipo (reportes directos via `Empleado.lider_id`, ver
    `_resolve_scope`). El router NO reimplementa `role_checker`/
    `gestor_team_role_checker` — los reutiliza tal cual (patron real de
    `app/core/dependencies.py`).
  - "Mis metas" y el check-in del empleado son self-service (`get_current_user`);
    su prefijo (`/mis-metas`) esta en RH_SELF_SERVICE_API_PREFIXES para que el
    middleware de permisos por modulo no lo bloquee. El empleado siempre usa
    `current_user.empleado_id` — nunca un empleado_id del body/cliente.
  - El router SOLO instancia `MetasService` (nunca `MetasRepository`
    directamente): las lecturas de autorizacion que antes se resolvian con el
    repository (`get_ciclo` puntual, `get_rc` para resolver el dueno de un
    resultado clave) ahora usan los wrappers delgados `MetasService.get_ciclo`
    / `MetasService.get_rc_meta` (fix post-revision de Tarea 3, ver
    `.superpowers/sdd/task-3-report.md`).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, gestor_team_role_checker, role_checker
from app.core.exceptions import NotFoundError
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.metas import (
    CerrarMetaRequest,
    CheckinResponse,
    CumplimientoResponse,
    EquipoAvanceResponse,
    MetaCicloCreate,
    MetaCicloResponse,
    MetaCicloUpdate,
    MetaCreate,
    MetaFiltros,
    MetaResponse,
    MetaUpdate,
    ResultadoClaveCreate,
    ResultadoClaveResponse,
    ResultadoClaveUpdate,
)
from app.services.metas_service import MetasService

router = APIRouter(prefix="/api/v1/metas", tags=["Talento - Metas"])


def _svc(db: AsyncSession = Depends(get_db)) -> MetasService:
    return MetasService(db)


# ══════════════════════════════════════════════════════════════════════════
# Autorizacion y scoping por equipo
# ══════════════════════════════════════════════════════════════════════════
def _gestion_or_equipo():
    """RH con modulo 'metas' (`role_checker(["operativo"])`) O jefe con
    scoping de equipo (`gestor_team_role_checker`). Reutiliza ambos factories
    de `app/core/dependencies.py` sin duplicar su logica; si el primero
    rechaza (RH sin modulo / no admin operativo), se intenta el segundo."""
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
    """`None` = acceso global (RH con modulo 'metas' en modo operativo).
    De lo contrario, set de `empleado_id` (reportes directos, `Empleado.lider_id`)
    que el jefe puede gestionar."""
    from app.core.config import settings
    from app.core.rh_module_registry import user_has_module
    from app.core.rh_ui_mode import is_admin_user, is_rh_operativo_ui_mode

    if is_admin_user(current_user):
        is_global = is_rh_operativo_ui_mode(current_user, rh_ui_mode)
    else:
        rol_nombre = current_user.rol.nombre if current_user.rol else "empleado"
        is_global = rol_nombre == "rh" and user_has_module(current_user, "metas")

    if is_global:
        return None

    repo = EmpleadoRepository(db)
    subordinados = await repo.get_subordinados(
        current_user.empleado_id, estados_activos=settings.ESTADOS_ACTIVOS_IDS
    )
    return {e.empleado_id for e in subordinados}


def _validar_asignacion_en_scope(
    nivel: str,
    empleado_id: Optional[int],
    lider_id: Optional[int],
    scope: Optional[set[int]],
    jefe_empleado_id: int,
) -> None:
    """Valida que una asignacion de meta (creacion en `create_meta` o
    reasignacion via `MetaUpdate` en `update_meta`) caiga dentro del scope
    del jefe. Unica fuente de esta regla — NO duplicar en cada endpoint
    (fix post-revision de Tarea 3: `update_meta` reasignaba `empleado_id`/
    `lider_id` sin pasar por esta validacion)."""
    if scope is None:
        return
    if nivel == "equipo":
        if lider_id != jefe_empleado_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes asignar metas de equipo a tu propio equipo.",
            )
    elif empleado_id not in scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes asignar metas a empleados fuera de tu equipo.",
        )


def _meta_in_scope(meta: MetaResponse, scope: Optional[set[int]], jefe_empleado_id: int) -> bool:
    if scope is None:
        return True
    if meta.nivel == "equipo":
        return meta.lider_id == jefe_empleado_id
    return meta.empleado_id in scope


async def _get_meta_en_scope(
    svc: MetasService, meta_id: int, scope: Optional[set[int]], jefe_empleado_id: int
) -> MetaResponse:
    meta = await svc.get_meta(meta_id)
    if not _meta_in_scope(meta, scope, jefe_empleado_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta meta.",
        )
    return meta


async def _list_metas_scoped(
    svc: MetasService,
    scope: Optional[set[int]],
    jefe_empleado_id: int,
    *,
    ciclo_id: Optional[int],
    empleado_id: Optional[int],
    nivel: Optional[str],
) -> list[MetaResponse]:
    if scope is None:
        return await svc.list_metas(
            MetaFiltros(ciclo_id=ciclo_id, empleado_id=empleado_id, nivel=nivel)
        )

    if empleado_id is not None:
        if empleado_id not in scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a las metas de este empleado.",
            )
        return await svc.list_metas(
            MetaFiltros(ciclo_id=ciclo_id, empleado_id=empleado_id, nivel=nivel)
        )

    resultado: list[MetaResponse] = []
    if nivel in (None, "individual"):
        for eid in sorted(scope):
            resultado.extend(
                await svc.list_metas(
                    MetaFiltros(ciclo_id=ciclo_id, empleado_id=eid, nivel="individual")
                )
            )
    if nivel in (None, "equipo"):
        equipo = await svc.list_metas(MetaFiltros(ciclo_id=ciclo_id, nivel="equipo"))
        resultado.extend(m for m in equipo if m.lider_id == jefe_empleado_id)
    return resultado


# ══════════════════════════════════════════════════════════════════════════
# Ciclos — gestion global RH
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ciclos", response_model=list[MetaCicloResponse])
async def list_ciclos(
    estado: Optional[str] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    return await svc.list_ciclos(estado=estado)


@router.post("/ciclos", response_model=MetaCicloResponse, status_code=status.HTTP_201_CREATED)
async def create_ciclo(
    data: MetaCicloCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    data = data.model_copy(update={"creado_por_id": current_user.empleado_id})
    return await svc.crear_ciclo(data)


@router.get("/ciclos/{ciclo_id}", response_model=MetaCicloResponse)
async def get_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    return await svc.get_ciclo(ciclo_id)


@router.put("/ciclos/{ciclo_id}", response_model=MetaCicloResponse)
async def update_ciclo(
    ciclo_id: int,
    data: MetaCicloUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    return await svc.actualizar_ciclo(ciclo_id, data)


@router.post("/ciclos/{ciclo_id}/activar", response_model=MetaCicloResponse)
async def activar_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    return await svc.activar_ciclo(ciclo_id)


@router.post("/ciclos/{ciclo_id}/cerrar", response_model=MetaCicloResponse)
async def cerrar_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: MetasService = Depends(_svc),
):
    return await svc.cerrar_ciclo(ciclo_id)


# ══════════════════════════════════════════════════════════════════════════
# Metas — gestion con scoping de equipo (jefe) o global (RH modulo 'metas')
# ══════════════════════════════════════════════════════════════════════════
@router.get("/metas", response_model=list[MetaResponse])
async def list_metas(
    ciclo_id: Optional[int] = Query(None),
    empleado_id: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await _list_metas_scoped(
        svc, scope, current_user.empleado_id,
        ciclo_id=ciclo_id, empleado_id=empleado_id, nivel=nivel,
    )


@router.post("/metas", response_model=MetaResponse, status_code=status.HTTP_201_CREATED)
async def create_meta(
    data: MetaCreate,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    _validar_asignacion_en_scope(
        data.nivel, data.empleado_id, data.lider_id, scope, current_user.empleado_id
    )
    data = data.model_copy(update={"asignada_por_id": current_user.empleado_id})
    return await svc.crear_meta(data)


@router.get("/metas/{meta_id}", response_model=MetaResponse)
async def get_meta(
    meta_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)


@router.put("/metas/{meta_id}", response_model=MetaResponse)
async def update_meta(
    meta_id: int,
    data: MetaUpdate,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    meta = await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    # Fix post-revision de Tarea 3 (seguridad): `MetaUpdate` acepta
    # `empleado_id`/`lider_id` — si el jefe intenta REASIGNAR la meta via
    # estos campos, el nuevo valor tambien debe caer en su scope (si solo se
    # validara la meta ANTES de aplicar el update, un jefe dueño podria
    # reasignarla a un empleado/lider fuera de su equipo). Se reutiliza el
    # mismo helper que usa `create_meta`, sin duplicar la logica.
    if scope is not None:
        payload = data.model_dump(exclude_unset=True)
        if "empleado_id" in payload or "lider_id" in payload:
            _validar_asignacion_en_scope(
                meta.nivel,
                payload.get("empleado_id", meta.empleado_id),
                payload.get("lider_id", meta.lider_id),
                scope,
                current_user.empleado_id,
            )
    return await svc.actualizar_meta(meta_id, data)


@router.delete("/metas/{meta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meta(
    meta_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    await svc.eliminar_meta(meta_id)


@router.post("/metas/{meta_id}/cerrar", response_model=MetaResponse)
async def cerrar_meta(
    meta_id: int,
    data: CerrarMetaRequest,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    return await svc.cerrar_meta(
        meta_id,
        calificacion=data.calificacion,
        comentario=data.comentario,
        actor_id=current_user.empleado_id,
    )


# ══════════════════════════════════════════════════════════════════════════
# Resultados clave — mismo scoping que la meta duena
# ══════════════════════════════════════════════════════════════════════════
@router.post(
    "/metas/{meta_id}/resultados",
    response_model=ResultadoClaveResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_resultado(
    meta_id: int,
    data: ResultadoClaveCreate,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    return await svc.agregar_rc(meta_id, data)


@router.put("/metas/{meta_id}/resultados/{rc_id}", response_model=ResultadoClaveResponse)
async def update_resultado(
    meta_id: int,
    rc_id: int,
    data: ResultadoClaveUpdate,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    meta = await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    if rc_id not in {rc.id for rc in meta.resultados_clave}:
        raise NotFoundError("Resultado clave", rc_id)
    return await svc.actualizar_rc(rc_id, data)


@router.delete(
    "/metas/{meta_id}/resultados/{rc_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_resultado(
    meta_id: int,
    rc_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    meta = await _get_meta_en_scope(svc, meta_id, scope, current_user.empleado_id)
    if rc_id not in {rc.id for rc in meta.resultados_clave}:
        raise NotFoundError("Resultado clave", rc_id)
    await svc.eliminar_rc(rc_id)


# ══════════════════════════════════════════════════════════════════════════
# Ajuste de avance por el jefe (checkin con es_ajuste_jefe=True)
# ══════════════════════════════════════════════════════════════════════════
class AjusteCheckinRequest(BaseModel):
    valor: Decimal
    nota: Optional[str] = None


@router.post(
    "/resultados/{rc_id}/checkin",
    response_model=CheckinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ajuste_checkin(
    rc_id: int,
    data: AjusteCheckinRequest,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    # `MetasService.registrar_checkin` no valida por si solo que el rc_id
    # pertenezca al scope del jefe (no conoce el concepto de equipo) — se
    # resuelve la meta dueña vía `svc.get_rc_meta` (wrapper de service, no
    # repository directo) para aplicar el mismo scoping que el resto de
    # endpoints de meta.
    meta = await svc.get_rc_meta(rc_id)
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    if not _meta_in_scope(meta, scope, current_user.empleado_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este resultado clave.",
        )
    return await svc.registrar_checkin(
        rc_id,
        autor_id=current_user.empleado_id,
        valor=data.valor,
        nota=data.nota,
        es_ajuste_jefe=True,
    )


# ══════════════════════════════════════════════════════════════════════════
# Equipo — tablero de avance y cumplimiento por empleado
# ══════════════════════════════════════════════════════════════════════════
@router.get("/equipo/avance", response_model=EquipoAvanceResponse)
async def equipo_avance(
    ciclo_id: int = Query(...),
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    """Tablero de avance del equipo del jefe (o del ciclo completo si RH con
    modulo 'metas' en modo operativo, ver `_resolve_scope`): agrupado por
    miembro (metas individuales + avance global ponderado) con las metas de
    equipo (lider_id) aparte — ver `MetasService.construir_equipo_avance`."""
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    metas = await _list_metas_scoped(
        svc, scope, current_user.empleado_id,
        ciclo_id=ciclo_id, empleado_id=None, nivel=None,
    )
    return await svc.construir_equipo_avance(ciclo_id, metas)


@router.get("/empleados/{empleado_id}/cumplimiento", response_model=CumplimientoResponse)
async def cumplimiento_empleado(
    empleado_id: int,
    ciclo_id: int = Query(...),
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    if scope is not None and empleado_id not in scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este empleado.",
        )
    cumplimiento = await svc.cumplimiento_empleado(ciclo_id, empleado_id)
    metas = await svc.list_metas(
        MetaFiltros(ciclo_id=ciclo_id, empleado_id=empleado_id, nivel="individual")
    )
    metas_consideradas = sum(1 for m in metas if m.estado == "cerrada")
    return CumplimientoResponse(
        ciclo_id=ciclo_id,
        empleado_id=empleado_id,
        cumplimiento=cumplimiento,
        metas_consideradas=metas_consideradas,
    )


# ══════════════════════════════════════════════════════════════════════════
# Export — Excel (patron Eval360: openpyxl + StreamingResponse)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ciclos/{ciclo_id}/export/excel")
async def export_ciclo_excel(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: MetasService = Depends(_svc),
):
    """Exporta a `.xlsx` las metas del ciclo (mismo scoping de equipo que el
    resto de endpoints de gestion: RH con modulo 'metas' ve el ciclo
    completo, el jefe solo las metas de su equipo)."""
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    metas = await _list_metas_scoped(
        svc, scope, current_user.empleado_id,
        ciclo_id=ciclo_id, empleado_id=None, nivel=None,
    )
    output = await svc.exportar_ciclo_excel(ciclo_id, metas)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=metas_ciclo_{ciclo_id}.xlsx"},
    )


# ══════════════════════════════════════════════════════════════════════════
# Self-service — mis metas (sin permiso de modulo)
# ══════════════════════════════════════════════════════════════════════════
class MiCheckinRequest(BaseModel):
    valor: Decimal
    nota: Optional[str] = None


@router.get("/mis-metas", response_model=list[MetaResponse])
async def mis_metas(
    ciclo_id: Optional[int] = Query(None),
    current_user: Empleado = Depends(get_current_user),
    svc: MetasService = Depends(_svc),
):
    return await svc.list_mis_metas(current_user.empleado_id, ciclo_id=ciclo_id)


@router.get("/mis-metas/{meta_id}", response_model=MetaResponse)
async def mi_meta_detalle(
    meta_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: MetasService = Depends(_svc),
):
    return await svc.get_mi_meta(meta_id, current_user.empleado_id)


@router.post(
    "/mis-metas/resultados/{rc_id}/checkin",
    response_model=CheckinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def mi_checkin(
    rc_id: int,
    data: MiCheckinRequest,
    current_user: Empleado = Depends(get_current_user),
    svc: MetasService = Depends(_svc),
):
    # `empleado_id` SIEMPRE del token — nunca del cliente (`MiCheckinRequest`
    # no tiene ese campo, asi que no hay forma de que el body lo cuele).
    meta = await svc.get_rc_meta(rc_id)
    if meta.empleado_id != current_user.empleado_id:
        raise NotFoundError("Resultado clave", rc_id)
    return await svc.registrar_checkin(
        rc_id,
        autor_id=current_user.empleado_id,
        valor=data.valor,
        nota=data.nota,
        es_ajuste_jefe=False,
    )
