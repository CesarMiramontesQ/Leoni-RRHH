# app/services/solicitud_service.py
"""
Logica de negocio del dominio solicitudes.

Flujo de estados:
  pending → approved   (via aprobar_solicitud)
  pending → rejected   (via rechazar_solicitud)
  pending → cancelled  (via cancelar_solicitud — solo el propio empleado)
  pending/rejected → overridden  (via override_solicitud — director o rh)

Al aprobar: se encola en TRESS dentro de la misma transaccion (consistencia garantizada).
Al rechazar/cancelar: NO se encola en TRESS.
"""

import logging
from datetime import date
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
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.solicitud_repository import (
    SolicitudAprobacionRepository,
    SolicitudRepository,
)
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudResponse,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

# Acciones TRESS por tipo de solicitud
_TRESS_ACCION_MAP = {
    "vacaciones": "REGISTRAR_VACACIONES",
    "home_office": "REGISTRAR_HOME_OFFICE",
}

# Duplicidad exacta (mismo colaborador, mismas fechas inicio/fin): solo estos estados
# cuentan como «ya existe»; rechazadas/canceladas permiten volver a registrar esas fechas.
_ESTADOS_DUPLICADO_EXACTO = frozenset({"pending", "approved", "overridden"})
_MSG_SOLICITUD_YA_EXISTE = "Esta solicitud ya existe"


