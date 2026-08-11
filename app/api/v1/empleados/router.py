# app/api/v1/empleados/router.py
"""
Directorio y consulta de empleados — RH, gerente, director y supervisor.

- RH: listado completo, KPIs de plantilla, catálogo global (áreas y puestos).
- Resto: solo empleados en estados activos y mismo catálogo.

CRUD de cuentas: /api/v1/usuarios (solo RH).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.core.rh_ui_mode import has_rh_plantilla_data_scope, is_rh_gestor_team_ui_mode
from app.models.empleados import Empleado
from app.schemas.actas import ActasPageResponse
from app.schemas.empleados import DescansosEmpleadoResponse
from app.schemas.usuarios import (
    CatalogoFiltrosResponse,
    MetricasUsuarioResponse,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioVista360Response,
)
from app.schemas.solicitudes import HomeOfficeDisponibilidadResponse
from app.schemas.vacaciones import (
    SaldoVacacionesRealResponse,
    VacacionesDisponibleSolicitudResponse,
)
from app.services.acta_service import ActaService
from app.services.descansos_empleado_service import DescansosEmpleadoService
from app.services.empleado_foto_service import EmpleadoFotoService
from app.services.solicitud_service import SolicitudService
from app.services.usuario_service import UsuarioService
from app.services.vacaciones_service import VacacionesService

router = APIRouter(prefix="/api/v1/empleados", tags=["Empleados - Directorio"])

_ROLES_DIRECTORIO = ["operativo", "gerente", "director", "supervisor"]


def _svc(db: AsyncSession = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


def _vac_svc(db: AsyncSession = Depends(get_db)) -> VacacionesService:
    return VacacionesService(db)


def _sol_svc(db: AsyncSession = Depends(get_db)) -> SolicitudService:
    return SolicitudService(db)


def _foto_svc(db: AsyncSession = Depends(get_db)) -> EmpleadoFotoService:
    return EmpleadoFotoService(db)


def _descansos_svc(db: AsyncSession = Depends(get_db)) -> DescansosEmpleadoService:
    return DescansosEmpleadoService(db)


def _rol_nombre(u: Empleado) -> str:
    return u.rol.nombre if u.rol else "empleado"


@router.get("/resumen", response_model=UsuarioResumenResponse)
async def resumen_empleados(
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: UsuarioService = Depends(_svc),
):
    if has_rh_plantilla_data_scope(current_user, rh_ui_mode, module_key="empleados"):
        return await svc.resumen_plantilla(current_user)
    return await svc.resumen_directorio(current_user, rh_ui_mode=rh_ui_mode)


@router.get("/catalogo-filtros", response_model=CatalogoFiltrosResponse)
async def catalogo_empleados(
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: UsuarioService = Depends(_svc),
):
    if has_rh_plantilla_data_scope(current_user, rh_ui_mode, module_key="empleados"):
        return await svc.catalogo_filtros(current_user)
    return await svc.catalogo_directorio(current_user, rh_ui_mode=rh_ui_mode)


@router.get("", response_model=UsuarioPageResponse)
async def list_empleados(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None),
    area_id: int | None = Query(None),
    puesto_id: list[int] | None = Query(
        None,
        description="Permite múltiples valores: ?puesto_id=1&puesto_id=2",
    ),
    activo: bool | None = Query(
        None,
        description="Solo RH: true=activos, false=no activos, omitir=todos",
    ),
    estatus: str | None = Query(
        None,
        description="Solo supervisor/gerente: activo | inactivo | permiso (omitir=activos)",
    ),
    solo_contratos_por_vencer: bool = Query(
        False,
        description="Solo supervisor/gerente: filtra por contrato en ventana 30 días",
    ),
    solo_sin_lider: bool = Query(
        False,
        description="Solo RH: empleados activos sin líder asignado (mismo criterio que KPI)",
    ),
    solo_sin_email: bool = Query(
        False,
        description="Solo RH: administrativos activos sin email registrado (mismo criterio que KPI)",
    ),
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: UsuarioService = Depends(_svc),
):
    r = _rol_nombre(current_user)
    if has_rh_plantilla_data_scope(current_user, rh_ui_mode, module_key="empleados"):
        return await svc.list_usuarios_page(
            page=page,
            page_size=page_size,
            q=q,
            area_id=area_id,
            puesto_id=puesto_id,
            current_user=current_user,
            activo=activo,
            solo_sin_lider=solo_sin_lider,
            solo_sin_email=solo_sin_email,
        )
    if estatus is not None and estatus.strip():
        v = estatus.strip().lower()
        allowed = {"activo", "activos", "inactivo", "inactivos", "permiso"}
        if v not in allowed:
            raise HTTPException(
                status_code=422,
                detail="estatus debe ser activo, inactivo o permiso",
            )
    use_lider_filtros = r in ("supervisor", "gerente") or is_rh_gestor_team_ui_mode(
        current_user, rh_ui_mode
    )
    return await svc.list_directorio_empleados_page(
        page=page,
        page_size=page_size,
        q=q,
        area_id=area_id,
        puesto_id=puesto_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
        estatus_filtro=estatus if use_lider_filtros else None,
        solo_contratos_por_vencer=solo_contratos_por_vencer if use_lider_filtros else False,
    )


@router.get(
    "/{empleado_id}/descansos",
    response_model=DescansosEmpleadoResponse,
)
async def get_descansos_empleado(
    empleado_id: int,
    fecha_inicio: date = Query(..., description="Inicio inclusivo del rango"),
    fecha_fin: date = Query(..., description="Fin inclusivo del rango; máximo 366 días"),
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    svc: DescansosEmpleadoService = Depends(_descansos_svc),
):
    """Descansos del empleado, proyectados desde el turno vigente (cachés de Bono). Mismos roles que faltas/directorio."""
    return await svc.obtener_descansos(
        empleado_id=empleado_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )


@router.get(
    "/{empleado_id}/saldo-vacaciones-real",
    response_model=SaldoVacacionesRealResponse,
)
async def get_saldo_vacaciones_real(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: VacacionesService = Depends(_vac_svc),
):
    """Saldo real de días de gozo desde SQL Server datos-analisis (función GET_SALDOS_VACACION)."""
    return await svc.obtener_saldo_real(empleado_id=empleado_id, current_user=current_user)


@router.get(
    "/{empleado_id}/vacaciones-disponibles-solicitud",
    response_model=VacacionesDisponibleSolicitudResponse,
)
async def get_vacaciones_disponibles_solicitud(
    empleado_id: int,
    excluir_solicitud_id: int | None = Query(
        None,
        description="Excluir solicitud al sumar comprometidos (detalle de una pendiente).",
    ),
    current_user: Empleado = Depends(get_current_user),
    svc: SolicitudService = Depends(_sol_svc),
):
    """Días disponibles para solicitar vacaciones = saldo TRESS − comprometidos en curso."""
    return await svc.obtener_disponible_vacaciones(
        empleado_id=empleado_id,
        current_user=current_user,
        exclude_solicitud_id=excluir_solicitud_id,
    )


@router.get(
    "/{empleado_id}/home-office/disponibilidad",
    response_model=HomeOfficeDisponibilidadResponse,
)
async def get_home_office_disponibilidad_empleado(
    empleado_id: int,
    fecha: date = Query(..., description="Fecha de referencia (mes calendario a validar)"),
    excluir_solicitud_id: int | None = Query(
        None,
        description="Excluir solicitud al corregir (changes_requested)",
    ),
    current_user: Empleado = Depends(get_current_user),
    svc: SolicitudService = Depends(_sol_svc),
):
    """Indica si el colaborador puede solicitar Home Office en el mes de `fecha`."""
    return await svc.home_office_disponibilidad_mes(
        empleado_id=empleado_id,
        fecha_referencia=fecha,
        current_user=current_user,
        exclude_solicitud_id=excluir_solicitud_id,
    )


@router.get("/{empleado_id}/foto")
async def get_empleado_foto(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: EmpleadoFotoService = Depends(_foto_svc),
):
    """Fotografía del empleado desde el directorio RH/Images (requiere JWT)."""
    data, media_type = await svc.get_foto_for_empleado(
        empleado_id=empleado_id,
        current_user=current_user,
    )
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.get("/{empleado_id}/vista360", response_model=UsuarioVista360Response)
async def get_vista360(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_vista360(
        id=empleado_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
    )


@router.get("/{empleado_id}/metricas", response_model=MetricasUsuarioResponse)
async def get_metricas(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_metricas(
        id=empleado_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
    )


@router.get("/{empleado_id}/actas", response_model=ActasPageResponse)
async def list_empleado_actas(
    empleado_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    db: AsyncSession = Depends(get_db),
):
    """Actas administrativas del empleado (tab Vista 360)."""
    return await ActaService(db).list_actas_empleado_page(
        empleado_id=empleado_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )
