"""Acceso a datos del ciclo de aprobación de horas extra."""

from __future__ import annotations
from sqlalchemy import String, cast

from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auditoria import AuditLog
from app.models.empleados import Empleado
from app.models.horas_extra import (
    HorasExtraAprobacion,
    HorasExtraAprobador,
    HorasExtraSolicitud,
    HorasExtraSolicitudDetalle,
)

# Mapeo entre el tipo de aprobador configurado y el tipo de firma de la solicitud.
APROBADOR_TIPO_A_FIRMA: dict[str, str] = {
    "gerente_regional": "gerente_regional",
    "director": "director_planta",
}

HE_AUDIT_MODULO = "horas_extra"
HE_AUDIT_VIEWED = "HE_SOLICITUD_VIEWED"
HE_AUDIT_APPROVED = "HE_SOLICITUD_APPROVED"
HE_AUDIT_REJECTED = "HE_SOLICITUD_REJECTED"


class HorasExtraAprobacionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Configuración de aprobadores ──

    async def tipos_firma_para_seed(self) -> set[str]:
        """Tipos de firma a generar según los aprobadores activos configurados."""
        result = await self.db.execute(
            select(distinct(HorasExtraAprobador.tipo)).where(
                HorasExtraAprobador.activo.is_(True),
                HorasExtraAprobador.tipo.in_(["gerente_regional", "director"]),
            )
        )
        tipos = {row[0] for row in result.all()}
        return {APROBADOR_TIPO_A_FIRMA[t] for t in tipos if t in APROBADOR_TIPO_A_FIRMA}

    async def tipos_firma_de_empleado(self, empleado_id: int) -> set[str]:
        """Tipos de firma que un empleado puede firmar (según su designación activa)."""
        result = await self.db.execute(
            select(distinct(HorasExtraAprobador.tipo)).where(
                HorasExtraAprobador.empleado_id == empleado_id,
                HorasExtraAprobador.activo.is_(True),
                HorasExtraAprobador.tipo.in_(["gerente_regional", "director"]),
            )
        )
        tipos = {row[0] for row in result.all()}
        return {APROBADOR_TIPO_A_FIRMA[t] for t in tipos if t in APROBADOR_TIPO_A_FIRMA}

    async def empleados_aprobadores_por_tipo(self, tipo: str) -> list[Empleado]:
        """Empleados activos designados como aprobadores del tipo dado."""
        result = await self.db.execute(
            select(Empleado)
            .join(
                HorasExtraAprobador,
                HorasExtraAprobador.empleado_id == Empleado.id,
            )
            .where(
                HorasExtraAprobador.tipo == tipo,
                HorasExtraAprobador.activo.is_(True),
            )
        )
        return list(result.scalars().unique().all())

    async def empleados_por_rol(self, rol_nombre: str) -> list[Empleado]:
        from app.models.empleados_rh import EmpleadoCore
        from app.models.roles import Rol

        result = await self.db.execute(
            select(Empleado)
            .join(EmpleadoCore, EmpleadoCore.empleado_id == Empleado.empleado_id)
            .join(Rol, Rol.id == EmpleadoCore.rol_id)
            .where(Rol.nombre == rol_nombre)
        )
        return list(result.scalars().unique().all())

    # ── Firmas (horas_extra_aprobaciones) ──

    async def crear_firmas_pendientes(
        self, solicitud_id: int, tipos_firma: set[str]
    ) -> list[HorasExtraAprobacion]:
        if not tipos_firma:
            return []
        result = await self.db.execute(
            select(HorasExtraAprobacion.tipo_firma).where(
                HorasExtraAprobacion.solicitud_id == solicitud_id,
                HorasExtraAprobacion.tipo_firma.in_(tipos_firma),
            )
        )
        existentes = {row[0] for row in result.all()}
        pendientes = sorted(tipos_firma - existentes)
        nuevas = [
            HorasExtraAprobacion(
                solicitud_id=solicitud_id,
                tipo_firma=tipo_firma,
                estado="pendiente",
            )
            for tipo_firma in pendientes
        ]
        if nuevas:
            self.db.add_all(nuevas)
            await self.db.flush()
        return nuevas

    async def list_solicitudes_abiertas_ids(self) -> list[int]:
        """Solicitudes aún en flujo de aprobación (no aprobadas ni rechazadas)."""
        result = await self.db.execute(
            select(HorasExtraSolicitud.id).where(
                HorasExtraSolicitud.estado == "pendiente"
            )
        )
        return [row[0] for row in result.all()]

    async def sincronizar_firmas_abiertas(self) -> None:
        """Crea firmas faltantes en solicitudes abiertas según aprobadores activos."""
        tipos = await self.tipos_firma_para_seed()
        if not tipos:
            return
        for solicitud_id in await self.list_solicitudes_abiertas_ids():
            await self.crear_firmas_pendientes(solicitud_id, tipos)

    async def get_solicitud_full(self, solicitud_id: int) -> HorasExtraSolicitud | None:
        detalle_empleado = selectinload(HorasExtraSolicitud.detalle).selectinload(
            HorasExtraSolicitudDetalle.empleado
        )
        result = await self.db.execute(
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.subarea),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.registrado_por),
                detalle_empleado.selectinload(Empleado.puesto),
                detalle_empleado.selectinload(Empleado.area),
                detalle_empleado.selectinload(Empleado.subarea),
                detalle_empleado.selectinload(Empleado.lider),
                selectinload(HorasExtraSolicitud.aprobaciones).selectinload(
                    HorasExtraAprobacion.aprobador
                ),
                selectinload(HorasExtraSolicitud.aprobaciones).selectinload(
                    HorasExtraAprobacion.rol_aprobador
                ),
            )
            .where(HorasExtraSolicitud.id == solicitud_id)
        )
        return result.scalar_one_or_none()

    def _asignadas_base_query(
        self,
        tipos_firma: set[str],
        *,
        q: str | None,
        area_id: int | None,
        centrocosto_id: int | None,
        semana_inicio,
        solo_accion_pendiente: bool = False,
    ):
        stmt = (
            select(HorasExtraSolicitud.id)
            .join(
                HorasExtraAprobacion,
                HorasExtraAprobacion.solicitud_id == HorasExtraSolicitud.id,
            )
            .where(HorasExtraAprobacion.tipo_firma.in_(tipos_firma))
        )
        if solo_accion_pendiente:
            stmt = stmt.where(
                HorasExtraAprobacion.estado == "pendiente",
                HorasExtraSolicitud.estado == "pendiente",
            )
        if area_id is not None:
            stmt = stmt.where(HorasExtraSolicitud.area_id == area_id)
        if centrocosto_id is not None:
            stmt = stmt.where(HorasExtraSolicitud.centrocosto_id == centrocosto_id)
        if semana_inicio is not None:
            stmt = stmt.where(HorasExtraSolicitud.semana_inicio == semana_inicio)
        if q:
            patron = f"%{q.strip()}%"
            stmt = (
                stmt.join(
                    HorasExtraSolicitudDetalle,
                    HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
                )
                .join(
                    Empleado,
                    Empleado.id == HorasExtraSolicitudDetalle.empleado_id,
                )
                .where(
                    or_(
                        Empleado.nombre.ilike(patron),
                        cast(Empleado.no_empleado, String).ilike(patron),
                    )
                )
            )
        return stmt

    def _pendientes_base_query(
        self,
        tipos_firma: set[str],
        *,
        q: str | None,
        area_id: int | None,
        centrocosto_id: int | None,
        semana_inicio,
    ):
        return self._asignadas_base_query(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            solo_accion_pendiente=True,
        )

    async def count_asignadas(
        self,
        tipos_firma: set[str],
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
        solo_accion_pendiente: bool = False,
    ) -> int:
        if not tipos_firma:
            return 0
        base = self._asignadas_base_query(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            solo_accion_pendiente=solo_accion_pendiente,
        )
        stmt = select(func.count(distinct(base.subquery().c.id)))
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def count_pendientes(
        self,
        tipos_firma: set[str],
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
    ) -> int:
        return await self.count_asignadas(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            solo_accion_pendiente=True,
        )

    async def list_asignadas(
        self,
        tipos_firma: set[str],
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
        offset: int = 0,
        limit: int = 12,
        solo_accion_pendiente: bool = False,
    ) -> list[HorasExtraSolicitud]:
        if not tipos_firma:
            return []
        base = self._asignadas_base_query(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            solo_accion_pendiente=solo_accion_pendiente,
        )
        ids_stmt = select(distinct(base.subquery().c.id))
        ids_result = await self.db.execute(ids_stmt)
        ids = [row[0] for row in ids_result.all()]
        if not ids:
            return []

        stmt = (
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.subarea),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.registrado_por),
                selectinload(HorasExtraSolicitud.detalle).selectinload(
                    HorasExtraSolicitudDetalle.empleado
                ).selectinload(Empleado.puesto),
                selectinload(HorasExtraSolicitud.detalle),
                selectinload(HorasExtraSolicitud.aprobaciones),
            )
            .where(HorasExtraSolicitud.id.in_(ids))
            .order_by(
                HorasExtraSolicitud.created_at.desc(),
                HorasExtraSolicitud.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_pendientes(
        self,
        tipos_firma: set[str],
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
        offset: int = 0,
        limit: int = 12,
    ) -> list[HorasExtraSolicitud]:
        return await self.list_asignadas(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
            offset=offset,
            limit=limit,
            solo_accion_pendiente=True,
        )

    async def usuario_visualizo_solicitud(
        self, usuario_id: int, solicitud_id: int
    ) -> bool:
        stmt = (
            select(func.count())
            .select_from(AuditLog)
            .where(
                AuditLog.modulo == HE_AUDIT_MODULO,
                AuditLog.accion == HE_AUDIT_VIEWED,
                AuditLog.entidad_id == solicitud_id,
                AuditLog.usuario_id == usuario_id,
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0) > 0

    async def registrar_visualizacion(
        self,
        *,
        usuario_id: int,
        solicitud_id: int,
        rol_nombre: str | None,
        usuario_nombre: str,
        tipo_firma: str | None = None,
    ) -> None:
        datos: dict[str, object] = {
            "rol": rol_nombre,
            "usuario_nombre": usuario_nombre,
            "solicitud_id": solicitud_id,
        }
        if tipo_firma:
            datos["tipo_firma"] = tipo_firma
        entry = AuditLog(
            usuario_id=usuario_id,
            accion=HE_AUDIT_VIEWED,
            modulo=HE_AUDIT_MODULO,
            entidad_id=solicitud_id,
            datos_despues=datos,
        )
        self.db.add(entry)
        await self.db.flush()

    async def registrar_decision_auditoria(
        self,
        *,
        accion: str,
        usuario_id: int,
        solicitud_id: int,
        rol_nombre: str | None,
        usuario_nombre: str,
        comentario: str | None,
        tipo_firma: str,
    ) -> None:
        entry = AuditLog(
            usuario_id=usuario_id,
            accion=accion,
            modulo=HE_AUDIT_MODULO,
            entidad_id=solicitud_id,
            datos_despues={
                "rol": rol_nombre,
                "usuario_nombre": usuario_nombre,
                "tipo_firma": tipo_firma,
                "comentario": comentario,
            },
        )
        self.db.add(entry)
        await self.db.flush()

    async def list_eventos_auditoria(self, solicitud_id: int) -> list[AuditLog]:
        stmt = (
            select(AuditLog)
            .options(selectinload(AuditLog.usuario).selectinload(Empleado.core))
            .where(
                AuditLog.modulo == HE_AUDIT_MODULO,
                AuditLog.entidad_id == solicitud_id,
                AuditLog.accion.in_(
                    [
                        HE_AUDIT_VIEWED,
                        HE_AUDIT_APPROVED,
                        HE_AUDIT_REJECTED,
                    ]
                ),
            )
            .order_by(AuditLog.timestamp.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
