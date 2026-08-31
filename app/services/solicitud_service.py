# app/services/solicitud_service.py
"""
Logica de negocio del dominio solicitudes.

Flujo de estados:
  pending → approved   (via aprobar_solicitud)
  pending → rejected   (via rechazar_solicitud)
  pending → cancelled  (via cancelar_solicitud — solo el propio empleado)
  pending/rejected → overridden  (via override_solicitud — director o rh)
  pending → changes_requested  (via solicitar_cambios_solicitud — aprobador)
  changes_requested → pending  (via requisitor_actualizar_y_reenviar — solo el solicitante)

Jerarquia supervisor/gerente: una sola aprobacion o rechazo valido basta (supervisor o gerente con el
solicitante en su subarbol jerarquico, o gerente de linea, en cualquier orden; no hay segunda etapa
obligatoria).

Al aprobar: estado `approved`, registro de aprobacion, push a TRESS y notificacion
in-app al requisitor. Vacaciones, home office y goce FJ usan INSERT SQL sincrono;
si falla, la solicitud sigue pending. Al rechazar/cancelar: NO se envia a TRESS.
"""

import logging
from datetime import date, timedelta
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_for_module, empleado_ids_scope_por_modulo
from app.core.rh_ui_mode import (
    is_rh_empleado_ui_mode,
    rh_tiene_alcance_gestor,
)
from app.utils.business_time import business_today
from app.utils.calendar_weeks import split_calendar_weeks
from app.utils.clasificacion_empleado import empleado_es_administrativo
from app.utils.homeoffice_periodo import bloque_semanas
from app.utils.vacaciones_fechas import (
    defuncion_rango_para_empleado,
    paternidad_rango,
    rango_incluye_fin_de_semana,
)
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    LeoniException,
    NotFoundError,
)
from app.integrations.tress.queue import encolar_tress
from app.services.descansos_empleado_service import obtener_descansos_bono
from app.services.tress_goce_service import (
    FALTA_RETARDO_TIPOS_GOCE_FJ,
    GOCE_PM_COMENTA,
    registrar_permisos_goce_tramos_en_tress,
)
from app.services.tress_home_office_service import registrar_home_office_en_tress
from app.services.tress_vacaciones_service import registrar_vacaciones_en_tress
from app.models.empleados import Empleado
from app.models.empleados_rh import ensure_rh_config
from app.models.solicitudes import Solicitud
from app.repositories.comedor_repository import ComedorAccesoRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.dias_festivos_repository import DiasFestivosRepository
from app.repositories.homeoffice_reglas_area_repository import HomeOfficeReglasAreaRepository
from app.repositories.solicitud_repository import (
    SolicitudAprobacionRepository,
    SolicitudRepository,
)
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    AlcanceEquipoResponse,
    AlcanceEquipoUpdate,
    ESTADO_SOLICITUD_APROBADA,
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudRequisitorRevision,
    SolicitudResponse,
    SolicitudSolicitarCambiosBody,
)
from app.schemas.vacaciones import VacacionesDisponibleSolicitudResponse
from app.services.notificacion_service import NotificacionService
from app.services.sync_homeoffice_tomados_service import (
    sincronizar_homeoffice_empleado_background,
)
from app.services.sync_vacaciones_disponibles_service import (
    sincronizar_vacaciones_empleado_background,
)
from app.services.vacaciones_service import VacacionesService
from app.utils.audit_logger import audit_background
from app.utils import audit_logger as audit_logger_mod
from app.utils.descansos_fechas import (
    avanzar_hasta_reunir_dias,
    fechas_efectivas_en_rango,
    partir_tramos_por_semanas,
    tramos_consecutivos,
)

logger = logging.getLogger(__name__)

# Acciones TRESS por tipo de solicitud
_TRESS_ACCION_MAP = {
    "vacaciones": "REGISTRAR_VACACIONES",
    "home_office": "REGISTRAR_HOME_OFFICE",
    "permiso_sin_goce_sueldo": "REGISTRAR_PERMISO_SIN_GOCE_SUELDO",
}
_TIPOS_GOCE_SUELDO_RH = frozenset({
    "matrimonio",
    "incapacidad_interna",
    "defuncion",
    "paternidad",
})
_DIAS_GOCE_SUELDO = {
    "matrimonio": 2,
    "defuncion": 3,
    "paternidad": 7,
}
_TIPOS_VISIBLE_EMPLEADO = frozenset({
    "vacaciones",
    "home_office",
    "permiso_sin_goce_sueldo",
})
_ESTADOS_NO_VISIBLES_EMPLEADO = frozenset({"overridden"})

# Duplicidad exacta (mismo colaborador, mismas fechas inicio/fin): solo estos estados
# cuentan como «ya existe»; rechazadas/canceladas permiten volver a registrar esas fechas.
_ESTADOS_DUPLICADO_EXACTO = frozenset({"pending", "approved", "overridden", "changes_requested"})
# Empalme/solape (mismo colaborador, rangos que se traslapan, cualquier tipo): se usa el
# mismo conjunto de estados activos. Solicitudes rechazadas o canceladas no bloquean.
_ESTADOS_EMPALME_ACTIVO = _ESTADOS_DUPLICADO_EXACTO
# Solicitudes de vacaciones que "comprometen" días frente al saldo TRESS: en curso, aún no
# enviadas a TRESS. Las aprobadas se excluyen (ya encoladas; TRESS bajará su saldo al procesar).
_ESTADOS_VACACIONES_COMPROMETIDAS = frozenset({"pending", "changes_requested"})
_MSG_SOLICITUD_YA_EXISTE = "Esta solicitud ya existe"


