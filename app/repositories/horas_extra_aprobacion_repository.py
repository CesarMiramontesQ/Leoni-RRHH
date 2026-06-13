"""Acceso a datos del ciclo de aprobación de horas extra."""

from __future__ import annotations

from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
        from app.models.roles import Rol

        result = await self.db.execute(
            select(Empleado)
            .join(Rol, Rol.id == Empleado.rol_id)
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

    async def get_solicitud_full(self, solicitud_id: int) -> HorasExtraSolicitud | None:
        result = await self.db.execute(
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.subarea),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.registrado_por),
                selectinload(HorasExtraSolicitud.detalle).selectinload(
                    HorasExtraSolicitudDetalle.empleado
                ),
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

    def _pendientes_base_query(
        self,
        tipos_firma: set[str],
        *,
        q: str | None,
        area_id: int | None,
        centrocosto_id: int | None,
        semana_inicio,
    ):
        stmt = (
            select(HorasExtraSolicitud.id)
            .join(
                HorasExtraAprobacion,
                HorasExtraAprobacion.solicitud_id == HorasExtraSolicitud.id,
            )
            .where(
                HorasExtraAprobacion.tipo_firma.in_(tipos_firma),
                HorasExtraAprobacion.estado == "pendiente",
                HorasExtraSolicitud.estado == "pendiente",
            )
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
                        Empleado.no_empleado.ilike(patron),
                    )
                )
            )
        return stmt

    async def count_pendientes(
        self,
        tipos_firma: set[str],
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        semana_inicio=None,
    ) -> int:
        if not tipos_firma:
            return 0
        base = self._pendientes_base_query(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
        )
        stmt = select(func.count(distinct(base.subquery().c.id)))
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

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
        if not tipos_firma:
            return []
        base = self._pendientes_base_query(
            tipos_firma,
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            semana_inicio=semana_inicio,
        )
        ids_stmt = (
            select(distinct(base.subquery().c.id))
        )
        ids_result = await self.db.execute(ids_stmt)
        ids = [row[0] for row in ids_result.all()]
        if not ids:
            return []

        stmt = (
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.registrado_por),
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
