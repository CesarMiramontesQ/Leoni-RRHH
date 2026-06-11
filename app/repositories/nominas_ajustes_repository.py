"""Acceso a datos para Ajustes de Nóminas (autorización de horas extra)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado


class NominasAjustesRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
    ):
        stmt = select(Empleado).where(Empleado.estado_id.in_(estados_activos))
        if q:
            patron = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Empleado.nombre.ilike(patron),
                    Empleado.no_empleado.ilike(patron),
                )
            )
        if autorizado is not None:
            stmt = stmt.where(Empleado.puede_registrar_horas_extra.is_(autorizado))
        return stmt

    async def list_empleados(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
        offset: int = 0,
        limit: int = 10,
    ) -> list[Empleado]:
        stmt = (
            self._base_query(estados_activos, q=q, autorizado=autorizado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.area),
                selectinload(Empleado.puesto),
            )
            .order_by(Empleado.nombre, Empleado.id)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_empleados(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(
            self._base_query(estados_activos, q=q, autorizado=autorizado).subquery()
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def count_autorizados(self, estados_activos: list[int]) -> int:
        return await self.count_empleados(estados_activos, autorizado=True)

    async def get_activos_by_ids(
        self, estados_activos: list[int], ids: list[int]
    ) -> list[Empleado]:
        if not ids:
            return []
        stmt = select(Empleado).where(
            Empleado.id.in_(ids), Empleado.estado_id.in_(estados_activos)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def set_autorizacion(self, empleados: list[Empleado], autorizado: bool) -> int:
        actualizados = 0
        for emp in empleados:
            if emp.puede_registrar_horas_extra != autorizado:
                emp.puede_registrar_horas_extra = autorizado
                actualizados += 1
        if actualizados:
            await self.db.flush()
        return actualizados