def _dias_solicitud_inclusive(fecha_inicio: date, fecha_fin: date) -> int:
    return (fecha_fin - fecha_inicio).days + 1


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
    foto: str | None = None
    lid_id: int | None = None
    lid_nom: str | None = None
    if emp:
        foto = emp.foto
        lid_id = emp.lider_id
        if emp.area is not None:
            area_desc = emp.area.descripcion
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
        comentarios=s.comentarios,
        created_at=s.created_at,
        empleado_nombre=nombre,
        empleado_area=area_desc,
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
        self.db = db

    async def _build_solicitud_response_con_flujo(self, solicitud: Solicitud) -> SolicitudResponse:
        base = _solicitud_to_response(solicitud)
        emp = solicitud.empleado
        if not emp:
            return base
        primer_g = await self.empleado_repo.get_primer_gerente_en_cadena(emp.id)
        sup_id = emp.lider_id
        sup_aprobo = _supervisor_ya_aprobo(solicitud, sup_id)
        pend_sup = solicitud.estado == "pending" and sup_id is not None and not sup_aprobo
        pend_ger = solicitud.estado == "pending" and solicitud.nivel_actual >= 2
        return base.model_copy(
            update={
                "gerente_linea_id": primer_g.id if primer_g else None,
                "gerente_linea_nombre": primer_g.nombre if primer_g else None,
                "supervisor_aprobo": sup_aprobo,
                "pendiente_aprobacion_supervisor": pend_sup,
                "pendiente_aprobacion_gerente": pend_ger,
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
                empleado_id=current_user.id, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id == current_user.id]
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
        current_user: Empleado,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> None:
        """Solo `vacaciones`: compara días solicitados (inclusive) vs TRESS."""
        no = (current_user.no_empleado or "").strip()
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

    async def crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        """
        Alta de solicitud para el usuario autenticado (cualquier rol permitido en el router).

        No se aplican aquí reglas de aprobación jerárquica ni auto-aprobación; esas viven
        únicamente en `aprobar_solicitud` y `rechazar_solicitud`.

        Orden de validación en creación:
        1) Duplicidad exacta (mismo empleado, mismas fechas inicio/fin, estados activos).
        2) Saldo de vacaciones (solo tipo vacaciones, lectura TRESS).
        3) Persistencia y notificaciones.
        """
        duplicado = await self.repo.count(
            filters=[
                Solicitud.empleado_id == current_user.id,
                Solicitud.fecha_inicio == data.fecha_inicio,
                Solicitud.fecha_fin == data.fecha_fin,
                Solicitud.estado.in_(_ESTADOS_DUPLICADO_EXACTO),
            ]
        )
        if duplicado > 0:
            raise ConflictError(detail=_MSG_SOLICITUD_YA_EXISTE)

        if data.tipo == "vacaciones":
            await self._validar_saldo_vacaciones_crear(
                current_user=current_user,
                fecha_inicio=data.fecha_inicio,
                fecha_fin=data.fecha_fin,
            )

        solicitud = await self.repo.create({
            "empleado_id": current_user.id,
            "tipo": data.tipo,
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "estado": "pending",
            "nivel_actual": 1,
            "comentarios": data.comentarios,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CREATED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud.id,
            datos_despues={"tipo": solicitud.tipo, "estado": solicitud.estado},
        )

        # Notificar al empleado solicitante que su registro quedo en revision.
        background_tasks.add_task(
            _enviar_notificacion_background,
            destinatario_id=current_user.id,
            asunto="Tu solicitud fue enviada",
            cuerpo=(
                f"Tu solicitud de <b>{data.tipo}</b> del {data.fecha_inicio} al "
                f"{data.fecha_fin} fue enviada y esta en revision."
            ),
            canal="in_app",
            target_url="#/solicitudes",
            metadata={
                "entidad": "solicitud",
                "tipo": data.tipo,
                "estado": "pending",
            },
        )

        if current_user.lider_id:
            supervisor_id = current_user.lider_id
            nombre_empleado = current_user.nombre
            tipo = data.tipo

            background_tasks.add_task(
                _enviar_notificacion_background,
                destinatario_id=supervisor_id,
                asunto=f"Nueva solicitud de {nombre_empleado}",
                cuerpo=(
                    f"Se ha generado una solicitud de <b>{tipo}</b> "
                    f"del {data.fecha_inicio} al {data.fecha_fin}. "
                    "Por favor rev&iacute;sala en la plataforma."
                ),
                canal="in_app",
                target_url="#/solicitudes",
                metadata={
                    "entidad": "solicitud",
                    "tipo": tipo,
                },
            )

        return _solicitud_to_response(solicitud, empleado_ctx=current_user)

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

        await self.repo.update(solicitud_id, {"estado": "approved"})
        await self.aprobacion_repo.create({
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

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_APPROVED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "approved"},
        )

        empleado_id = solicitud.empleado_id
        background_tasks.add_task(
            _enviar_notificacion_background,
            destinatario_id=empleado_id,
            asunto="Tu solicitud fue aprobada",
            cuerpo="Tu solicitud ha sido <b>aprobada</b>. Puedes consultarla en la plataforma.",
            canal="in_app",
            target_url="#/solicitudes",
            metadata={"entidad": "solicitud", "estado": "approved"},
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

        if solicitud.nivel_actual == 1:
            if lid is None:
                raise ForbiddenError(
                    detail="La solicitud no tiene supervisor asignado; solo RH o director pueden aprobarla"
                )
            if lid != current_user.id:
                raise ForbiddenError(
                    detail="Solo el jefe directo puede actuar sobre esta solicitud en esta etapa"
                )
            requiere_segunda_etapa = (
                primer_g is not None
                and lid is not None
                and primer_g.id != lid
            )
            if requiere_segunda_etapa:
                datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}
                await self.aprobacion_repo.create({
                    "solicitud_id": solicitud_id,
                    "aprobador_id": current_user.id,
                    "accion": "approve",
                    "nivel": aprobacion.nivel,
                    "comentario": aprobacion.comentario,
                })
                await self.repo.update(solicitud_id, {"nivel_actual": 2})
                audit_background(
                    background_tasks=background_tasks,
                    db=self.db,
                    accion="SOLICITUD_ETAPA_SUPERVISOR_COMPLETADA",
                    modulo="solicitudes",
                    usuario_id=current_user.id,
                    entidad_id=solicitud_id,
                    datos_antes=datos_antes,
                    datos_despues={"nivel_actual": 2, "estado": "pending"},
                )
                solicitud_final = await self.repo.get_with_empleado(solicitud_id)
                if not solicitud_final:
                    raise NotFoundError(entidad="Solicitud", id=solicitud_id)
                return await self._build_solicitud_response_con_flujo(solicitud_final)

            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        if solicitud.nivel_actual >= 2:
            if primer_g is None or primer_g.id != current_user.id:
                raise ForbiddenError(
                    detail="Solo el gerente responsable de la linea puede completar esta aprobacion"
                )
            if lid is not None and not _supervisor_ya_aprobo(solicitud, lid):
                raise ForbiddenError(
                    detail="Aun no consta la aprobacion del supervisor directo en el sistema"
                )
            return await self._aprobar_final_con_tress(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                aprobacion=aprobacion,
                current_user=current_user,
                background_tasks=background_tasks,
            )

        raise ConflictError(detail="Estado de flujo de la solicitud no valido para aprobar")

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
            if solicitud.nivel_actual == 1:
                if lid is None:
                    raise ForbiddenError(
                        detail="La solicitud no tiene supervisor asignado; solo RH o director pueden rechazarla"
                    )
                if lid != current_user.id:
                    raise ForbiddenError(
                        detail="Solo el jefe directo puede rechazar la solicitud en esta etapa"
                    )
            elif solicitud.nivel_actual >= 2:
                if primer_g is None or primer_g.id != current_user.id:
                    raise ForbiddenError(
                        detail="Solo el gerente responsable de la linea puede rechazar en esta etapa"
                    )
                if lid is not None and not _supervisor_ya_aprobo(solicitud, lid):
                    raise ForbiddenError(
                        detail="Aun no consta la aprobacion del supervisor directo en el sistema"
                    )
            else:
                raise ConflictError(detail="Estado de flujo de la solicitud no valido para rechazar")

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

        if solicitud.estado not in ("pending", "rejected"):
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
        return [SolicitudAprobacionResponse.model_validate(a) for a in aprobaciones]
