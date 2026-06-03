# app/api/v1/comedor/router.py
from datetime import date
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    require_comedor_terminal_ip,
    require_huella_ip,
    require_torniquete_api_key,
    role_checker,
)
from app.models.empleados import Empleado
from app.schemas.comedor import (
    ComedorAccesoReservaCreate,
    ComedorAccesoReservaResponse,
    ComedorAccesoReservaUpdate,
    ComedorAsignadoResponse,
    ComedorCreate,
    ComedorUpdate,
    ComedorMisFechasOcupadasResponse,
    ComedorMisReservaItem,
    ComedorEquipoReservaItem,
    ComedorEquipoBeneficiarioItem,
    ComedorResumenDiarioItem,
    ComedorRhSemanaRegistrosFuturosItem,
    ComedorRhProximosRegistrosPage,
    ComedorRhRegistroCreate,
    ComedorRhRegistroResponse,
    ComedorCodigoExternoItem,
    ComedorPrimeraFechaReservaResponse,
    ComedorRegistroCreate,
    ComedorRegistroResponse,
    ComedorResponse,
    ComedorTerminalAccederRequest,
    ComedorTerminalAccederResponse,
    ComedorTerminalConsumirRequest,
    ComedorTerminalConsumirResponse,
    HuellaValidarRequest,
    HuellaValidarResponse,
    MenuSemanalCreate,
    MenuSemanalDeleteResponse,
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


@router.post("/comedores", response_model=ComedorResponse)
async def crear_comedor(
    body: ComedorCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Alta de comedor (solo RH)."""
    service = ComedorService(db)
    return await service.crear_comedor(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/comedores/{comedor_id}", response_model=ComedorResponse)
async def editar_comedor(
    comedor_id: int,
    body: ComedorUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Edición de comedor (solo RH)."""
    service = ComedorService(db)
    return await service.editar_comedor(
        comedor_id=comedor_id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


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


@router.delete("/menu", response_model=MenuSemanalDeleteResponse)
async def eliminar_menu_semana(
    background_tasks: BackgroundTasks,
    comedor_id: int = Query(...),
    semana: date = Query(...),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.eliminar_menu_semana(
        comedor_id=comedor_id,
        semana=semana,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.get("/mi-comedor-asignado", response_model=ComedorAsignadoResponse)
async def mi_comedor_asignado(
    target_user_id: int | None = Query(
        default=None,
        description="Beneficiario (solo supervisor al registrar para su equipo).",
    ),
    current_user: Empleado = Depends(
        role_checker(["empleado", "supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Comedor asignado al empleado según `turnos_empleados` y catálogo `comedores`."""
    service = ComedorService(db)
    return await service.get_comedor_asignado(
        current_user=current_user,
        target_user_id=target_user_id,
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


@router.get(
    "/accesos/primera-fecha-permitida",
    response_model=ComedorPrimeraFechaReservaResponse,
)
async def primera_fecha_reserva_comedor(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alinea el calendario de reservas con la regla de negocio (zona APP_TIMEZONE)."""
    service = ComedorService(db)
    return service.primera_fecha_reserva_permitida()


@router.get("/accesos/mis-reservas", response_model=list[ComedorMisReservaItem])
async def list_mis_reservas_comedor(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    current_user: Empleado = Depends(role_checker(["empleado"])),
    db: AsyncSession = Depends(get_db),
):
    """Reservas del empleado en un mes (calendario personal)."""
    service = ComedorService(db)
    return await service.list_mis_reservas_mes(
        current_user=current_user,
        anio=anio,
        mes=mes,
    )


@router.get(
    "/accesos/mis-fechas-ocupadas",
    response_model=ComedorMisFechasOcupadasResponse,
)
async def mis_fechas_ocupadas_comedor(
    desde: date = Query(..., description="Inicio del rango (inclusive)"),
    hasta: date = Query(..., description="Fin del rango (inclusive)"),
    current_user: Empleado = Depends(role_checker(["empleado"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Días con reserva activa (PENDIENTE o ACCEDIDO) para deshabilitar/validar en el registro.
    """
    if hasta < desde:
        raise HTTPException(
            status_code=422,
            detail="El parametro 'hasta' debe ser mayor o igual que 'desde'.",
        )
    service = ComedorService(db)
    return await service.list_mis_fechas_ocupadas(
        current_user=current_user,
        desde=desde,
        hasta=hasta,
    )


@router.get("/accesos/mis-proximas-reservas", response_model=list[ComedorMisReservaItem])
async def mis_proximas_reservas_comedor(
    limite: int = Query(5, ge=1, le=200),
    current_user: Empleado = Depends(role_checker(["empleado"])),
    db: AsyncSession = Depends(get_db),
):
    """Top N reservas próximas del empleado desde hoy (por defecto 5, máx. 200)."""
    service = ComedorService(db)
    return await service.list_mis_proximas_reservas(
        current_user=current_user,
        limite=limite,
    )


@router.get("/accesos/equipo/mis-proximas-reservas", response_model=list[ComedorEquipoReservaItem])
async def equipo_proximas_reservas_comedor(
    limite: int = Query(50, ge=1, le=200),
    current_user: Empleado = Depends(role_checker(["supervisor", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    """Top N reservas próximas del equipo del supervisor/gerente desde hoy."""
    service = ComedorService(db)
    return await service.list_equipo_proximas_reservas(
        current_user=current_user,
        limite=limite,
    )


@router.get("/accesos/equipo/beneficiarios", response_model=list[ComedorEquipoBeneficiarioItem])
async def equipo_beneficiarios_comedor(
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Beneficiarios seleccionables por supervisor: yo + equipo directo."""
    service = ComedorService(db)
    return await service.list_equipo_beneficiarios_directos(current_user=current_user)


@router.get("/accesos/equipo/mis-reservas", response_model=list[ComedorEquipoReservaItem])
async def equipo_reservas_mes_comedor(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    current_user: Empleado = Depends(role_checker(["supervisor", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    """Reservas del equipo del supervisor/gerente en un mes (calendario de equipo)."""
    service = ComedorService(db)
    return await service.list_equipo_reservas_mes(
        current_user=current_user,
        anio=anio,
        mes=mes,
    )


@router.get("/accesos/equipo/metricas")
async def equipo_metricas_comedor(
    current_user: Empleado = Depends(role_checker(["supervisor", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    """Tarjetas de métricas para dashboard de supervisor/gerente."""
    service = ComedorService(db)
    return await service.get_equipo_metricas_dashboard(current_user=current_user)


@router.get("/accesos/rh/resumen-diario", response_model=list[ComedorResumenDiarioItem])
async def rh_resumen_diario_comedor(
    desde: date = Query(..., description="Inicio del rango (inclusive)"),
    hasta: date = Query(..., description="Fin del rango (inclusive)"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.list_resumen_diario_rh(
        current_user=current_user,
        desde=desde,
        hasta=hasta,
    )


@router.get(
    "/accesos/rh/registros-futuros-por-semana",
    response_model=list[ComedorRhSemanaRegistrosFuturosItem],
)
async def rh_registros_futuros_por_semana_comedor(
    semanas: int = Query(8, ge=1, le=16, description="Máximo de semanas futuras a devolver"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Totales de registros activos agrupados por semana ISO (solo fechas >= hoy)."""
    service = ComedorService(db)
    return await service.list_registros_futuros_por_semana_rh(
        current_user,
        semanas=semanas,
    )


@router.get("/accesos/rh/proximos-registros", response_model=ComedorRhProximosRegistrosPage)
async def rh_proximos_registros_comedor(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    buscar: str | None = Query(None, max_length=200),
    filtro_estado: Literal["todos", "confirmado", "cancelado"] = Query("todos"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Accesos futuros (fecha_servicio >= hoy), filtrables por estado y búsqueda por empleado."""
    service = ComedorService(db)
    return await service.list_proximos_registros_rh_paginated(
        current_user=current_user,
        page=page,
        page_size=page_size,
        buscar=buscar,
        filtro_estado=filtro_estado,
    )


@router.get("/accesos/rh/registros-reporte", response_model=ComedorRhProximosRegistrosPage)
async def rh_registros_reporte_comedor(
    desde: date = Query(..., description="Inicio del rango (inclusive)"),
    hasta: date = Query(..., description="Fin del rango (inclusive)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    buscar: str | None = Query(None, max_length=200),
    filtro_estado: Literal["todos", "confirmado", "cancelado"] = Query("todos"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Registros operativos en un rango de fechas (inclusive), para tableros analíticos RH."""
    service = ComedorService(db)
    return await service.list_registros_reporte_rh_paginated(
        current_user=current_user,
        desde=desde,
        hasta=hasta,
        page=page,
        page_size=page_size,
        buscar=buscar,
        filtro_estado=filtro_estado,
    )


@router.post(
    "/accesos/reservar",
    response_model=ComedorAccesoReservaResponse | list[ComedorAccesoReservaResponse],
)
async def reservar_acceso_dia(
    body: ComedorAccesoReservaCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    """Pre-autorización por día y tipo de comida (empleado, supervisor y gerente)."""
    service = ComedorService(db)
    reservas = await service.reservar_acceso_dia(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )
    return reservas[0] if len(reservas) == 1 else reservas


@router.post("/accesos/rh/registro", response_model=ComedorRhRegistroResponse)
async def registrar_acceso_rh(
    body: ComedorRhRegistroCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.crear_registro_rh(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.get("/accesos/rh/codigos-externos", response_model=list[ComedorCodigoExternoItem])
async def listar_codigos_externos_rh(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    estatus: str | None = Query(None, description="ACTIVO|USADO_PARCIAL|USADO_TOTAL|VENCIDO"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.list_codigos_externos_rh(
        current_user=current_user,
        desde=desde,
        hasta=hasta,
        estatus=estatus,
    )


@router.put("/accesos/{acceso_id}", response_model=ComedorAccesoReservaResponse)
async def editar_acceso_dia(
    acceso_id: int,
    body: ComedorAccesoReservaUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    return await service.editar_mi_reserva(
        acceso_id=acceso_id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.delete("/accesos/{acceso_id}", status_code=204)
async def cancelar_acceso_dia(
    acceso_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    service = ComedorService(db)
    await service.cancelar_mi_reserva(
        acceso_id=acceso_id,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.post("/terminal/acceder", response_model=ComedorTerminalAccederResponse)
async def terminal_acceder(
    body: ComedorTerminalAccederRequest,
    _: None = Depends(require_comedor_terminal_ip),
    __: None = Depends(require_torniquete_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Login en terminal del comedor: misma autenticación que el portal + reserva PENDIENTE para hoy.
    Solo red whitelist (COMEDOR_TERMINAL_IPS o HUELLA_WHITELIST_IPS).
    """
    service = ComedorService(db)
    return await service.terminal_acceder(data=body)


@router.post("/terminal/consumir", response_model=ComedorTerminalConsumirResponse)
async def terminal_consumir(
    body: ComedorTerminalConsumirRequest,
    _: None = Depends(require_comedor_terminal_ip),
    __: None = Depends(require_torniquete_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Marca el acceso del día como ACCEDIDO tras apertura del torniquete."""
    service = ComedorService(db)
    return await service.terminal_consumir(data=body)


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
