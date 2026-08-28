"""Acceso a `levelup_dias_festivos`."""

from __future__ import annotations

from datetime import date

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dias_festivos import DiaFestivo
from app.models.solicitudes import Solicitud


class DiasFestivosRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_anio(self, anio: int, *, solo_activos: bool = False) -> list[DiaFestivo]:
        filtros = [DiaFestivo.fecha >= date(anio, 1, 1), DiaFestivo.fecha <= date(anio, 12, 31)]
        if solo_activos:
            filtros.append(DiaFestivo.activo.is_(True))
        result = await self.db.execute(
            select(DiaFestivo)
            .options(selectinload(DiaFestivo.actualizado_por))
            .where(and_(*filtros))
            .order_by(DiaFestivo.fecha)
        )
        return list(result.scalars().all())

    async def get(self, festivo_id: int) -> DiaFestivo | None:
        result = await self.db.execute(
            select(DiaFestivo)
            .options(selectinload(DiaFestivo.actualizado_por))
            .where(DiaFestivo.id == festivo_id)
        )
        return result.scalar_one_or_none()

    async def get_by_fecha(self, fecha: date) -> DiaFestivo | None:
        result = await self.db.execute(
            select(DiaFestivo)
            .options(selectinload(DiaFestivo.actualizado_por))
            .where(DiaFestivo.fecha == fecha)
        )
        return result.scalar_one_or_none()

    async def fechas_activas_en_rango(self, fecha_inicio: date, fecha_fin: date) -> set[date]:
        """Festivos activos con fecha en [fecha_inicio, fecha_fin]."""
        result = await self.db.execute(
            select(DiaFestivo.fecha).where(
                DiaFestivo.activo.is_(True),
                DiaFestivo.fecha >= fecha_inicio,
                DiaFestivo.fecha <= fecha_fin,
            )
        )
        return set(result.scalars().all())

    async def add(self, festivo: DiaFestivo) -> DiaFestivo:
        self.db.add(festivo)
        await self.db.flush()
        await self.db.refresh(festivo, attribute_names=["actualizado_por", "updated_at"])
        return festivo

    async def save(self, festivo: DiaFestivo) -> DiaFestivo:
        await self.db.flush()
        await self.db.refresh(festivo, attribute_names=["actualizado_por", "updated_at"])
        return festivo

    async def count_solicitudes_que_incluyen(
        self, fecha: date, *, tipos: list[str], estados: list[str]
    ) -> int:
        """Solicitudes (de esos tipos y estados) cuyo rango contiene la fecha."""
        result = await self.db.execute(
            select(func.count(Solicitud.id)).where(
                Solicitud.tipo.in_(tipos),
                Solicitud.estado.in_(estados),
                Solicitud.fecha_inicio <= fecha,
                Solicitud.fecha_fin >= fecha,
            )
        )
        return int(result.scalar_one() or 0)
