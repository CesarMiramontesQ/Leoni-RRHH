"""Ciclo de aprobación de horas extra: gerente regional y director (en paralelo).

Reglas de negocio (confirmadas):
  - Aprobación en paralelo: gerente regional y director firman en cualquier orden.
  - Estado `aprobado` solo cuando existe firma aprobada de gerente regional Y director.
  - Si varios gerentes regionales están asignados, basta con que uno apruebe (una sola
    ranura de firma `gerente_regional` por solicitud).
  - Un rechazo cancela definitivamente la solicitud (estado `rechazado`, terminal).
  - Cada decisión se notifica a los involucrados por in-app + correo.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Iterable

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.horas_extra import HorasExtraAprobacion, HorasExtraSolicitud
from app.repositories.horas_extra_aprobacion_repository import (
    HorasExtraAprobacionRepository,
)
from app.schemas.horas_extra_aprobacion import (
    ESTADO_CONSOLIDADO_LABELS,
    TIPO_FIRMA_LABELS,
    HorasExtraEstadoConsolidadoResponse,
    HorasExtraFirmaResponse,
    HorasExtraHistorialResponse,
    HorasExtraPendienteItem,
    HorasExtraPendientesListResponse,
)

logger = logging.getLogger(__name__)

_ROLES_LECTURA = frozenset({"rh", "director", "gerente"})
_REQUERIDAS = ("gerente_regional", "director_planta")
_TARGET_APROBACIONES = "#/nominas/horas-extra/aprobaciones"
_TARGET_RH = "#/nominas/horas-extra"


# ── Notificaciones en background (sesión propia, fire-and-forget) ──


async def _enviar_he_notificacion_background(
    *,
    destinatario_id: int,
    asunto: str,
    cuerpo: str,
    canal: str = "ambos",
    email_destino: str | None = None,
    target_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    from app.core.database import AsyncSessionLocal
    from app.services.notificacion_service import NotificacionService

    try:
        async with AsyncSessionLocal() as db:
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
    except Exception as exc:  # pragma: no cover - no crítico
        logger.error("Error en notificación de horas extra: %s", exc, exc_info=True)


def _agendar_notificaciones(
    background_tasks: BackgroundTasks | None,
    destinatarios: Iterable[tuple[int, str | None]],
    *,
    asunto: str,
    cuerpo: str,
    solicitud_id: int,
    evento: str,
    target_url: str,
) -> None:
    if background_tasks is None:
        return
    vistos: set[int] = set()
    for dest_id, email in destinatarios:
        if dest_id is None or dest_id in vistos:
            continue
        vistos.add(dest_id)
        background_tasks.add_task(
            _enviar_he_notificacion_background,
            destinatario_id=dest_id,
            asunto=asunto,
            cuerpo=cuerpo,
            canal="ambos",
            email_destino=email,
            target_url=target_url,
            metadata={
                "entidad": "horas_extra",
                "solicitud_id": solicitud_id,
                "evento": evento,
            },
        )


# ── Lógica de estado (función centralizada) ──


def has_firma_aprobada(aprobaciones: Iterable[HorasExtraAprobacion], tipo_firma: str) -> bool:
    return any(
        a.tipo_firma == tipo_firma and a.estado == "aprobado" for a in aprobaciones
    )


def hay_rechazo(aprobaciones: Iterable[HorasExtraAprobacion]) -> bool:
    return any(a.estado == "rechazado" for a in aprobaciones)


def calcular_estado(aprobaciones: Iterable[HorasExtraAprobacion]) -> str:
    """Estado persistido de la solicitud: pendiente | aprobado | rechazado."""
    aprobaciones = list(aprobaciones)
    if hay_rechazo(aprobaciones):
        return "rechazado"
    if has_firma_aprobada(aprobaciones, "gerente_regional") and has_firma_aprobada(
        aprobaciones, "director_planta"
    ):
        return "aprobado"
    return "pendiente"


def estado_consolidado(aprobaciones: Iterable[HorasExtraAprobacion]) -> str:
    """Estado para UI/RH: pendiente | aprobado_parcial | aprobado | rechazado."""
    aprobaciones = list(aprobaciones)
    if hay_rechazo(aprobaciones):
        return "rechazado"
    has_regional = has_firma_aprobada(aprobaciones, "gerente_regional")
    has_director = has_firma_aprobada(aprobaciones, "director_planta")
    if has_regional and has_director:
        return "aprobado"
    if has_regional or has_director:
        return "aprobado_parcial"
    return "pendiente"


class HorasExtraAprobacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HorasExtraAprobacionRepository(db)

    # ── Helpers ──

    @staticmethod
    def _total_horas(solicitud: HorasExtraSolicitud) -> float:
        total = sum((d.total_horas for d in solicitud.detalle), Decimal("0"))
        return round(float(total), 2)

    @staticmethod
    def _firma_response(a: HorasExtraAprobacion) -> HorasExtraFirmaResponse:
        return HorasExtraFirmaResponse(
            tipo_firma=a.tipo_firma,
            tipo_firma_label=TIPO_FIRMA_LABELS.get(a.tipo_firma, a.tipo_firma),
            estado=a.estado,
            aprobador_id=a.aprobador_id,
            aprobador_nombre=a.aprobador.nombre if a.aprobador else None,
            rol_aprobador_nombre=a.rol_aprobador_nombre,
            fecha_aprobacion=a.fecha_aprobacion,
            comentario=a.comentario,
        )

    @staticmethod
    def _firmas_ordenadas(
        aprobaciones: Iterable[HorasExtraAprobacion],
    ) -> list[HorasExtraAprobacion]:
        orden = {"gerente_regional": 0, "director_planta": 1, "gerente_area": 2}
        return sorted(aprobaciones, key=lambda a: orden.get(a.tipo_firma, 9))

    async def _solicitud_o_404(self, solicitud_id: int) -> HorasExtraSolicitud:
        solicitud = await self.repo.get_solicitud_full(solicitud_id)
        if solicitud is None:
            raise NotFoundError("Solicitud de horas extra", solicitud_id)
        return solicitud

    def _require_lectura(self, current_user: Empleado) -> None:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol not in _ROLES_LECTURA:
            raise ForbiddenError(detail="No tienes acceso a Horas Extra")

    # ── Pendientes para el aprobador ──

    async def listar_pendientes(
        self,
        current_user: Empleado,
        *,
        page: int = 1,
        page_size: int = 12,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
    ) -> HorasExtraPendientesListResponse:
        tipos = await self.repo.tipos_firma_de_empleado(current_user.id)
        if not tipos:
            return HorasExtraPendientesListResponse(
                items=[], total=0, page=page, page_size=page_size
            )

        total = await self.repo.count_pendientes(
            tipos,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
        )
        offset = (page - 1) * page_size
        solicitudes = await self.repo.list_pendientes(
            tipos,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            offset=offset,
            limit=page_size,
        )

        items: list[HorasExtraPendienteItem] = []
        for s in solicitudes:
            mi_firma = next(
                (
                    a.tipo_firma
                    for a in s.aprobaciones
                    if a.tipo_firma in tipos and a.estado == "pendiente"
                ),
                None,
            )
            if mi_firma is None:
                continue
            cons = estado_consolidado(s.aprobaciones)
            items.append(
                HorasExtraPendienteItem(
                    solicitud_id=s.id,
                    semana=s.semana_inicio.isocalendar()[1],
                    semana_inicio=s.semana_inicio,
                    fecha_solicitud=s.fecha_solicitud,
                    tipo=s.tipo,
                    area_descripcion=s.area.descripcion if s.area else None,
                    centrocosto_id=s.centrocosto_id,
                    centrocosto_descripcion=(
                        s.centro_costo.descripcion if s.centro_costo else None
                    ),
                    motivo=s.motivo.descripcion if s.motivo else None,
                    total_horas=self._total_horas(s),
                    total_empleados=len(s.detalle),
                    registrado_por_nombre=(
                        s.registrado_por.nombre if s.registrado_por else None
                    ),
                    mi_tipo_firma=mi_firma,
                    mi_tipo_firma_label=TIPO_FIRMA_LABELS.get(mi_firma, mi_firma),
                    estado_consolidado=cons,
                    aprobado_parcial=cons == "aprobado_parcial",
                )
            )

        return HorasExtraPendientesListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    # ── Aprobar / Rechazar ──

    async def _firma_objetivo(
        self,
        solicitud: HorasExtraSolicitud,
        current_user: Empleado,
    ) -> HorasExtraAprobacion:
        tipos_usuario = await self.repo.tipos_firma_de_empleado(current_user.id)
        if not tipos_usuario:
            raise ForbiddenError(
                detail="No estás asignado como aprobador de horas extra."
            )
        firmas_usuario = [
            a for a in solicitud.aprobaciones if a.tipo_firma in tipos_usuario
        ]
        if not firmas_usuario:
            raise ForbiddenError(
                detail="No estás asignado como aprobador de esta solicitud."
            )
        # Si ya hay una firma pendiente del usuario, esa es la objetivo.
        pendiente = next((a for a in firmas_usuario if a.estado == "pendiente"), None)
        if pendiente is not None:
            return pendiente
        # Todas las firmas de su tipo ya fueron resueltas.
        firmada = firmas_usuario[0]
        label = TIPO_FIRMA_LABELS.get(firmada.tipo_firma, firmada.tipo_firma)
        raise DomainValidationError(
            detail=f"Esta solicitud ya fue firmada por {label.lower()}."
        )

    def _validar_solicitud_accionable(self, solicitud: HorasExtraSolicitud) -> None:
        if solicitud.estado == "rechazado":
            raise DomainValidationError(
                detail="La solicitud fue rechazada y no admite más acciones."
            )
        if solicitud.estado == "aprobado":
            raise DomainValidationError(
                detail="La solicitud ya está aprobada por completo."
            )
        if solicitud.estado not in ("pendiente",):
            raise DomainValidationError(
                detail="La solicitud no está en un estado que permita aprobación."
            )

    async def aprobar(
        self,
        solicitud_id: int,
        current_user: Empleado,
        *,
        comentario: str | None = None,
        background_tasks: BackgroundTasks | None = None,
    ) -> HorasExtraEstadoConsolidadoResponse:
        solicitud = await self._solicitud_o_404(solicitud_id)
        self._validar_solicitud_accionable(solicitud)
        firma = await self._firma_objetivo(solicitud, current_user)

        firma.estado = "aprobado"
        firma.aprobador_id = current_user.id
        firma.rol_aprobador_id = current_user.rol_id
        firma.rol_aprobador_nombre = (
            current_user.rol.nombre if current_user.rol else None
        )
        firma.fecha_aprobacion = datetime.now(timezone.utc)
        firma.comentario = comentario

        solicitud.estado = calcular_estado(solicitud.aprobaciones)
        await self.db.commit()

        await self._notificar_aprobacion(
            solicitud, firma, background_tasks=background_tasks
        )
        return self._estado_response(solicitud)

    async def rechazar(
        self,
        solicitud_id: int,
        current_user: Empleado,
        *,
        comentario: str,
        background_tasks: BackgroundTasks | None = None,
    ) -> HorasExtraEstadoConsolidadoResponse:
        if not comentario or not comentario.strip():
            raise DomainValidationError(
                detail="El comentario es obligatorio al rechazar."
            )
        solicitud = await self._solicitud_o_404(solicitud_id)
        self._validar_solicitud_accionable(solicitud)
        firma = await self._firma_objetivo(solicitud, current_user)

        firma.estado = "rechazado"
        firma.aprobador_id = current_user.id
        firma.rol_aprobador_id = current_user.rol_id
        firma.rol_aprobador_nombre = (
            current_user.rol.nombre if current_user.rol else None
        )
        firma.fecha_aprobacion = datetime.now(timezone.utc)
        firma.comentario = comentario.strip()

        solicitud.estado = calcular_estado(solicitud.aprobaciones)
        await self.db.commit()

        await self._notificar_rechazo(
            solicitud, firma, background_tasks=background_tasks
        )
        return self._estado_response(solicitud)

    # ── Consultas (RH / aprobadores) ──

    async def estado_consolidado(
        self, solicitud_id: int, current_user: Empleado
    ) -> HorasExtraEstadoConsolidadoResponse:
        self._require_lectura(current_user)
        solicitud = await self._solicitud_o_404(solicitud_id)
        return self._estado_response(solicitud)

    async def historial(
        self, solicitud_id: int, current_user: Empleado
    ) -> HorasExtraHistorialResponse:
        self._require_lectura(current_user)
        solicitud = await self._solicitud_o_404(solicitud_id)
        cons = estado_consolidado(solicitud.aprobaciones)
        return HorasExtraHistorialResponse(
            solicitud_id=solicitud.id,
            estado=cons,
            estado_label=ESTADO_CONSOLIDADO_LABELS[cons],
            firmas=[
                self._firma_response(a)
                for a in self._firmas_ordenadas(solicitud.aprobaciones)
            ],
        )

    def _estado_response(
        self, solicitud: HorasExtraSolicitud
    ) -> HorasExtraEstadoConsolidadoResponse:
        aprobaciones = list(solicitud.aprobaciones)
        cons = estado_consolidado(aprobaciones)
        rechazo = next((a for a in aprobaciones if a.estado == "rechazado"), None)
        faltantes: list[str] = []
        if cons not in ("aprobado", "rechazado"):
            for tipo in _REQUERIDAS:
                if not has_firma_aprobada(aprobaciones, tipo):
                    faltantes.append(TIPO_FIRMA_LABELS[tipo])
        return HorasExtraEstadoConsolidadoResponse(
            solicitud_id=solicitud.id,
            estado=cons,
            estado_label=ESTADO_CONSOLIDADO_LABELS[cons],
            aprobado_parcial=cons == "aprobado_parcial",
            listo_para_nomina=cons == "aprobado",
            firmas=[
                self._firma_response(a) for a in self._firmas_ordenadas(aprobaciones)
            ],
            faltantes=faltantes,
            rechazado_por=(
                rechazo.aprobador.nombre if rechazo and rechazo.aprobador else None
            ),
            comentario_rechazo=rechazo.comentario if rechazo else None,
        )

    # ── Notificaciones por evento ──

    async def _rh_recipients(self) -> list[tuple[int, str | None]]:
        rh = await self.repo.empleados_por_rol("rh")
        return [(e.id, e.email) for e in rh]

    async def _notificar_aprobacion(
        self,
        solicitud: HorasExtraSolicitud,
        firma: HorasExtraAprobacion,
        *,
        background_tasks: BackgroundTasks | None,
    ) -> None:
        if background_tasks is None:
            return
        destinatarios = await self._rh_recipients()

        if solicitud.estado == "aprobado":
            if solicitud.registrado_por:
                destinatarios.append(
                    (solicitud.registrado_por_id, solicitud.registrado_por.email)
                )
            _agendar_notificaciones(
                background_tasks,
                destinatarios,
                asunto="Horas extra aprobadas",
                cuerpo=(
                    "La solicitud de horas extras fue aprobada y está lista para nómina."
                ),
                solicitud_id=solicitud.id,
                evento="aprobado_final",
                target_url=_TARGET_RH,
            )
            return

        if firma.tipo_firma == "gerente_regional":
            directores = await self.repo.empleados_aprobadores_por_tipo("director")
            destinatarios.extend((d.id, d.email) for d in directores)
            cuerpo = (
                "El gerente regional aprobó una solicitud de horas extras. "
                "Falta aprobación del director."
            )
            evento = "aprobado_gerente_regional"
        else:
            gerentes = await self.repo.empleados_aprobadores_por_tipo("gerente_regional")
            destinatarios.extend((g.id, g.email) for g in gerentes)
            cuerpo = "El director aprobó una solicitud de horas extras."
            evento = "aprobado_director"

        _agendar_notificaciones(
            background_tasks,
            destinatarios,
            asunto="Avance en aprobación de horas extra",
            cuerpo=cuerpo,
            solicitud_id=solicitud.id,
            evento=evento,
            target_url=_TARGET_APROBACIONES,
        )

    async def _notificar_rechazo(
        self,
        solicitud: HorasExtraSolicitud,
        firma: HorasExtraAprobacion,
        *,
        background_tasks: BackgroundTasks | None,
    ) -> None:
        if background_tasks is None:
            return
        destinatarios = await self._rh_recipients()
        gerentes = await self.repo.empleados_aprobadores_por_tipo("gerente_regional")
        directores = await self.repo.empleados_aprobadores_por_tipo("director")
        destinatarios.extend((g.id, g.email) for g in gerentes)
        destinatarios.extend((d.id, d.email) for d in directores)
        if solicitud.registrado_por:
            destinatarios.append(
                (solicitud.registrado_por_id, solicitud.registrado_por.email)
            )
        _agendar_notificaciones(
            background_tasks,
            destinatarios,
            asunto="Horas extra rechazadas",
            cuerpo=(
                "La solicitud de horas extras fue rechazada. Revisa los comentarios."
            ),
            solicitud_id=solicitud.id,
            evento="rechazado",
            target_url=_TARGET_RH,
        )


# ── Generación de firmas al crear la solicitud (decisión: automático) ──


async def seed_firmas_solicitud(db: AsyncSession, solicitud_id: int) -> set[str]:
    """Crea las firmas pendientes según los aprobadores activos. Hace flush, no commit."""
    repo = HorasExtraAprobacionRepository(db)
    tipos = await repo.tipos_firma_para_seed()
    await repo.crear_firmas_pendientes(solicitud_id, tipos)
    return tipos


async def notificar_solicitud_creada(
    db: AsyncSession,
    solicitud: HorasExtraSolicitud,
    background_tasks: BackgroundTasks | None,
) -> None:
    """Notifica a los aprobadores asignados que hay una solicitud pendiente."""
    if background_tasks is None:
        return
    repo = HorasExtraAprobacionRepository(db)
    gerentes = await repo.empleados_aprobadores_por_tipo("gerente_regional")
    directores = await repo.empleados_aprobadores_por_tipo("director")
    destinatarios = [(g.id, g.email) for g in gerentes]
    destinatarios.extend((d.id, d.email) for d in directores)
    _agendar_notificaciones(
        background_tasks,
        destinatarios,
        asunto="Solicitud de horas extra pendiente",
        cuerpo="Tienes una solicitud de horas extras pendiente de aprobación.",
        solicitud_id=solicitud.id,
        evento="asignacion",
        target_url=_TARGET_APROBACIONES,
    )
