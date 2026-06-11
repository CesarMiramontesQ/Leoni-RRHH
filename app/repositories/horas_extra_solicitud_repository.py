"""Acceso a datos de solicitudes de horas extra."""

from __future__ import annotations

import uuid

from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area, Subarea
from app.models.empleados import Empleado
from app.models.horas_extra import (
    CentroCosto,
    HorasExtraMotivo,
    HorasExtraSolicitud,
    HorasExtraSolicitudDetalle,
)


class HorasExtraSolicitudRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_areas_activas(self) -> list[Area]:
        result = await self.db.execute(
            select(Area).order_by(Area.descripcion.asc())
        )
        return list(result.scalars().all())

    async def list_subareas_activas(self) -> list[Subarea]:
        result = await self.db.execute(
            select(Subarea).order_by(Subarea.descripcion.asc())
        )
        return list(result.scalars().all())

    async def list_centros_costo_activos(self) -> list[CentroCosto]:
        result = await self.db.execute(
            select(CentroCosto)
            .where(CentroCosto.activo.is_(True))
            .order_by(CentroCosto.descripcion.asc())
        )
        return list(result.scalars().all())

    async def list_motivos_activos(self) -> list[HorasExtraMotivo]:
        result = await self.db.execute(
            select(HorasExtraMotivo)
            .where(HorasExtraMotivo.activo.is_(True))
            .order_by(HorasExtraMotivo.descripcion.asc())
        )
        return list(result.scalars().all())

    async def get_empleados_by_ids(self, ids: list[int]) -> list[Empleado]:
        if not ids:
            return []
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.clasificacion),
                selectinload(Empleado.area),
                selectinload(Empleado.subarea),
                selectinload(Empleado.turno_empleado),
            )
            .where(Empleado.id.in_(ids))
        )
        return list(result.scalars().all())

    async def get_or_create_motivo_texto(self, texto: str) -> HorasExtraMotivo:
        result = await self.db.execute(
            select(HorasExtraMotivo).where(HorasExtraMotivo.descripcion == texto)
        )
        motivo = result.scalar_one_or_none()
        if motivo is not None:
            return motivo
        codigo = f"LIBRE-{uuid.uuid4().hex[:8].upper()}"
        motivo = HorasExtraMotivo(codigo=codigo, descripcion=texto, activo=True)
        self.db.add(motivo)
        await self.db.flush()
        return motivo

    async def get_area(self, area_id: int) -> Area | None:
        return await self.db.get(Area, area_id)

    async def get_subarea(self, subarea_id: int) -> Subarea | None:
        return await self.db.get(Subarea, subarea_id)

    async def get_centro_costo(self, centrocosto_id: int) -> CentroCosto | None:
        return await self.db.get(CentroCosto, centrocosto_id)

    async def get_or_create_centro_costo(self, centrocosto_id: int) -> CentroCosto:
        centro = await self.get_centro_costo(centrocosto_id)
        if centro is not None:
            return centro
        centro = CentroCosto(
            centrocosto_id=centrocosto_id,
            codigo=f"CC-{centrocosto_id}",
            descripcion=f"Centro de costo {centrocosto_id}",
            activo=True,
        )
        self.db.add(centro)
        await self.db.flush()
        return centro

    async def get_centros_costo_map(self, ids: set[int]) -> dict[int, str]:
        if not ids:
            return {}
        result = await self.db.execute(
            select(CentroCosto).where(CentroCosto.centrocosto_id.in_(ids))
        )
        return {c.centrocosto_id: c.descripcion for c in result.scalars()}

    async def get_motivo(self, motivo_id: int) -> HorasExtraMotivo | None:
        return await self.db.get(HorasExtraMotivo, motivo_id)

    async def create(
        self,
        solicitud: HorasExtraSolicitud,
        detalle: list[HorasExtraSolicitudDetalle],
    ) -> HorasExtraSolicitud:
        self.db.add(solicitud)
        await self.db.flush()
        for row in detalle:
            row.solicitud_id = solicitud.id
            self.db.add(row)
        await self.db.flush()
        return await self.get_by_id(solicitud.id, registrado_por_id=solicitud.registrado_por_id)

    async def get_by_id(
        self,
        solicitud_id: int,
        *,
        registrado_por_id: int,
    ) -> HorasExtraSolicitud | None:
        result = await self.db.execute(
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.subarea),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.detalle).selectinload(
                    HorasExtraSolicitudDetalle.empleado
                ),
            )
            .where(
                HorasExtraSolicitud.id == solicitud_id,
                HorasExtraSolicitud.registrado_por_id == registrado_por_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_solicitud_by_id(self, solicitud_id: int) -> HorasExtraSolicitud | None:
        result = await self.db.execute(
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.subarea),
                selectinload(HorasExtraSolicitud.centro_costo),
                selectinload(HorasExtraSolicitud.motivo),
                selectinload(HorasExtraSolicitud.detalle).selectinload(
                    HorasExtraSolicitudDetalle.empleado
                ),
            )
            .where(HorasExtraSolicitud.id == solicitud_id)
        )
        return result.scalar_one_or_none()

    async def list_by_registrado(
        self,
        *,
        registrado_por_id: int,
        offset: int,
        limit: int,
    ) -> list[HorasExtraSolicitud]:
        result = await self.db.execute(
            select(HorasExtraSolicitud)
            .options(
                selectinload(HorasExtraSolicitud.area),
                selectinload(HorasExtraSolicitud.detalle),
            )
            .where(HorasExtraSolicitud.registrado_por_id == registrado_por_id)
            .order_by(HorasExtraSolicitud.created_at.desc(), HorasExtraSolicitud.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_registrado(self, *, registrado_por_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(HorasExtraSolicitud)
            .where(HorasExtraSolicitud.registrado_por_id == registrado_por_id)
        )
        return int(result.scalar_one() or 0)

    async def estadisticas_por_registrado(
        self,
        *,
        registrado_por_id: int,
    ) -> tuple[int, int, int, Decimal]:
        stats_result = await self.db.execute(
            select(
                func.count().label("total"),
                func.coalesce(
                    func.sum(
                        case((HorasExtraSolicitud.estado == "pendiente", 1), else_=0)
                    ),
                    0,
                ).label("pendientes"),
                func.coalesce(
                    func.sum(
                        case((HorasExtraSolicitud.estado == "aprobado", 1), else_=0)
                    ),
                    0,
                ).label("aprobadas"),
            ).where(HorasExtraSolicitud.registrado_por_id == registrado_por_id)
        )
        stats = stats_result.one()

        horas_result = await self.db.execute(
            select(func.coalesce(func.sum(HorasExtraSolicitudDetalle.total_horas), 0))
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitud.id == HorasExtraSolicitudDetalle.solicitud_id,
            )
            .where(HorasExtraSolicitud.registrado_por_id == registrado_por_id)
        )
        total_horas = horas_result.scalar_one() or Decimal("0")

        return (
            int(stats.total or 0),
            int(stats.pendientes or 0),
            int(stats.aprobadas or 0),
            Decimal(str(total_horas)),
        )
