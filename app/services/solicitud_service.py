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

Jerarquia supervisor/gerente: una sola aprobacion o rechazo valido basta (supervisor directo O gerente
de linea, en cualquier orden; no hay segunda etapa obligatoria).

Al aprobar: estado `approved`, registro de aprobacion, cola TRESS y notificacion in-app al requisitor
en la misma transaccion del request (rollback conjunto si falla cualquier paso).
Al rechazar/cancelar: NO se encola en TRESS.
"""

import logging
from datetime import date, timedelta
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.integrations.tress.queue import encolar_tress
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud
from app.repositories.comedor_repository import ComedorAccesoRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.solicitud_repository import (
    SolicitudAprobacionRepository,
    SolicitudRepository,
)
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    ESTADO_SOLICITUD_APROBADA,
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudRequisitorRevision,
    SolicitudResponse,
    SolicitudSolicitarCambiosBody,
)
from app.services.notificacion_service import NotificacionService
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

# Acciones TRESS por tipo de solicitud
_TRESS_ACCION_MAP = {
    "vacaciones": "REGISTRAR_VACACIONES",
    "home_office": "REGISTRAR_HOME_OFFICE",
    "matrimonio": "REGISTRAR_GOCE_SUELDO_MATRIMONIO",
    "incapacidad_interna": "REGISTRAR_GOCE_SUELDO_INCAPACIDAD_INTERNA",
    "defuncion": "REGISTRAR_GOCE_SUELDO_DEFUNCION",
    "paternidad": "REGISTRAR_GOCE_SUELDO_PATERNIDAD",
    "permiso_sin_goce_sueldo": "REGISTRAR_PERMISO_SIN_GOCE_SUELDO",
}
_TIPOS_GOCE_SUELDO_RH = frozenset({
    "matrimonio",
    "incapacidad_interna",
    "defuncion",
    "paternidad",
})
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


def _sumar_dias_habiles(fecha_inicio: date, dias_habiles: int) -> date:
    """Suma días hábiles (lunes-viernes) sobre fecha_inicio inclusive."""
    cursor = fecha_inicio
    acumulados = 1
    while acumulados < dias_habiles:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            acumulados += 1
    return cursor


async def _resolver_fila_saldo_vacaciones_tress(no_empleado: str) -> dict:
    """
    Lee saldo de vacaciones en TRESS.

    - Sin `TRESS_ODBC_CONN`: no hay consulta; se asume cupo amplio (desarrollo local).
    - Con conexión pero sin fila (stub sin pyodbc, empleado sin registro en la vista, etc.):
      se registra advertencia y se omite el rechazo por saldo para no bloquear el alta;
      en producción debe existir la fila para que la validación sea efectiva.
    """
    from app.integrations.tress.tress_sql_client import TressSqlClient

    conn = (settings.TRESS_ODBC_CONN or "").strip()
    if not conn:
        return {"DiasDisponibles": 999_999}
    client = TressSqlClient(conn)
    row = await client.get_saldo_vacaciones(no_empleado.strip())
    if not row:
        logger.warning(
            "Vacaciones: sin fila de saldo TRESS para num_empleado=%s; se omite validación estricta de días.",
            no_empleado,
        )
        return {"DiasDisponibles": 999_999}
    return row


def _dias_disponibles_desde_fila_saldo(row: dict) -> int:
    for key in ("DiasDisponibles", "dias_disponibles", "DiasDisponible"):
        if key in row and row[key] is not None:
            return int(float(row[key]))
    raise ServiceUnavailableError(
        detail="No es posible verificar el saldo de vacaciones en este momento. Intente más tarde."
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
        no_empleado = (emp.no_empleado or "").strip() or None
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
    lider_id: int | None,
    primer_gerente_id: int | None,
    current_user_id: int,
) -> bool:
    """Supervisor directo o gerente de linea (primer gerente en cadena) pueden aprobar/rechazar."""
    if rol == "supervisor" and lider_id is not None and lider_id == current_user_id:
        return True
    if rol == "gerente" and primer_gerente_id is not None and primer_gerente_id == current_user_id:
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


class SolicitudService:
    def __init__(self, db: AsyncSession):
        self.repo = SolicitudRepository(db)
        self.aprobacion_repo = SolicitudAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.comedor_acceso_repo = ComedorAccesoRepository(db)
        self.db = db

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

    async def _build_solicitud_response_con_flujo(self, solicitud: Solicitud) -> SolicitudResponse:
        base = _solicitud_to_response(solicitud)
        emp = solicitud.empleado
        if not emp:
            return base
        primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
        sup_id = emp.lider_id
        sup_aprobo = _supervisor_ya_aprobo(solicitud, sup_id)
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
    ) -> PaginatedResponse[SolicitudResponse]:
        """
        Lista solicitudes filtradas por rol:
        - empleado: solo las propias
        - supervisor: propias + subordinados directos
        - gerente: propias + todo el subarbol jerarquico bajo el gerente
        - director/rh: todas
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()

        elif rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            items, next_cursor = await self.repo.list_by_equipo(
                empleado_ids=ids, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id.in_(ids)]
            )

        elif rol == "gerente":
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
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

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_solicitud(
        self,
        solicitud_id: int,
        current_user: Empleado,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        rol = current_user.rol.nombre if current_user.rol else "empleado"

        if rol in ("director", "rh"):
            pass
        elif solicitud.empleado_id == current_user.id:
            pass
        elif rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = {e.id for e in subordinados}
            if solicitud.empleado_id not in ids:
                raise ForbiddenError(detail="No tienes acceso a esta solicitud")
        elif rol == "gerente":
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            if solicitud.empleado_id not in equipo:
                raise ForbiddenError(detail="No tienes acceso a esta solicitud")
        else:
            raise ForbiddenError(detail="No tienes acceso a esta solicitud")

        return await self._build_solicitud_response_con_flujo(solicitud)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def _validar_saldo_vacaciones_crear(
        self,
        *,
        empleado: Empleado,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> None:
        """Solo `vacaciones`: compara días solicitados (inclusive) vs TRESS."""
        no = (empleado.no_empleado or "").strip()
        if not no:
            raise DomainValidationError(
                detail="No hay número de empleado para consultar el saldo de vacaciones."
            )
        row = await _resolver_fila_saldo_vacaciones_tress(no)
        disponibles = _dias_disponibles_desde_fila_saldo(row)
        necesarios = _dias_solicitud_inclusive(fecha_inicio, fecha_fin)
        if necesarios > disponibles:
            raise DomainValidationError(
                detail=(
                    f"Saldo insuficiente: hay {disponibles} día(s) disponible(s) "
                    f"y se solicitan {necesarios}."
                )
            )

    async def _resolver_empleado_objetivo_crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
    ) -> Empleado:
        """
        Determina el colaborador titular de la solicitud (self-service vs alta delegada).
        Misma regla de alcance que `IncidenciaService.crear_incidencia` para equipo/rh/director.
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        requested = data.empleado_id

        if requested is None or requested == current_user.id:
            return current_user

        target = await self.empleado_repo.get_with_area_y_lider(requested)
        if not target:
            raise NotFoundError(entidad="Empleado", id=requested)

        if rol == "empleado":
            raise ForbiddenError(detail="No puedes crear solicitudes para otro empleado")

        if rol in ("rh", "director"):
            return target

        if rol in ("gerente", "supervisor"):
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            permitidos = {e.id for e in subordinados} | {current_user.id}
            if requested not in permitidos:
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
    ) -> SolicitudResponse:
        """
        Alta de solicitud para el colaborador titular (por defecto el usuario autenticado).

        Roles autorizados pueden enviar `empleado_id` para registrar en nombre de otro colaborador
        dentro de su alcance (equipo/rh/director), alineado con incidencias.

        No se aplican aquí reglas de aprobación jerárquica ni auto-aprobación; esas viven
        únicamente en `aprobar_solicitud` y `rechazar_solicitud`.

        Orden de validación en creación:
        1) Duplicidad exacta (mismo empleado, mismas fechas inicio/fin, estados activos).
        2) Saldo de vacaciones (solo tipo vacaciones, lectura TRESS).
        3) Persistencia y notificaciones.
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        target = await self._resolver_empleado_objetivo_crear_solicitud(data, current_user)

        fecha_inicio = data.fecha_inicio
        fecha_fin = data.fecha_fin
        if rol == "empleado" and data.tipo == "home_office" and fecha_fin != fecha_inicio:
            raise DomainValidationError(
                detail="Para Home Office del empleado solo se permite un día (fecha inicio y fin iguales)."
            )
        if data.tipo == "permiso_sin_goce_sueldo" and rol not in (
            "supervisor",
            "gerente",
            "rh",
            "director",
        ):
            raise ForbiddenError(
                detail="Solo supervisor, gerente, RH o director pueden crear permisos sin goce de sueldo"
            )
        if data.tipo in _TIPOS_GOCE_SUELDO_RH:
            if rol != "rh":
                raise ForbiddenError(
                    detail="Solo RH puede crear solicitudes con goce de sueldo"
                )
            if data.tipo == "matrimonio":
                fecha_fin = fecha_inicio + timedelta(days=1)
            elif data.tipo == "defuncion":
                fecha_fin = fecha_inicio + timedelta(days=2)
            elif data.tipo == "paternidad":
                fecha_fin = _sumar_dias_habiles(fecha_inicio, 7)
            # incapacidad_interna mantiene la fecha_fin indicada por RH.

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
            await self._validar_saldo_vacaciones_crear(
                empleado=target,
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

        if target.lider_id:
            supervisor_id = target.lider_id
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
        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}
        no_empleado_solicitante = solicitud.empleado.no_empleado

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
            },
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
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede aprobar una solicitud en estado '{solicitud.estado}'"
            )

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, rol)
        emp = solicitud.empleado

        if rol in ("director", "rh"):
            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
        lid = emp.lider_id
        gid = primer_g.id if primer_g else None

        if _puede_actuar_jerarquia_solicitud(
            rol=rol,
            lider_id=lid,
            primer_gerente_id=gid,
            current_user_id=current_user.id,
        ):
            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        raise ForbiddenError(
            detail="No tienes permiso para aprobar esta solicitud. Solo el supervisor directo, "
            "el gerente de linea, RH o director pueden aprobarla."
        )

    # ── Rechazar ─────────────────────────────────────────────────────────────

    async def rechazar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede rechazar una solicitud en estado '{solicitud.estado}'"
            )

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, rol)
        emp = solicitud.empleado

        if rol not in ("director", "rh"):
            primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
            lid = emp.lider_id
            gid = primer_g.id if primer_g else None
            if not _puede_actuar_jerarquia_solicitud(
                rol=rol,
                lider_id=lid,
                primer_gerente_id=gid,
                current_user_id=current_user.id,
            ):
                raise ForbiddenError(
                    detail="No tienes permiso para rechazar esta solicitud. Solo el supervisor directo, "
                    "el gerente de linea, RH o director pueden rechazarla."
                )

        datos_antes = {"estado": solicitud.estado}
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
    ) -> SolicitudResponse:
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

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        _asegurar_no_autopaprobacion_jerarquica(solicitud, current_user, rol)
        emp = solicitud.empleado

        if rol not in ("director", "rh"):
            primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
            lid = emp.lider_id
            gid = primer_g.id if primer_g else None
            if not _puede_actuar_jerarquia_solicitud(
                rol=rol,
                lider_id=lid,
                primer_gerente_id=gid,
                current_user_id=current_user.id,
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

        if solicitud.tipo == "vacaciones":
            await self._validar_saldo_vacaciones_crear(
                empleado=current_user,
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
            )

        datos_antes = {
            "estado": solicitud.estado,
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
            "comentarios": solicitud.comentarios,
        }
        await self.repo.update(
            solicitud_id,
            {
                "fecha_inicio": data.fecha_inicio,
                "fecha_fin": data.fecha_fin,
                "comentarios": data.comentarios,
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
                "comentarios": data.comentarios,
                "nivel_actual": 1,
            },
        )

        if current_user.lider_id:
            supervisor_id = current_user.lider_id
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
    ) -> list[SolicitudAprobacionResponse]:
        # Verificar acceso a la solicitud
        await self.get_solicitud(solicitud_id=solicitud_id, current_user=current_user)

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
