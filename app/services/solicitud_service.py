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

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
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


class SolicitudService:
    def __init__(self, db: AsyncSession):
        self.repo = SolicitudRepository(db)
        self.aprobacion_repo = SolicitudAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

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
        - supervisor/gerente: propias + equipo directo
        - director/rh: todas
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()

        elif rol in ("supervisor", "gerente"):
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

        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id == current_user.id]
            )

        return PaginatedResponse(
            items=[SolicitudResponse.model_validate(item) for item in items],
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

        if rol not in ("director", "rh"):
            if solicitud.empleado_id != current_user.id:
                if rol in ("supervisor", "gerente"):
                    subordinados = await self.empleado_repo.get_subordinados(
                        current_user.id, settings.ESTADOS_ACTIVOS_IDS
                    )
                    ids = {e.id for e in subordinados}
                    if solicitud.empleado_id not in ids:
                        raise ForbiddenError(detail="No tienes acceso a esta solicitud")
                else:
                    raise ForbiddenError(detail="No tienes acceso a esta solicitud")

        return SolicitudResponse.model_validate(solicitud)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        # Regla de negocio: no mas de una solicitud pending del mismo tipo
        pendientes = await self.repo.count(
            filters=[
                Solicitud.empleado_id == current_user.id,
                Solicitud.tipo == data.tipo,
                Solicitud.estado == "pending",
            ]
        )
        if pendientes > 0:
            raise ConflictError(
                detail=f"Ya tienes una solicitud de '{data.tipo}' pendiente de aprobacion"
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

        if current_user.lider_id:
            supervisor_id = current_user.lider_id
            nombre_empleado = current_user.nombre
            tipo = data.tipo

            async def _notify_supervisor() -> None:
                from app.services.notificacion_service import NotificacionService
                svc = NotificacionService(self.db)
                await svc.enviar(
                    destinatario_id=supervisor_id,
                    asunto=f"Nueva solicitud de {nombre_empleado}",
                    cuerpo=(
                        f"Se ha generado una solicitud de <b>{tipo}</b> "
                        f"del {data.fecha_inicio} al {data.fecha_fin}. "
                        "Por favor rev&iacute;sala en la plataforma."
                    ),
                    canal="in_app",
                )

            background_tasks.add_task(_notify_supervisor)

        return SolicitudResponse.model_validate(solicitud)

    # ── Aprobar ──────────────────────────────────────────────────────────────

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

        # Verificar relacion jerarquica
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol not in ("director", "rh"):
            if solicitud.empleado.lider_id != current_user.id:
                raise ForbiddenError(
                    detail="Solo el supervisor directo puede aprobar en este nivel"
                )

        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}

        solicitud = await self.repo.update(solicitud_id, {"estado": "approved"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "approve",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        # Encolar TRESS dentro de la transaccion — atomico con la aprobacion
        accion_tress = _TRESS_ACCION_MAP.get(solicitud.tipo, "REGISTRAR_VACACIONES")
        await encolar_tress(
            db=self.db,
            accion=accion_tress,
            payload={
                "empleado_num": solicitud.empleado.no_empleado,
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

        # Notificar al solicitante
        empleado_id = solicitud.empleado_id

        async def _notify_aprobacion() -> None:
            from app.services.notificacion_service import NotificacionService
            svc = NotificacionService(self.db)
            await svc.enviar(
                destinatario_id=empleado_id,
                asunto="Tu solicitud fue aprobada",
                cuerpo="Tu solicitud ha sido <b>aprobada</b>. Puedes consultarla en la plataforma.",
                canal="in_app",
            )

        background_tasks.add_task(_notify_aprobacion)

        return SolicitudResponse.model_validate(solicitud)

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

        datos_antes = {"estado": solicitud.estado}
        solicitud = await self.repo.update(solicitud_id, {"estado": "rejected"})
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

        return SolicitudResponse.model_validate(solicitud)

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

        return SolicitudResponse.model_validate(solicitud)

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

        return SolicitudResponse.model_validate(solicitud)

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