def _format_fecha_es(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _msg_empalme_solicitudes(existente: Solicitud) -> str:
    """Mensaje claro y único cuando una nueva solicitud se empalma con otra activa."""
    tipo_legible = (existente.tipo or "").replace("_", " ").strip() or "otra"
    return (
        f"Ya existe una solicitud activa de {tipo_legible} del "
        f"{_format_fecha_es(existente.fecha_inicio)} al {_format_fecha_es(existente.fecha_fin)} "
        "que se empalma con estas fechas. No es posible registrar dos solicitudes "
        "que se traslapen, aunque sean de tipos distintos."
    )


def _dias_solicitud_inclusive(fecha_inicio: date, fecha_fin: date) -> int:
    return (fecha_fin - fecha_inicio).days + 1


def _validar_matrimonio_fechas(fecha_inicio: date, fecha_fin: date) -> None:
    if _dias_solicitud_inclusive(fecha_inicio, fecha_fin) != 2:
        raise DomainValidationError(
            detail=(
                "Matrimonio solo permite solicitar exactamente 2 días consecutivos "
                "(fecha fin debe ser un día después de la fecha de inicio)."
            )
        )


def _validar_defuncion_fechas(
    fecha_inicio: date,
    fecha_fin: date,
    *,
    administrativo: bool,
) -> None:
    esperado_inicio, esperado_fin = defuncion_rango_para_empleado(
        fecha_inicio,
        administrativo=administrativo,
    )
    if fecha_inicio != esperado_inicio or fecha_fin != esperado_fin:
        if administrativo:
            raise DomainValidationError(
                detail=(
                    "Defunción para colaboradores administrativos requiere exactamente "
                    "3 días hábiles. Si el rango cruza fin de semana, se usan los días "
                    "hábiles más cercanos."
                )
            )
        raise DomainValidationError(
            detail=(
                "Defunción solo permite solicitar exactamente 3 días consecutivos "
                "(fecha fin = dos días después de la fecha de inicio)."
            )
        )


def _validar_paternidad_fechas(fecha_inicio: date, fecha_fin: date) -> None:
    esperado_inicio, esperado_fin = paternidad_rango(fecha_inicio)
    if fecha_inicio != esperado_inicio or fecha_fin != esperado_fin:
        raise DomainValidationError(
            detail=(
                "Paternidad solo permite solicitar exactamente 7 días hábiles. "
                "Si la fecha de inicio cae en fin de semana, se usan los días hábiles "
                "más cercanos."
            )
        )


async def _enviar_notificacion_background(
    *,
    destinatario_id: int,
    asunto: str,
    cuerpo: str,
    canal: str = "in_app",
    email_destino: str | None = None,
    target_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """
    Envia notificaciones en background con sesion propia y commit explicito.
    Evita depender de la sesion del request (que puede cerrarse antes de terminar la tarea).
    """
    from app.core.database import AsyncSessionLocal
    from app.services.notificacion_service import NotificacionService

    try:
        async with AsyncSessionLocal() as db:
            try:
                svc = NotificacionService(db)
                await svc.enviar(
                    destinatario_id=destinatario_id,
                    asunto=asunto,
                    cuerpo=cuerpo,
                    canal=canal,
                    email_destino=email_destino,
                    target_url=target_url,
                    metadata=metadata,
                )
                await db.commit()
            except Exception:
                await db.rollback()
                raise
    except Exception:
        logger.exception(
            "Fallo enviando notificacion background | destinatario_id=%s | asunto=%s",
            destinatario_id,
            asunto,
        )


def _solicitud_to_response(s: Solicitud, empleado_ctx: Empleado | None = None) -> SolicitudResponse:
    """
    Construye SolicitudResponse con datos de colaborador y lider para la UI.
    `empleado_ctx` se usa en creacion cuando la instancia Solicitud aun no trae relaciones cargadas.
    """
    emp = empleado_ctx if empleado_ctx is not None else s.empleado
    nombre = (emp.nombre if emp else "") or ""
    area_desc: str | None = None
    no_empleado: str | None = None
    puesto_desc: str | None = None
    foto: str | None = None
    lid_id: int | None = None
    lid_nom: str | None = None
    if emp:
        no_empleado = emp.no_empleado  # int (alineado con Bono)
        foto = emp.foto
        lid_id = emp.lider_id
        if emp.area is not None:
            area_desc = emp.area.descripcion
        if emp.puesto is not None and emp.puesto.descripcion:
            puesto_desc = emp.puesto.descripcion
        if emp.lider is not None:
            lid_nom = emp.lider.nombre

    return SolicitudResponse(
        id=s.id,
        empleado_id=s.empleado_id,
        tipo=s.tipo,
        fecha_inicio=s.fecha_inicio,
        fecha_fin=s.fecha_fin,
        estado=s.estado,
        nivel_actual=s.nivel_actual,
        motivo=s.motivo,
        comentarios=s.comentarios,
        created_at=s.created_at,
        empleado_nombre=nombre,
        empleado_no_empleado=no_empleado,
        empleado_area=area_desc,
        empleado_puesto=puesto_desc,
        empleado_foto=foto,
        lider_id=lid_id,
        lider_nombre=lid_nom,
    )


def _supervisor_ya_aprobo(solicitud: Solicitud, supervisor_id: int | None) -> bool:
    if not supervisor_id:
        return True
    aprobaciones = solicitud.aprobaciones or []
    return any(
        a.accion == "approve" and a.aprobador_id == supervisor_id for a in aprobaciones
    )


_ROLES_APROBADOR_JERARQUICO = frozenset({"supervisor", "gerente"})


def _puede_actuar_jerarquia_solicitud(
    *,
    rol: str,
    lider_empleado_id: int | None,
    primer_gerente_id: int | None,
    current_user_id: int,
    current_user_empleado_id: int,
    empleado_en_subarbol: bool = False,
) -> bool:
    """
    Supervisor o gerente pueden decidir cuando el solicitante está en su subárbol
    (directo o a varios niveles); el gerente además cuando es el gerente de línea.
    ``lider_empleado_id`` es el ``empleado_id`` del jefe inmediato del solicitante.
    """
    if rol == "supervisor" and (
        (lider_empleado_id is not None and lider_empleado_id == current_user_empleado_id)
        or empleado_en_subarbol
    ):
        return True
    if rol == "gerente" and (
        (primer_gerente_id is not None and primer_gerente_id == current_user_id)
        or empleado_en_subarbol
    ):
        return True
    return False


def _asegurar_no_autopaprobacion_jerarquica(
    solicitud: Solicitud,
    current_user: Empleado,
    rol: str,
) -> None:
    """
    Solo invocar desde acciones de decisión jerárquica (aprobar / rechazar).

    Supervisores y gerentes no pueden aprobar ni rechazar solicitudes donde ellos
    son el solicitante, aunque la jerarquía encaje (p. ej. gerente cuya línea
    devuelve como primer gerente a sí mismo en etapa 2).
    """
    if rol not in _ROLES_APROBADOR_JERARQUICO:
        return
    if solicitud.empleado_id == current_user.id:
        raise ForbiddenError(
            detail="No puedes aprobar ni rechazar tu propia solicitud; debe actuar otro aprobador de la cadena"
        )


# Anticipación mínima (en días) para vacaciones y home office: la fecha de inicio
# debe ser al menos mañana. Fija en código a propósito; el frontend espeja la
# misma constante en `solicitudes/rh/rhNewRequestDays.ts`.
DIAS_ANTICIPACION_MINIMA = 1
_TIPOS_CON_ANTICIPACION_MINIMA = frozenset({"vacaciones", "home_office"})
MSG_ANTICIPACION_MINIMA = (
    "Las solicitudes de vacaciones y home office deben registrarse con al menos "
    "un día de anticipación: la fecha de inicio no puede ser hoy ni una fecha pasada."
)


# Días festivos (`levelup_dias_festivos`, capturados por RH): bloquean inicio y fin de
# vacaciones y la fecha de home office, y no descuentan días si caen dentro del rango.
# Sin exención para RH: un festivo no lo trabaja nadie. Permisos con/sin goce no los
# consideran a propósito (son días LFT; nómina ya sabe tratarlos).
MSG_FESTIVO_EXTREMO_VACACIONES = (
    "Las vacaciones no pueden iniciar ni terminar en un día festivo."
)
MSG_FESTIVO_HOME_OFFICE = "Home Office no puede solicitarse en un día festivo."


def _validar_anticipacion_minima(tipo: str, fecha_inicio: date, scope_rol: str) -> None:
    """Rechaza vacaciones/HO con `fecha_inicio <= hoy`. Solo RH (scope global) queda exento."""
    if tipo not in _TIPOS_CON_ANTICIPACION_MINIMA or scope_rol == "rh":
        return
    if fecha_inicio < business_today() + timedelta(days=DIAS_ANTICIPACION_MINIMA):
        raise DomainValidationError(detail=MSG_ANTICIPACION_MINIMA)


# Una solicitud = una semana (lun–dom): TRESS registra un movimiento por semana, así que
# el rango no puede cruzar de domingo a lunes. Sin exención por scope (la restricción es
# de nómina, no de política). Los permisos con goce quedan fuera: se registran en
# Incidencias, donde el rango sí se trocea por semana al escribir a TRESS.
_TIPOS_UNA_SEMANA = frozenset({"vacaciones", "home_office", "permiso_sin_goce_sueldo"})


def _validar_solicitud_una_semana(
    tipo: str,
    fecha_inicio: date,
    fecha_fin: date,
    *,
    al_aprobar: bool = False,
) -> None:
    """Rechaza rangos que crucen de semana. Con `al_aprobar` cambia la instrucción del
    mensaje: la solicitud en vuelo debe rechazarse y recapturarse por semana."""
    if tipo not in _TIPOS_UNA_SEMANA or fecha_fin < fecha_inicio:
        return
    tramos = split_calendar_weeks(fecha_inicio, fecha_fin)
    if len(tramos) <= 1:
        return
    sugerencia = " y ".join(
        f"del {_format_fecha_es(inicio)} al {_format_fecha_es(fin)}"
        for inicio, fin in tramos
    )
    if al_aprobar:
        raise DomainValidationError(
            detail=(
                "Esta solicitud abarca más de una semana y TRESS solo acepta un "
                "registro por semana (lunes a domingo), por lo que no puede aprobarse. "
                f"Recházala y captura una solicitud por semana: {sugerencia}."
            )
        )
    raise DomainValidationError(
        detail=(
            "La solicitud abarca más de una semana y TRESS solo acepta un registro "
            "por semana (lunes a domingo). Captura una solicitud por semana: "
            f"{sugerencia}."
        )
    )


class SolicitudService:
    def __init__(self, db: AsyncSession):
        self.repo = SolicitudRepository(db)
        self.aprobacion_repo = SolicitudAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.comedor_acceso_repo = ComedorAccesoRepository(db)
        self.db = db

    async def _empleado_en_subarbol(
        self, lider_empleado_id: int, empleado_local_id: int
    ) -> bool:
        equipo = await self.empleado_repo.get_ids_subarbol(
            lider_empleado_id, settings.ESTADOS_ACTIVOS_IDS, atravesar_inactivos=True
        )
        return empleado_local_id in equipo

    async def _puede_actuar_jerarquia_solicitud_async(
        self,
        *,
        rol: str,
        emp: Empleado,
        current_user: Empleado,
    ) -> bool:
        primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
        en_subarbol = False
        if rol in ("supervisor", "gerente"):
            en_subarbol = await self._empleado_en_subarbol(current_user.empleado_id, emp.id)
        return _puede_actuar_jerarquia_solicitud(
            rol=rol,
            lider_empleado_id=emp.lider_id,
            primer_gerente_id=primer_g.id if primer_g else None,
            current_user_id=current_user.id,
            current_user_empleado_id=current_user.empleado_id,
            empleado_en_subarbol=en_subarbol,
        )

    async def _cancelar_reservas_comedor_si_vacaciones_aprobadas(
        self,
        *,
        solicitud: Solicitud,
        solicitud_id: int,
    ) -> int:
        if solicitud.tipo != "vacaciones":
            return 0
        canceladas = await self.comedor_acceso_repo.expirar_pendientes_en_rango_por_empleado(
            empleado_id=solicitud.empleado_id,
            desde=solicitud.fecha_inicio,
            hasta=solicitud.fecha_fin,
        )
        if canceladas > 0:
            notif_svc = NotificacionService(self.db)
            await notif_svc.enviar(
                destinatario_id=solicitud.empleado_id,
                asunto="Comidas canceladas por vacaciones aprobadas",
                cuerpo=(
                    f"Se cancelaron <b>{canceladas}</b> reserva(s) de comedor entre "
                    f"{solicitud.fecha_inicio} y {solicitud.fecha_fin} debido a la aprobación "
                    "de tus vacaciones."
                ),
                canal="in_app",
                target_url="#/comedor",
                metadata={
                    "entidad": "comedor_acceso",
                    "tipo_evento": "comedor_reservas_canceladas_por_vacaciones",
                    "solicitud_id": solicitud_id,
                    "fecha_inicio": str(solicitud.fecha_inicio),
                    "fecha_fin": str(solicitud.fecha_fin),
                    "comidas_canceladas": canceladas,
                },
            )
        return canceladas

    async def _tramos_goce_solicitud_sin_descansos(
        self,
        *,
        tipo: str,
        empleado_id: int,
        no_empleado: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> list[tuple[date, date]]:
        emp_clf = await self.empleado_repo.get_with_clasificacion(empleado_id)
        administrativo = emp_clf is not None and empleado_es_administrativo(emp_clf)
        if tipo == "matrimonio":
            _validar_matrimonio_fechas(fecha_inicio, fecha_fin)
        elif tipo == "defuncion":
            _validar_defuncion_fechas(
                fecha_inicio,
                fecha_fin,
                administrativo=administrativo,
            )
        elif tipo == "paternidad":
            _validar_paternidad_fechas(fecha_inicio, fecha_fin)

        if tipo in FALTA_RETARDO_TIPOS_GOCE_FJ:
            horizonte = fecha_inicio + timedelta(days=365)
            descansos = set(
                await obtener_descansos_bono(
                    self.db,
                    cb_codigo=no_empleado,
                    fecha_inicio=fecha_inicio,
                    fecha_fin=horizonte,
                )
            )
            if fecha_inicio in descansos:
                raise DomainValidationError(
                    detail="La fecha inicial no puede ser un día de descanso."
                )
            fechas = avanzar_hasta_reunir_dias(
                fecha_inicio,
                _DIAS_GOCE_SUELDO[tipo],
                descansos,
                solo_lunes_viernes=(
                    tipo == "paternidad"
                    or (tipo == "defuncion" and administrativo)
                ),
            )
            if fechas[-1] > horizonte:
                raise DomainValidationError(
                    detail=(
                        "No fue posible reunir los días otorgados dentro "
                        "del rango consultable."
                    )
                )
        else:
            descansos = await obtener_descansos_bono(
                self.db,
                cb_codigo=no_empleado,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )
            fechas = fechas_efectivas_en_rango(
                fecha_inicio,
                fecha_fin,
                descansos,
            )
            if not fechas:
                raise DomainValidationError(
                    detail=(
                        "El rango efectivo queda vacío porque todos los días "
                        "son descansos."
                    )
                )
        return partir_tramos_por_semanas(tramos_consecutivos(fechas))

    async def _build_solicitud_response_con_flujo(self, solicitud: Solicitud) -> SolicitudResponse:
        base = _solicitud_to_response(solicitud)
        emp = solicitud.empleado
        if not emp:
            return base
        primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
        sup_local_id = emp.lider.id if emp.lider else None
        sup_aprobo = _supervisor_ya_aprobo(solicitud, sup_local_id)
        # Una sola aprobacion requerida: no se exponen colas obligatorias supervisor→gerente.
        return base.model_copy(
            update={
                "gerente_linea_id": primer_g.id if primer_g else None,
                "gerente_linea_nombre": primer_g.nombre if primer_g else None,
                "supervisor_aprobo": sup_aprobo,
                "pendiente_aprobacion_supervisor": False,
                "pendiente_aprobacion_gerente": False,
            }
        )

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_solicitudes(
        self,
        current_user: Empleado,
        cursor: int | None,
        limit: int,
        rh_ui_mode: str | None = None,
    ) -> PaginatedResponse[SolicitudResponse]:
        """
        Lista solicitudes filtradas por rol:
        - empleado (incl. RH en modo empleado): solo las propias
        - supervisor: propias + subordinados directos
        - gerente: propias + todo el subarbol jerarquico bajo el gerente
        - director/rh: todas
        """
        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)

        if scope_rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()

        elif scope_rol in ("supervisor", "gerente"):
            # Supervisor y gerente ven todo su subárbol. `profundidad_equipo` es el
            # alcance de visualización elegido por el gerente (None = todo el
            # subárbol; el supervisor no lo edita y viaja en None). Solo acota el
            # listado: el detalle y la aprobación siguen usando el subárbol
            # completo. Un líder intermedio dado de baja no esconde a su gente
            # (mismo criterio que Horas Extra).
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.empleado_id,
                settings.ESTADOS_ACTIVOS_IDS,
                atravesar_inactivos=True,
                max_niveles=current_user.profundidad_equipo,
            )
            ids = list(equipo) + [current_user.id]
            items, next_cursor = await self.repo.list_by_equipo(
                empleado_ids=ids, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id.in_(ids)]
            )

        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id,
                cursor=cursor,
                limit=limit,
                tipos_permitidos=list(_TIPOS_VISIBLE_EMPLEADO),
                estados_excluidos=list(_ESTADOS_NO_VISIBLES_EMPLEADO),
            )
            total = await self.repo.count(
                filters=[
                    Solicitud.empleado_id == current_user.id,
                    Solicitud.tipo.in_(_TIPOS_VISIBLE_EMPLEADO),
                    ~Solicitud.estado.in_(_ESTADOS_NO_VISIBLES_EMPLEADO),
                ]
            )

        return PaginatedResponse(
            items=[_solicitud_to_response(item) for item in items],
            next_cursor=next_cursor,
            total=total,
        )

    # ── Alcance del equipo (gerente) ─────────────────────────────────────────

    async def get_alcance_equipo(
        self, current_user: Empleado, rh_ui_mode: str | None = None
    ) -> AlcanceEquipoResponse:
        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        return AlcanceEquipoResponse(
            aplica=scope_rol == "gerente",
            profundidad_equipo=current_user.profundidad_equipo,
        )

    async def set_alcance_equipo(
        self,
        current_user: Empleado,
        body: AlcanceEquipoUpdate,
        rh_ui_mode: str | None = None,
    ) -> AlcanceEquipoResponse:
        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        if scope_rol != "gerente":
            raise ForbiddenError(
                detail="El alcance del equipo solo lo configura un gerente"
            )
        config = ensure_rh_config(self.db, current_user)
        config.profundidad_equipo = body.profundidad_equipo
        await self.db.commit()
        return AlcanceEquipoResponse(aplica=True, profundidad_equipo=body.profundidad_equipo)

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_solicitud(
        self,
        solicitud_id: int,
        current_user: Empleado,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)

        if scope_rol in ("director", "rh"):
            pass
        elif solicitud.empleado_id == current_user.id:
            pass
        elif scope_rol in ("supervisor", "gerente"):
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS, atravesar_inactivos=True
            )
            if solicitud.empleado_id not in equipo:
                raise ForbiddenError(detail="No tienes acceso a esta solicitud")
        else:
            raise ForbiddenError(detail="No tienes acceso a esta solicitud")

        return await self._build_solicitud_response_con_flujo(solicitud)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def _festivos_en_rango(self, fecha_inicio: date, fecha_fin: date) -> set[date]:
        """Festivos activos (`levelup_dias_festivos`) dentro del rango, para toda la planta."""
        return await DiasFestivosRepository(self.db).fechas_activas_en_rango(
            fecha_inicio, fecha_fin
        )

    async def _contar_dias_vacaciones_rango(
        self,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
        *,
        validar_inicio_no_descanso: bool = False,
    ) -> int:
        """Cuenta días de vacaciones excluyendo descansos del turno y festivos de la
        planta (y fines de semana si admin). Con ``validar_inicio_no_descanso`` además
        rechaza inicio en descanso y inicio/fin en festivo."""
        empleado = await self.empleado_repo.get_with_clasificacion(empleado_id)
        if empleado is None:
            raise DomainValidationError(detail="Empleado no encontrado.")
        descansos = await obtener_descansos_bono(
            self.db,
            cb_codigo=int(empleado.no_empleado),
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        descansos_set = set(descansos)
        festivos = await self._festivos_en_rango(fecha_inicio, fecha_fin)
        if validar_inicio_no_descanso:
            if fecha_inicio in descansos_set:
                raise DomainValidationError(
                    detail="La fecha inicial no puede ser un día de descanso."
                )
            if fecha_inicio in festivos or fecha_fin in festivos:
                raise DomainValidationError(detail=MSG_FESTIVO_EXTREMO_VACACIONES)
        efectivo = fechas_efectivas_en_rango(
            fecha_inicio, fecha_fin, descansos_set | festivos
        )
        if empleado_es_administrativo(empleado):
            if rango_incluye_fin_de_semana(fecha_inicio, fecha_fin):
                raise DomainValidationError(
                    detail=(
                        "Los colaboradores administrativos solo pueden solicitar vacaciones "
                        "en días entre semana (lunes a viernes)."
                    )
                )
            return sum(1 for d in efectivo if d.weekday() < 5)
        return len(efectivo)

    async def _dias_vacaciones_para_empleado(
        self,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> int:
        """Días a debitar en alta/aprobación: valida inicio y excluye descansos TRESS."""
        return await self._contar_dias_vacaciones_rango(
            empleado_id,
            fecha_inicio,
            fecha_fin,
            validar_inicio_no_descanso=True,
        )

    async def _dias_vacaciones_comprometidos(
        self,
        empleado_id: int,
        *,
        exclude_solicitud_id: int | None = None,
    ) -> int:
        """Suma de días de las solicitudes de vacaciones EN CURSO del empleado.

        Comprometido = solicitudes en ``_ESTADOS_VACACIONES_COMPROMETIDAS`` (pending /
        changes_requested), que reservan días pero aún no se enviaron a TRESS. Las aprobadas
        NO se cuentan: al aprobar ya se insertaron en TRESS y su saldo allí ya bajó.
        """
        solicitudes, _ = await self.repo.list_by_empleado(
            empleado_id,
            cursor=None,
            limit=1000,
            tipos_permitidos=["vacaciones"],
            # Excluir todo lo que NO está comprometido (deja pending + changes_requested).
            estados_excluidos=["approved", "rejected", "cancelled", "overridden"],
        )
        total = 0
        for s in solicitudes:
            if exclude_solicitud_id is not None and s.id == exclude_solicitud_id:
                continue
            total += await self._contar_dias_vacaciones_rango(
                empleado_id,
                s.fecha_inicio,
                s.fecha_fin,
                validar_inicio_no_descanso=False,
            )
        return total

    async def obtener_disponible_vacaciones(
        self,
        *,
        empleado_id: int,
        current_user: Empleado,
        exclude_solicitud_id: int | None = None,
    ) -> VacacionesDisponibleSolicitudResponse:
        """Días disponibles para solicitar = saldo sincronizado − comprometidos en curso.

        ``exclude_solicitud_id`` omite esa solicitud al sumar comprometidos (útil en
        detalle de una pendiente: saldo *antes* de esa solicitud).

        El saldo sale de `levelup_vacaciones_disponibles` (vía ``obtener_saldo_real``), no
        de datos-analisis. Bloquea (503) si ese empleado aún no se ha sincronizado.
        """
        saldo_resp = await VacacionesService(self.db).obtener_saldo_real(
            empleado_id, current_user
        )
        saldo_tress = saldo_resp.saldo_gozo_total or 0.0
        comprometidos = await self._dias_vacaciones_comprometidos(
            empleado_id, exclude_solicitud_id=exclude_solicitud_id
        )
        return VacacionesDisponibleSolicitudResponse(
            empleado_id=empleado_id,
            no_empleado=saldo_resp.no_empleado,
            saldo_tress=saldo_tress,
            dias_comprometidos=comprometidos,
            dias_disponibles=saldo_tress - comprometidos,
        )

    async def _validar_creacion_vacaciones(
        self,
        *,
        empleado_id: int,
        current_user: Empleado,
        fecha_inicio: date,
        fecha_fin: date,
        exclude_solicitud_id: int | None = None,
    ) -> None:
        """Impide alta de vacaciones sin saldo disponible o con días > disponible.

        Fuente del saldo: la caché `levelup_vacaciones_disponibles` menos días comprometidos
        en solicitudes en curso — la misma que ve el usuario en el formulario, para que lo
        mostrado y lo validado no puedan contradecirse. TRESS sigue siendo la autoridad
        final: al aprobar, el INSERT rechaza con `SALDO_INSUFICIENTE` si la caché iba
        desfasada. Si el empleado no está sincronizado, ``obtener_saldo_real`` bloquea (503).
        """
        saldo_resp = await VacacionesService(self.db).obtener_saldo_real(
            empleado_id, current_user
        )
        saldo_tress = saldo_resp.saldo_gozo_total or 0.0
        comprometidos = await self._dias_vacaciones_comprometidos(
            empleado_id, exclude_solicitud_id=exclude_solicitud_id
        )
        disponible = saldo_tress - comprometidos
        necesarios = await self._dias_vacaciones_para_empleado(
            empleado_id, fecha_inicio, fecha_fin
        )
        if necesarios <= 0:
            raise DomainValidationError(
                detail=(
                    "El rango debe incluir al menos un día de vacaciones "
                    "(excluyendo descansos del turno y días festivos)."
                )
            )
        if disponible <= 0:
            raise DomainValidationError(
                detail=(
                    "No cuentas con días de vacaciones disponibles "
                    "para presentar una solicitud."
                )
            )
        if necesarios > disponible:
            raise DomainValidationError(
                detail=(
                    f"Saldo insuficiente: hay {disponible:g} día(s) disponible(s) "
                    f"y se solicitan {necesarios}."
                )
            )

    MSG_HOME_OFFICE_NO_ELEGIBLE = (
        "Home Office no está disponible para este colaborador: requiere clasificación "
        "Administrativo y que su área tenga regla de home office configurada."
    )
    MSG_HOME_OFFICE_CUPO = (
        "Ya existe una solicitud de Home Office activa en el periodo permitido para el área."
    )

    async def _home_office_cupo(
        self,
        *,
        empleado_id: int,
        fecha_referencia: date,
        exclude_solicitud_id: int | None = None,
    ) -> tuple[bool, int, bool]:
        """(elegible, dias_usados, puede_solicitar) para la fecha dada.

        Elegible = clasificación Administrativo **y** área con regla activa en
        `levelup_homeoffice_reglas_area`. El cupo se cuenta en el bloque fijo de semanas
        ISO de la regla (`bloque_semanas`). No elegible ⇒ (False, 0, False).
        """
        empleado = await self.empleado_repo.get_with_clasificacion(empleado_id)
        if empleado is None or not empleado_es_administrativo(empleado):
            return False, 0, False
        if empleado.area_id is None:
            return False, 0, False
        regla = await HomeOfficeReglasAreaRepository(self.db).get_regla_vigente(
            empleado.area_id
        )
        if regla is None:
            return False, 0, False
        desde, hasta = bloque_semanas(fecha_referencia, regla.periodo_semanas)
        usados = await self.repo.count_home_office_activos_en_rango(
            empleado_id=empleado_id,
            desde=desde,
            hasta=hasta,
            estados_activos=list(_ESTADOS_EMPALME_ACTIVO),
            exclude_solicitud_id=exclude_solicitud_id,
        )
        return True, usados, usados < regla.dias_permitidos

    async def _validar_creacion_home_office(
        self,
        *,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
        exclude_solicitud_id: int | None = None,
    ) -> None:
        if fecha_fin != fecha_inicio:
            raise DomainValidationError(
                detail=(
                    "Home Office solo permite solicitar un día "
                    "(fecha inicio y fin iguales)."
                )
            )
        elegible, _usados, puede = await self._home_office_cupo(
            empleado_id=empleado_id,
            fecha_referencia=fecha_inicio,
            exclude_solicitud_id=exclude_solicitud_id,
        )
        if not elegible:
            raise DomainValidationError(detail=self.MSG_HOME_OFFICE_NO_ELEGIBLE)
        if rango_incluye_fin_de_semana(fecha_inicio, fecha_fin):
            raise DomainValidationError(
                detail=(
                    "Home Office solo puede solicitarse en días entre semana "
                    "(lunes a viernes)."
                )
            )
        if fecha_inicio in await self._festivos_en_rango(fecha_inicio, fecha_inicio):
            raise DomainValidationError(detail=MSG_FESTIVO_HOME_OFFICE)
        if not puede:
            raise DomainValidationError(detail=self.MSG_HOME_OFFICE_CUPO)

    async def _validar_permiso_sin_goce_sueldo_fechas(
        self,
        *,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> None:
        empleado = await self.empleado_repo.get_with_clasificacion(empleado_id)
        if empleado is None or not empleado_es_administrativo(empleado):
            return
        if rango_incluye_fin_de_semana(fecha_inicio, fecha_fin):
            raise DomainValidationError(
                detail=(
                    "Los colaboradores administrativos solo pueden solicitar permiso "
                    "sin goce de sueldo en días entre semana (lunes a viernes)."
                )
            )

    async def home_office_disponibilidad(
        self,
        empleado_id: int,
        fecha_referencia: date,
        current_user: Empleado,
        exclude_solicitud_id: int | None = None,
    ) -> "HomeOfficeDisponibilidadResponse":
        """Elegibilidad y cupo de HO para la fecha. No expone la regla del área
        (días/periodo): el empleado solo ve si puede o no."""
        from app.schemas.solicitudes import HomeOfficeDisponibilidadResponse
        from app.services.vacaciones_service import VacacionesService

        await VacacionesService(self.db)._ensure_puede_ver_empleado(
            current_user, empleado_id
        )
        elegible, usados, puede = await self._home_office_cupo(
            empleado_id=empleado_id,
            fecha_referencia=fecha_referencia,
            exclude_solicitud_id=exclude_solicitud_id,
        )
        return HomeOfficeDisponibilidadResponse(
            empleado_id=empleado_id,
            elegible=elegible,
            dias_usados=usados,
            puede_solicitar=puede,
        )

    async def _resolver_empleado_objetivo_crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        rh_ui_mode: str | None = None,
    ) -> Empleado:
        """
        Determina el colaborador titular de la solicitud (self-service vs alta delegada).
        Misma regla de alcance que `IncidenciaService.crear_incidencia` para equipo/rh/director.
        """
        if is_rh_empleado_ui_mode(current_user, rh_ui_mode):
            requested = data.empleado_id
            if requested is not None and requested != current_user.id:
                raise ForbiddenError(detail="No puedes crear solicitudes para otro empleado")
            return current_user

        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        requested = data.empleado_id

        if requested is None or requested == current_user.id:
            return current_user

        target = await self.empleado_repo.get_with_area_y_lider(requested)
        if not target:
            raise NotFoundError(entidad="Empleado", id=requested)

        if scope_rol == "empleado":
            raise ForbiddenError(detail="No puedes crear solicitudes para otro empleado")

        if scope_rol in ("rh", "director"):
            return target

        if scope_rol in ("gerente", "supervisor"):
            # Misma fuente que el buscador de empleados del modal: supervisor y
            # gerente = todo su subárbol activo. Si esto y el
            # buscador divergieran, el modal ofrecería colaboradores para los que
            # el POST responde 403.
            permitidos = await empleado_ids_scope_por_modulo(
                self.empleado_repo, current_user, "solicitudes", rh_ui_mode
            )
            if permitidos is not None and requested not in set(permitidos):
                raise ForbiddenError(
                    detail="No puedes crear solicitudes para empleados fuera de tu equipo"
                )
            return target

        raise ForbiddenError(detail="No tienes permiso para crear solicitudes para otro empleado")

    async def crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        """
        Alta de solicitud para el colaborador titular (por defecto el usuario autenticado).

        Roles autorizados pueden enviar `empleado_id` para registrar en nombre de otro colaborador
        dentro de su alcance (equipo/rh/director), alineado con incidencias.

        No se aplican aquí reglas de aprobación jerárquica ni auto-aprobación; esas viven
        únicamente en `aprobar_solicitud` y `rechazar_solicitud`.

        Orden de validación en creación:
        1) Duplicidad exacta (mismo empleado, mismas fechas inicio/fin, estados activos).
        2) Saldo de vacaciones (solo tipo vacaciones, tabla local `vacaciones`).
        3) Persistencia y notificaciones.
        """
        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        target = await self._resolver_empleado_objetivo_crear_solicitud(
            data, current_user, rh_ui_mode=rh_ui_mode,
        )

        fecha_inicio = data.fecha_inicio
        fecha_fin = data.fecha_fin
        _validar_anticipacion_minima(data.tipo, fecha_inicio, scope_rol)
        _validar_solicitud_una_semana(data.tipo, fecha_inicio, fecha_fin)
        if data.tipo == "home_office":
            await self._validar_creacion_home_office(
                empleado_id=target.id,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )
        if data.tipo == "permiso_sin_goce_sueldo":
            await self._validar_permiso_sin_goce_sueldo_fechas(
                empleado_id=target.id,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )
        if data.tipo == "permiso_sin_goce_sueldo" and scope_rol not in (
            "supervisor",
            "gerente",
            "rh",
            "director",
        ):
            raise ForbiddenError(
                detail="Solo supervisor, gerente, RH o director pueden crear permisos sin goce de sueldo"
            )
        if data.tipo in _TIPOS_GOCE_SUELDO_RH:
            raise DomainValidationError(
                detail=(
                    "Los permisos con goce de sueldo (matrimonio, incapacidad interna, "
                    "defunción, paternidad) se registran en Incidencias, no como solicitud."
                )
            )

        duplicado = await self.repo.count(
            filters=[
                Solicitud.empleado_id == target.id,
                Solicitud.fecha_inicio == fecha_inicio,
                Solicitud.fecha_fin == fecha_fin,
                Solicitud.estado.in_(_ESTADOS_DUPLICADO_EXACTO),
            ]
        )
        if duplicado > 0:
            raise ConflictError(detail=_MSG_SOLICITUD_YA_EXISTE)

        empalme = await self.repo.find_first_overlapping_active(
            empleado_id=target.id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estados_activos=list(_ESTADOS_EMPALME_ACTIVO),
        )
        if empalme is not None:
            raise ConflictError(detail=_msg_empalme_solicitudes(empalme))

        if data.tipo == "vacaciones":
            await self._validar_creacion_vacaciones(
                empleado_id=target.id,
                current_user=current_user,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )

        solicitud = await self.repo.create({
            "empleado_id": target.id,
            "tipo": data.tipo,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "estado": "pending",
            "nivel_actual": 1,
            "motivo": data.motivo,
            "comentarios": data.comentarios,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CREATED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud.id,
            datos_despues={
                "tipo": solicitud.tipo,
                "estado": solicitud.estado,
                "empleado_id": solicitud.empleado_id,
            },
        )

        # Notificar al colaborador titular que el registro quedó en revisión.
        background_tasks.add_task(
            _enviar_notificacion_background,
            destinatario_id=target.id,
            asunto="Tu solicitud fue enviada",
            cuerpo=(
                f"Tu solicitud de <b>{data.tipo}</b> del {fecha_inicio} al "
                f"{fecha_fin} fue enviada y esta en revision."
            ),
            canal="in_app",
            target_url="#/solicitudes",
            metadata={
                "entidad": "solicitud",
                "tipo": data.tipo,
                "estado": "pending",
            },
        )

        if target.lider_id and target.lider:
            supervisor_id = target.lider.id
            nombre_empleado = target.nombre or ""
            tipo = data.tipo

            background_tasks.add_task(
                _enviar_notificacion_background,
                destinatario_id=supervisor_id,
                asunto=f"Nueva solicitud de {nombre_empleado}",
                cuerpo=(
                    f"Se ha generado una solicitud de <b>{tipo}</b> "
                    f"del {fecha_inicio} al {fecha_fin}. "
                    "Por favor rev&iacute;sala en la plataforma."
                ),
                canal="in_app",
                target_url="#/solicitudes",
                metadata={
                    "entidad": "solicitud",
                    "tipo": tipo,
                },
            )

        return _solicitud_to_response(solicitud, empleado_ctx=target)

    # ── Aprobar ──────────────────────────────────────────────────────────────

    async def _aprobar_final_con_tress(
        self,
        *,
        solicitud_id: int,
        solicitud: Solicitud,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        # Red de seguridad para solicitudes capturadas antes de la regla de una semana:
        # nunca escribir en TRESS un registro que cruce de semana.
        _validar_solicitud_una_semana(
            solicitud.tipo,
            solicitud.fecha_inicio,
            solicitud.fecha_fin,
            al_aprobar=True,
        )
        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}
        no_empleado_solicitante = solicitud.empleado.no_empleado

        # Vacaciones / home office: INSERT en TRESS antes de marcar approved (si falla, sigue pending).
        tress_vacacion_llave: int | None = None
        tress_home_office_llave: int | None = None
        tramos_goce: list[tuple[date, date]] | None = None
        if solicitud.tipo in _TIPOS_GOCE_SUELDO_RH:
            tramos_goce = await self._tramos_goce_solicitud_sin_descansos(
                tipo=solicitud.tipo,
                empleado_id=solicitud.empleado_id,
                no_empleado=int(no_empleado_solicitante),
                fecha_inicio=solicitud.fecha_inicio,
                fecha_fin=solicitud.fecha_fin,
            )
        if solicitud.tipo == "vacaciones":
            dias = await self._dias_vacaciones_para_empleado(
                solicitud.empleado_id,
                solicitud.fecha_inicio,
                solicitud.fecha_fin,
            )
            tress_payload = {
                "no_empleado": int(no_empleado_solicitante),
                "fecha_inicio": str(solicitud.fecha_inicio),
                "fecha_fin": str(solicitud.fecha_fin),
                "dias_gozo": dias,
                "dias_pago": dias,
            }
            try:
                tress_result = await registrar_vacaciones_en_tress(
                    no_empleado=int(no_empleado_solicitante),
                    fecha_inicio=solicitud.fecha_inicio,
                    fecha_fin=solicitud.fecha_fin,
                    dias_gozo=dias,
                    dias_pago=dias,
                )
            except LeoniException as exc:
                # Commit en sesion propia YA (no BackgroundTask): en 4xx/5xx Starlette
                # no ejecuta tasks y el rollback del request borraria un log sincrono.
                await audit_logger_mod._log_action_background(
                    accion="TRESS_VACACIONES_INSERT_FAILED",
                    modulo="solicitudes",
                    usuario_id=current_user.id,
                    entidad_id=solicitud_id,
                    datos_antes={
                        "estado": solicitud.estado,
                        **tress_payload,
                    },
                    datos_despues={
                        "ok": False,
                        "error": exc.detail,
                        "codigo": exc.code,
                    },
                )
                raise

            tress_vacacion_llave = getattr(tress_result, "nueva_llave", None)
            audit_background(
                background_tasks=background_tasks,
                db=self.db,
                accion="TRESS_VACACIONES_INSERT_OK",
                modulo="solicitudes",
                usuario_id=current_user.id,
                entidad_id=solicitud_id,
                datos_antes=tress_payload,
                datos_despues={
                    "ok": True,
                    "nueva_llave": tress_vacacion_llave,
                    "mensaje": getattr(tress_result, "mensaje", None),
                },
            )
        elif solicitud.tipo in FALTA_RETARDO_TIPOS_GOCE_FJ:
            assert tramos_goce is not None
            await registrar_permisos_goce_tramos_en_tress(
                no_empleado=int(no_empleado_solicitante),
                tramos=tramos_goce,
                comentario=GOCE_PM_COMENTA[solicitud.tipo],
            )
        elif solicitud.tipo == "home_office":
            tress_ho_payload = {
                "no_empleado": int(no_empleado_solicitante),
                "fecha_inicio": str(solicitud.fecha_inicio),
                "fecha_fin": str(solicitud.fecha_fin),
            }
            try:
                tress_ho_result = await registrar_home_office_en_tress(
                    no_empleado=int(no_empleado_solicitante),
                    fecha_inicio=solicitud.fecha_inicio,
                    fecha_fin=solicitud.fecha_fin,
                )
            except LeoniException as exc:
                await audit_logger_mod._log_action_background(
                    accion="TRESS_HOME_OFFICE_INSERT_FAILED",
                    modulo="solicitudes",
                    usuario_id=current_user.id,
                    entidad_id=solicitud_id,
                    datos_antes={
                        "estado": solicitud.estado,
                        **tress_ho_payload,
                    },
                    datos_despues={
                        "ok": False,
                        "error": exc.detail,
                        "codigo": exc.code,
                    },
                )
                raise

            tress_home_office_llave = getattr(tress_ho_result, "nueva_llave", None)
            audit_background(
                background_tasks=background_tasks,
                db=self.db,
                accion="TRESS_HOME_OFFICE_INSERT_OK",
                modulo="solicitudes",
                usuario_id=current_user.id,
                entidad_id=solicitud_id,
                datos_antes=tress_ho_payload,
                datos_despues={
                    "ok": True,
                    "nueva_llave": tress_home_office_llave,
                    "mensaje": getattr(tress_ho_result, "mensaje", None),
                },
            )

        if not await self.repo.marcar_estado_aprobada_si_pending(solicitud_id):
            raise ConflictError(
                detail="La solicitud ya no esta pendiente; no se puede completar la aprobacion."
            )
        # synchronize_session=False en el UPDATE: refrescar la fila en la sesion para lecturas posteriores.
        sol_sync = await self.repo.get(solicitud_id)
        if sol_sync is not None:
            await self.db.refresh(sol_sync)

        aprob_row = await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "approve",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        if solicitud.tipo not in (
            "vacaciones",
            "home_office",
            *_TIPOS_GOCE_SUELDO_RH,
        ):
            accion_tress = _TRESS_ACCION_MAP.get(solicitud.tipo, "REGISTRAR_VACACIONES")
            await encolar_tress(
                db=self.db,
                accion=accion_tress,
                payload={
                    "empleado_num": no_empleado_solicitante,
                    "fecha_inicio": str(solicitud.fecha_inicio),
                    "fecha_fin": str(solicitud.fecha_fin),
                    "referencia_id": solicitud.id,
                },
            )

        await self._cancelar_reservas_comedor_si_vacaciones_aprobadas(
            solicitud=solicitud,
            solicitud_id=solicitud_id,
        )

        requisitor_id = solicitud.empleado_id
        tipo_txt = solicitud.tipo.replace("_", " ")
        notif_svc = NotificacionService(self.db)
        await notif_svc.enviar(
            destinatario_id=requisitor_id,
            asunto="Tu solicitud fue aprobada",
            cuerpo=(
                f"Tu solicitud de <b>{tipo_txt}</b> del {solicitud.fecha_inicio} al {solicitud.fecha_fin} "
                "quedo registrada como <b>aprobada</b>. Puedes consultarla en la plataforma."
            ),
            canal="in_app",
            target_url="#/solicitudes",
            metadata={
                "entidad": "solicitud",
                "solicitud_id": solicitud_id,
                "estado": ESTADO_SOLICITUD_APROBADA,
                "aprobador_id": current_user.id,
                "solicitud_aprobacion_id": aprob_row.id,
                "tipo_evento": "solicitud_aprobada_final",
            },
        )

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_APPROVED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={
                "estado": ESTADO_SOLICITUD_APROBADA,
                "aprobador_id": current_user.id,
                "solicitud_aprobacion_id": aprob_row.id,
                **(
                    {"tress_vacacion_llave": tress_vacacion_llave}
                    if solicitud.tipo == "vacaciones"
                    else {}
                ),
            },
        )

        # Vacaciones y home office aprobados: TRESS ya cambió, así que hay que refrescar la
        # caché de Bono de la que leen dashboards y formularios. Va en BackgroundTask
        # porque Starlette las ejecuta DESPUÉS de la respuesta, es decir después del commit
        # de `get_db`: nunca se sincroniza sobre una aprobación no confirmada, y un fallo
        # aquí no revierte nada (se corrige en la corrida diaria).
        if solicitud.tipo == "vacaciones":
            background_tasks.add_task(
                sincronizar_vacaciones_empleado_background,
                int(no_empleado_solicitante),
            )
        elif solicitud.tipo == "home_office":
            background_tasks.add_task(
                sincronizar_homeoffice_empleado_background,
                int(no_empleado_solicitante),
                solicitud_id,
            )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return await self._build_solicitud_response_con_flujo(solicitud_final)

    async def aprobar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede aprobar una solicitud en estado '{solicitud.estado}'"
            )

        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, scope_rol)
        emp = solicitud.empleado

        if scope_rol in ("director", "rh"):
            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        if await self._puede_actuar_jerarquia_solicitud_async(
            rol=scope_rol,
            emp=emp,
            current_user=current_user,
        ):
            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        raise ForbiddenError(
            detail="No tienes permiso para aprobar esta solicitud. Solo un supervisor o gerente "
            "de tu línea, RH o director pueden aprobarla."
        )

    # ── Rechazar ─────────────────────────────────────────────────────────────

    async def rechazar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede rechazar una solicitud en estado '{solicitud.estado}'"
            )

        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, scope_rol)
        emp = solicitud.empleado

        if scope_rol not in ("director", "rh"):
            if not await self._puede_actuar_jerarquia_solicitud_async(
                rol=scope_rol,
                emp=emp,
                current_user=current_user,
            ):
                raise ForbiddenError(
                    detail="No tienes permiso para rechazar esta solicitud. Solo un supervisor o gerente "
                    "de tu línea, RH o director pueden rechazarla."
                )

        datos_antes = {"estado": solicitud.estado}
        # Saldo de vacaciones dormante: la fuente es TRESS; no hay reintegro interno.
        await self.repo.update(solicitud_id, {"estado": "rejected"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "reject",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_REJECTED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "rejected", "comentario": aprobacion.comentario},
        )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return await self._build_solicitud_response_con_flujo(solicitud_final)

    # ── Override ─────────────────────────────────────────────────────────────

    async def override_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        from app.core.rh_ui_mode import is_admin_user, rh_tiene_alcance_gestor

        if not rh_tiene_alcance_gestor(current_user, rh_ui_mode):
            from app.core.rh_access import is_legacy_rh_role

            if is_admin_user(current_user) or is_legacy_rh_role(current_user):
                raise ForbiddenError(detail="No tienes permiso para override en modo empleado")

        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado not in ("pending", "rejected", "changes_requested"):
            raise ConflictError(
                detail=f"No se puede hacer override de una solicitud en estado '{solicitud.estado}'"
            )

        datos_antes = {"estado": solicitud.estado}
        solicitud = await self.repo.update(solicitud_id, {"estado": "overridden"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "override",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_OVERRIDDEN",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "overridden"},
        )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return _solicitud_to_response(solicitud_final)

    # ── Solicitar cambios (requisitor debe corregir) ──────────────────────────

    async def solicitar_cambios_solicitud(
        self,
        solicitud_id: int,
        body: SolicitudSolicitarCambiosBody,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=(
                    "Solo se pueden solicitar cambios sobre solicitudes en estado 'pending'; "
                    f"estado actual: '{solicitud.estado}'"
                )
            )

        scope_rol = effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode)
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, scope_rol)
        emp = solicitud.empleado

        if scope_rol not in ("director", "rh"):
            if not await self._puede_actuar_jerarquia_solicitud_async(
                rol=scope_rol,
                emp=emp,
                current_user=current_user,
            ):
                raise ForbiddenError(
                    detail="No tienes permiso para solicitar cambios en esta solicitud. Solo el supervisor "
                    "directo, el gerente de linea, RH o director pueden hacerlo."
                )

        datos_antes = {"estado": solicitud.estado}
        await self.repo.update(solicitud_id, {"estado": "changes_requested"})
        aprob_row = await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "request_changes",
            "nivel": body.nivel,
            "comentario": body.comentario,
        })

        requisitor_id = solicitud.empleado_id
        tipo_txt = solicitud.tipo.replace("_", " ")
        notif_svc = NotificacionService(self.db)
        await notif_svc.enviar(
            destinatario_id=requisitor_id,
            asunto="Tu solicitud requiere cambios",
            cuerpo=(
                f"Se solicitaron correcciones a tu solicitud de <b>{tipo_txt}</b> "
                f"del {solicitud.fecha_inicio} al {solicitud.fecha_fin}. "
                "Revisa el comentario del aprobador, actualiza la solicitud y vuelve a enviarla."
            ),
            canal="in_app",
            target_url="#/solicitudes",
            metadata={
                "entidad": "solicitud",
                "solicitud_id": solicitud_id,
                "estado": "changes_requested",
                "tipo_evento": "solicitud_cambios_solicitados",
                "aprobador_id": current_user.id,
                "solicitud_aprobacion_id": aprob_row.id,
            },
        )

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CHANGES_REQUESTED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={
                "estado": "changes_requested",
                "comentario": body.comentario,
                "solicitud_aprobacion_id": aprob_row.id,
            },
        )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return await self._build_solicitud_response_con_flujo(solicitud_final)

    async def requisitor_actualizar_y_reenviar(
        self,
        solicitud_id: int,
        data: SolicitudRequisitorRevision,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
        rh_ui_mode: str | None = None,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.empleado_id != current_user.id:
            raise ForbiddenError(detail="Solo el solicitante puede actualizar esta solicitud")

        if solicitud.estado != "changes_requested":
            raise ConflictError(
                detail=(
                    "Solo se puede corregir una solicitud en estado 'changes_requested'; "
                    f"estado actual: '{solicitud.estado}'"
                )
            )

        _validar_anticipacion_minima(
            solicitud.tipo,
            data.fecha_inicio,
            effective_data_scope_for_module(current_user, "solicitudes", rh_ui_mode),
        )
        _validar_solicitud_una_semana(solicitud.tipo, data.fecha_inicio, data.fecha_fin)

        duplicado = await self.repo.count(
            filters=[
                Solicitud.empleado_id == current_user.id,
                Solicitud.id != solicitud_id,
                Solicitud.fecha_inicio == data.fecha_inicio,
                Solicitud.fecha_fin == data.fecha_fin,
                Solicitud.estado.in_(_ESTADOS_DUPLICADO_EXACTO),
            ]
        )
        if duplicado > 0:
            raise ConflictError(detail=_MSG_SOLICITUD_YA_EXISTE)

        empalme = await self.repo.find_first_overlapping_active(
            empleado_id=current_user.id,
            fecha_inicio=data.fecha_inicio,
            fecha_fin=data.fecha_fin,
            estados_activos=list(_ESTADOS_EMPALME_ACTIVO),
            exclude_solicitud_id=solicitud_id,
        )
        if empalme is not None:
            raise ConflictError(detail=_msg_empalme_solicitudes(empalme))

        if solicitud.tipo == "home_office":
            await self._validar_creacion_home_office(
                empleado_id=current_user.id,
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
                exclude_solicitud_id=solicitud_id,
            )

        if solicitud.tipo == "matrimonio":
            _validar_matrimonio_fechas(data.fecha_inicio, data.fecha_fin)

        if solicitud.tipo == "defuncion":
            emp_clf = await self.empleado_repo.get_with_clasificacion(current_user.id)
            admin = emp_clf is not None and empleado_es_administrativo(emp_clf)
            _validar_defuncion_fechas(
                data.fecha_inicio,
                data.fecha_fin,
                administrativo=admin,
            )

        if solicitud.tipo == "paternidad":
            _validar_paternidad_fechas(data.fecha_inicio, data.fecha_fin)

        if solicitud.tipo in _TIPOS_GOCE_SUELDO_RH:
            await self._tramos_goce_solicitud_sin_descansos(
                tipo=solicitud.tipo,
                empleado_id=current_user.id,
                no_empleado=int(current_user.no_empleado),
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
            )

        if solicitud.tipo == "permiso_sin_goce_sueldo":
            await self._validar_permiso_sin_goce_sueldo_fechas(
                empleado_id=current_user.id,
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
            )

        if solicitud.tipo == "vacaciones":
            # Revalida las nuevas fechas contra el disponible TRESS, excluyendo esta misma
            # solicitud del cómputo de comprometidos (evita contarse a sí misma).
            await self._validar_creacion_vacaciones(
                empleado_id=current_user.id,
                current_user=current_user,
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
                exclude_solicitud_id=solicitud.id,
            )

        datos_antes = {
            "estado": solicitud.estado,
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
            "motivo": solicitud.motivo,
        }
        await self.repo.update(
            solicitud_id,
            {
                "fecha_inicio": data.fecha_inicio,
                "fecha_fin": data.fecha_fin,
                "motivo": data.motivo,
                "estado": "pending",
                "nivel_actual": 1,
            },
        )

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_REVISION_REENVIADA",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={
                "estado": "pending",
                "fecha_inicio": str(data.fecha_inicio),
                "fecha_fin": str(data.fecha_fin),
                "motivo": data.motivo,
                "nivel_actual": 1,
            },
        )

        if current_user.lider_id and current_user.lider:
            supervisor_id = current_user.lider.id
            nombre_empleado = current_user.nombre
            tipo = solicitud.tipo
            tipo_txt = tipo.replace("_", " ")
            notif_sup = NotificacionService(self.db)
            await notif_sup.enviar(
                destinatario_id=supervisor_id,
                asunto=f"Solicitud corregida por {nombre_empleado}",
                cuerpo=(
                    f"El colaborador actualizó su solicitud de <b>{tipo_txt}</b> "
                    f"del {data.fecha_inicio} al {data.fecha_fin} y quedó pendiente de revisión."
                ),
                canal="in_app",
                target_url="#/solicitudes",
                metadata={
                    "entidad": "solicitud",
                    "tipo": tipo,
                    "solicitud_id": solicitud_id,
                    "estado": "pending",
                    "tipo_evento": "solicitud_corregida_reenviada",
                    "empleado_solicitante_id": current_user.id,
                },
            )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return await self._build_solicitud_response_con_flujo(solicitud_final)

    # ── Cancelar ─────────────────────────────────────────────────────────────

    async def cancelar_solicitud(
        self,
        solicitud_id: int,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        # Solo el propio empleado puede cancelar su solicitud
        if solicitud.empleado_id != current_user.id:
            raise ForbiddenError(detail="Solo puedes cancelar tus propias solicitudes")

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"Solo se pueden cancelar solicitudes en estado 'pending', "
                       f"estado actual: '{solicitud.estado}'"
            )

        datos_antes = {"estado": solicitud.estado}
        # Saldo de vacaciones dormante: la fuente es TRESS; no hay reintegro interno.
        solicitud = await self.repo.update(solicitud_id, {"estado": "cancelled"})

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CANCELLED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "cancelled"},
        )

        solicitud_final = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud_final:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)
        return _solicitud_to_response(solicitud_final)

    # ── Aprobaciones ─────────────────────────────────────────────────────────

    async def get_aprobaciones(
        self,
        solicitud_id: int,
        current_user: Empleado,
        rh_ui_mode: str | None = None,
    ) -> list[SolicitudAprobacionResponse]:
        # Verificar acceso a la solicitud
        await self.get_solicitud(
            solicitud_id=solicitud_id,
            current_user=current_user,
            rh_ui_mode=rh_ui_mode,
        )

        aprobaciones = await self.aprobacion_repo.list_by_solicitud(solicitud_id)
        out: list[SolicitudAprobacionResponse] = []
        for a in aprobaciones:
            base = SolicitudAprobacionResponse.model_validate(a)
            nom = ""
            aprobador = getattr(a, "aprobador", None)
            if aprobador is not None and getattr(aprobador, "nombre", None):
                nom = (aprobador.nombre or "").strip()
            out.append(base.model_copy(update={"aprobador_nombre": nom}))
        return out
