"""Consultas de empleados con centro de costo para Horas Extra."""

from __future__ import annotations

from sqlalchemy import String, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.empleados import Empleado


class HorasExtraRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self):
        return (
            select(Empleado)
            .options(
                selectinload(Empleado.lider),
                selectinload(Empleado.puesto),
                selectinload(Empleado.subarea),
            )
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                Empleado.centrocosto_id.isnot(None),
            )
        )

    def _apply_filtros(
        self,
        query,
        *,
        q: str | None,
        area_id: int | None,
        centrocosto_id: int | None,
        lider_empleado_id: int | None,
        ids_permitidos: list[int] | None,
    ):
        if ids_permitidos is not None:
            if not ids_permitidos:
                return query.where(Empleado.id == -1)
            query = query.where(Empleado.id.in_(ids_permitidos))
        if area_id is not None:
            query = query.where(Empleado.area_id == area_id)
        if centrocosto_id is not None:
            query = query.where(Empleado.centrocosto_id == centrocosto_id)
        if lider_empleado_id is not None:
            query = query.where(Empleado.lider_id == lider_empleado_id)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Empleado.nombre).like(term),
                    func.lower(Empleado.no_empleado).like(term),
                    func.cast(Empleado.centrocosto_id, String).like(term),
                )
            )
        return query

    async def list_con_centro_costo(
        self,
        *,
        offset: int,
        limit: int,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> list[Empleado]:
        query = self._apply_filtros(
            self._base_query(),
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            lider_empleado_id=lider_empleado_id,
            ids_permitidos=ids_permitidos,
        )
        query = query.order_by(Empleado.nombre.asc(), Empleado.id.asc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_con_centro_costo(
        self,
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> int:
        query = select(func.count()).select_from(Empleado)
        query = query.where(
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            Empleado.centrocosto_id.isnot(None),
        )
        if ids_permitidos is not None:
            if not ids_permitidos:
                return 0
            query = query.where(Empleado.id.in_(ids_permitidos))
        if area_id is not None:
            query = query.where(Empleado.area_id == area_id)
        if centrocosto_id is not None:
            query = query.where(Empleado.centrocosto_id == centrocosto_id)
        if lider_empleado_id is not None:
            query = query.where(Empleado.lider_id == lider_empleado_id)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Empleado.nombre).like(term),
                    func.lower(Empleado.no_empleado).like(term),
                    func.cast(Empleado.centrocosto_id, String).like(term),
                )
            )
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)

    async def list_ids_con_centro_costo(
        self,
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> list[tuple[int, int]]:
        """Pares (id local, empleado_id) para calcular resumen y pestañas."""
        query = select(Empleado.id, Empleado.empleado_id)
        query = query.where(
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            Empleado.centrocosto_id.isnot(None),
        )
        if ids_permitidos is not None:
            if not ids_permitidos:
                return []
            query = query.where(Empleado.id.in_(ids_permitidos))
        if area_id is not None:
            query = query.where(Empleado.area_id == area_id)
        if centrocosto_id is not None:
            query = query.where(Empleado.centrocosto_id == centrocosto_id)
        if lider_empleado_id is not None:
            query = query.where(Empleado.lider_id == lider_empleado_id)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Empleado.nombre).like(term),
                    func.lower(Empleado.no_empleado).like(term),
                    func.cast(Empleado.centrocosto_id, String).like(term),
                )
            )
        result = await self.db.execute(query.order_by(Empleado.nombre.asc(), Empleado.id.asc()))
        return [(int(row[0]), int(row[1])) for row in result.all()]

    async def list_distinct_centrocosto_ids(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> list[int]:
        query = select(Empleado.centrocosto_id).where(
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            Empleado.centrocosto_id.isnot(None),
        )
        if ids_permitidos is not None:
            if not ids_permitidos:
                return []
            query = query.where(Empleado.id.in_(ids_permitidos))
        query = query.distinct().order_by(Empleado.centrocosto_id.asc())
        result = await self.db.execute(query)
        return [int(row[0]) for row in result.all()]

    async def list_by_ids(self, ids: list[int]) -> list[Empleado]:
        if not ids:
            return []
        result = await self.db.execute(
            self._base_query().where(Empleado.id.in_(ids))
        )
        return list(result.scalars().all())

    async def count_empleados_activos_planta(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> int:
        query = select(func.count()).select_from(Empleado).where(
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
        )
        if ids_permitidos is not None:
            if not ids_permitidos:
                return 0
            query = query.where(Empleado.id.in_(ids_permitidos))
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)
