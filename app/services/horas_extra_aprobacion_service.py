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
    HE_AUDIT_APPROVED,
    HE_AUDIT_REJECTED,
    HorasExtraAprobacionRepository,
)
from app.schemas.horas_extra_aprobacion import (
    ESTADO_CONSOLIDADO_LABELS,
    TIPO_FIRMA_LABELS,
    HorasExtraAprobacionDetalleResponse,
    HorasExtraAprobadorAsignadoItem,
    HorasExtraDetalleEmpleadoItem,
    HorasExtraEstadoConsolidadoResponse,
    HorasExtraFirmaResponse,
    HorasExtraHistorialEvento,
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

    @staticmethod
    def _empleado_resumen(solicitud: HorasExtraSolicitud) -> tuple[str | None, str | None]:
        if not solicitud.detalle:
            return None, None
        if len(solicitud.detalle) == 1:
            emp = solicitud.detalle[0].empleado
            nombre = emp.nombre if emp else None
            puesto = emp.puesto.descripcion if emp and emp.puesto else None
            return nombre, puesto
        return f"{len(solicitud.detalle)} empleados", None

    def _build_historial_eventos(
        self, solicitud: HorasExtraSolicitud, audit_entries
    ) -> list[HorasExtraHistorialEvento]:
        eventos: list[HorasExtraHistorialEvento] = []
        accion_labels = {
            "HE_SOLICITUD_VIEWED": "Solicitud visualizada",
            "HE_SOLICITUD_APPROVED": "Aprobado",
            "HE_SOLICITUD_REJECTED": "Rechazado",
        }
        for entry in audit_entries:
            if entry.accion != "HE_SOLICITUD_VIEWED":
                continue
            datos = entry.datos_despues or {}
            eventos.append(
                HorasExtraHistorialEvento(
                    usuario_nombre=(
                        datos.get("usuario_nombre")
                        or (entry.usuario.nombre if entry.usuario else "Sistema")
                    ),
                    rol=datos.get("rol")
                    or (
                        entry.usuario.rol.nombre
                        if entry.usuario and entry.usuario.rol
                        else None
                    ),
                    accion=accion_labels.get(entry.accion, entry.accion),
                    comentario=datos.get("comentario"),
                    fecha_hora=entry.timestamp,
                )
            )
        for firma in solicitud.aprobaciones:
            if firma.estado not in ("aprobado", "rechazado") or not firma.fecha_aprobacion:
                continue
            eventos.append(
                HorasExtraHistorialEvento(
                    usuario_nombre=firma.aprobador.nombre if firma.aprobador else "—",
                    rol=firma.rol_aprobador_nombre,
                    accion="Aprobado" if firma.estado == "aprobado" else "Rechazado",
                    comentario=firma.comentario,
                    fecha_hora=firma.fecha_aprobacion,
                )
            )
        eventos.sort(key=lambda e: e.fecha_hora, reverse=True)
        return eventos

    async def _require_visualizacion_previa(
        self, solicitud_id: int, usuario_id: int
    ) -> None:
        if not await self.repo.usuario_visualizo_solicitud(usuario_id, solicitud_id):
            raise DomainValidationError(
                detail=(
                    "Debes abrir y revisar la solicitud en el detalle "
                    "antes de aprobar o rechazar."
                )
            )

    async def _aprobadores_asignados(
        self,
    ) -> tuple[list[HorasExtraAprobadorAsignadoItem], HorasExtraAprobadorAsignadoItem | None]:
        gerentes = await self.repo.empleados_aprobadores_por_tipo("gerente_regional")
        directores = await self.repo.empleados_aprobadores_por_tipo("director")
        gerentes_items = [
            HorasExtraAprobadorAsignadoItem(nombre=g.nombre, email=g.email)
            for g in gerentes
        ]
        director_item = (
            HorasExtraAprobadorAsignadoItem(
                nombre=directores[0].nombre, email=directores[0].email
            )
            if directores
            else None
        )
        return gerentes_items, director_item

    def _detalle_empleados(
        self, solicitud: HorasExtraSolicitud
    ) -> list[HorasExtraDetalleEmpleadoItem]:
        cc_desc = (
            solicitud.centro_costo.descripcion if solicitud.centro_costo else None
        )
        sub_desc = solicitud.subarea.descripcion if solicitud.subarea else None
        area_desc = solicitud.area.descripcion if solicitud.area else None
        rows: list[HorasExtraDetalleEmpleadoItem] = []
        for det in sorted(solicitud.detalle, key=lambda d: (d.empleado.nombre if d.empleado else "")):
            emp = det.empleado
            if emp is None:
                continue
            rows.append(
                HorasExtraDetalleEmpleadoItem(
                    empleado_id=emp.id,
                    no_empleado=emp.no_empleado,
                    nombre=emp.nombre,
                    puesto_descripcion=emp.puesto.descripcion if emp.puesto else None,
                    departamento_descripcion=emp.area.descripcion if emp.area else area_desc,
                    centrocosto_descripcion=cc_desc,
                    subarea_descripcion=emp.subarea.descripcion if emp.subarea else sub_desc,
                    jefe_nombre=emp.lider.nombre if emp.lider else None,
                    total_horas=round(float(det.total_horas), 2),
                    lunes=float(det.lunes),
                    martes=float(det.martes),
                    miercoles=float(det.miercoles),
                    jueves=float(det.jueves),
                    viernes=float(det.viernes),
                    sabado=float(det.sabado),
                    domingo=float(det.domingo),
                )
            )
        return rows

    async def _mi_firma_pendiente(
        self, solicitud: HorasExtraSolicitud, current_user: Empleado
    ) -> HorasExtraAprobacion | None:
        tipos = await self.repo.tipos_firma_de_empleado(current_user.id)
        if not tipos:
            return None
        return next(
            (
                a
                for a in solicitud.aprobaciones
                if a.tipo_firma in tipos and a.estado == "pendiente"
            ),
            None,
        )

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

        await self.repo.sincronizar_firmas_abiertas()
        await self.db.commit()

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
            empleado_resumen, puesto_desc = self._empleado_resumen(s)
            items.append(
                HorasExtraPendienteItem(
                    solicitud_id=s.id,
                    semana=s.semana_inicio.isocalendar()[1],
                    semana_inicio=s.semana_inicio,
                    fecha_solicitud=s.fecha_solicitud,
                    tipo=s.tipo,
                    area_descripcion=s.area.descripcion if s.area else None,
                    subarea_descripcion=s.subarea.descripcion if s.subarea else None,
                    centrocosto_id=s.centrocosto_id,
                    centrocosto_descripcion=(
                        s.centro_costo.descripcion if s.centro_costo else None
                    ),
                    motivo=s.motivo.descripcion if s.motivo else None,
                    total_horas=self._total_horas(s),
                    total_empleados=len(s.detalle),
                    empleado_resumen=empleado_resumen,
                    puesto_descripcion=puesto_desc,
                    registrado_por_nombre=(
                        s.registrado_por.nombre if s.registrado_por else None
                    ),
                    mi_tipo_firma=mi_firma,
                    mi_tipo_firma_label=TIPO_FIRMA_LABELS.get(mi_firma, mi_firma),
                    estado_consolidado=cons,
                    aprobado_parcial=cons == "aprobado_parcial",
                    created_at=s.created_at,
                )
            )

        return HorasExtraPendientesListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def obtener_detalle_aprobacion(
        self, solicitud_id: int, current_user: Empleado
    ) -> HorasExtraAprobacionDetalleResponse:
        tipos = await self.repo.tipos_firma_de_empleado(current_user.id)
        if not tipos:
            raise ForbiddenError(
                detail="No estás asignado como aprobador de horas extra."
            )

        await self.repo.sincronizar_firmas_abiertas()
        await self.db.commit()

        solicitud = await self._solicitud_o_404(solicitud_id)
        mi_firma = await self._mi_firma_pendiente(solicitud, current_user)
        if mi_firma is None and solicitud.estado == "pendiente":
            raise ForbiddenError(
                detail="No tienes una firma pendiente en esta solicitud."
            )

        await self.repo.registrar_visualizacion(
            usuario_id=current_user.id,
            solicitud_id=solicitud_id,
            rol_nombre=current_user.rol.nombre if current_user.rol else None,
            usuario_nombre=current_user.nombre,
        )
        await self.db.commit()

        cons = estado_consolidado(solicitud.aprobaciones)
        gerentes, director = await self._aprobadores_asignados()
        audit_entries = await self.repo.list_eventos_auditoria(solicitud_id)
        historial = self._build_historial_eventos(solicitud, audit_entries)
        puede_actuar = mi_firma is not None and solicitud.estado == "pendiente"

        return HorasExtraAprobacionDetalleResponse(
            solicitud_id=solicitud.id,
            fecha_solicitud=solicitud.fecha_solicitud,
            semana=solicitud.semana_inicio.isocalendar()[1],
            semana_inicio=solicitud.semana_inicio,
            tipo=solicitud.tipo,
            motivo=solicitud.motivo.descripcion if solicitud.motivo else None,
            comentarios=solicitud.comentarios,
            total_horas=self._total_horas(solicitud),
            total_empleados=len(solicitud.detalle),
            created_at=solicitud.created_at,
            registrado_por_nombre=(
                solicitud.registrado_por.nombre if solicitud.registrado_por else None
            ),
            area_descripcion=solicitud.area.descripcion if solicitud.area else None,
            subarea_descripcion=(
                solicitud.subarea.descripcion if solicitud.subarea else None
            ),
            centrocosto_descripcion=(
                solicitud.centro_costo.descripcion if solicitud.centro_costo else None
            ),
            estado_consolidado=cons,
            estado_label=ESTADO_CONSOLIDADO_LABELS[cons],
            empleados=self._detalle_empleados(solicitud),
            gerentes_regionales=gerentes,
            director_asignado=director,
            firmas=[
                self._firma_response(a)
                for a in self._firmas_ordenadas(solicitud.aprobaciones)
            ],
            historial=historial,
            mi_tipo_firma=mi_firma.tipo_firma if mi_firma else None,
            mi_tipo_firma_label=(
                TIPO_FIRMA_LABELS.get(mi_firma.tipo_firma, mi_firma.tipo_firma)
                if mi_firma
                else None
            ),
            puede_aprobar=puede_actuar,
            puede_rechazar=puede_actuar,
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
        await self._require_visualizacion_previa(solicitud_id, current_user.id)

        firma.estado = "aprobado"
        firma.aprobador_id = current_user.id
        firma.rol_aprobador_id = current_user.rol_id
        firma.rol_aprobador_nombre = (
            current_user.rol.nombre if current_user.rol else None
        )
        firma.fecha_aprobacion = datetime.now(timezone.utc)
        firma.comentario = comentario

        solicitud.estado = calcular_estado(solicitud.aprobaciones)
        await self.repo.registrar_decision_auditoria(
            accion=HE_AUDIT_APPROVED,
            usuario_id=current_user.id,
            solicitud_id=solicitud_id,
            rol_nombre=current_user.rol.nombre if current_user.rol else None,
            usuario_nombre=current_user.nombre,
            comentario=comentario,
            tipo_firma=firma.tipo_firma,
        )
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
        await self._require_visualizacion_previa(solicitud_id, current_user.id)

        firma.estado = "rechazado"
        firma.aprobador_id = current_user.id
        firma.rol_aprobador_id = current_user.rol_id
        firma.rol_aprobador_nombre = (
            current_user.rol.nombre if current_user.rol else None
        )
        firma.fecha_aprobacion = datetime.now(timezone.utc)
        firma.comentario = comentario.strip()

        solicitud.estado = calcular_estado(solicitud.aprobaciones)
        await self.repo.registrar_decision_auditoria(
            accion=HE_AUDIT_REJECTED,
            usuario_id=current_user.id,
            solicitud_id=solicitud_id,
            rol_nombre=current_user.rol.nombre if current_user.rol else None,
            usuario_nombre=current_user.nombre,
            comentario=comentario.strip(),
            tipo_firma=firma.tipo_firma,
        )
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
        audit_entries = await self.repo.list_eventos_auditoria(solicitud_id)
        return HorasExtraHistorialResponse(
            solicitud_id=solicitud.id,
            estado=cons,
            estado_label=ESTADO_CONSOLIDADO_LABELS[cons],
            firmas=[
                self._firma_response(a)
                for a in self._firmas_ordenadas(solicitud.aprobaciones)
            ],
            eventos=self._build_historial_eventos(solicitud, audit_entries),
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


async def sincronizar_firmas_abiertas(db: AsyncSession) -> None:
    """Backfill de firmas faltantes (p. ej. director agregado después de crear solicitudes)."""
    repo = HorasExtraAprobacionRepository(db)
    await repo.sincronizar_firmas_abiertas()


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
