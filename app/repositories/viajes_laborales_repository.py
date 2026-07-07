from datetime import date

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.viajes_laborales import ViajeLaboral
from app.repositories.base import BaseRepository


class ViajesLaboralesRepository(BaseRepository[ViajeLaboral]):
    def __init__(self, db: AsyncSession):
        super().__init__(ViajeLaboral, db)

    def _base_query(self) -> Select:
        return select(ViajeLaboral).options(
            selectinload(ViajeLaboral.empleado),
            selectinload(ViajeLaboral.registrado_por),
            selectinload(ViajeLaboral.aprobado_por),
        )

    def _apply_filters(
        self,
        query: Select,
        *,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> Select:
        if empleado_ids_scope is not None:
            query = query.where(ViajeLaboral.empleado_id.in_(empleado_ids_scope))
        if empleado_id is not None:
            query = query.where(ViajeLaboral.empleado_id == empleado_id)
        if fecha_inicio is not None:
            query = query.where(ViajeLaboral.fecha_salida >= fecha_inicio)
        if fecha_fin is not None:
            query = query.where(ViajeLaboral.fecha_salida <= fecha_fin)
        if destino:
            term = f"%{destino.strip()}%"
            query = query.where(ViajeLaboral.lugar_destino.ilike(term))
        if estado:
            query = query.where(ViajeLaboral.estado == estado)
        if busqueda:
            term = f"%{busqueda.strip()}%"
            query = query.join(
                Empleado, Empleado.empleado_id == ViajeLaboral.empleado_id
            ).where(
                or_(
                    Empleado.nombre.ilike(term),
                    cast(Empleado.no_empleado, String).ilike(term),
                )
            )
        return query

    async def get_with_relations(self, viaje_id: int) -> ViajeLaboral | None:
        result = await self.db.execute(
            self._base_query().where(ViajeLaboral.id == viaje_id)
        )
        return result.scalar_one_or_none()

    async def list_page(
        self,
        *,
        page: int,
        page_size: int,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> tuple[list[ViajeLaboral], int]:
        filters = {
            "empleado_id": empleado_id,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "destino": destino,
            "estado": estado,
            "busqueda": busqueda,
            "empleado_ids_scope": empleado_ids_scope,
        }
        filters_applied = self._apply_filters(self._base_query(), **filters)

        count_q = select(func.count(func.distinct(ViajeLaboral.id))).select_from(
            ViajeLaboral
        )
        count_q = self._apply_filters(count_q, **filters)
        total = int((await self.db.execute(count_q)).scalar_one())

        offset = (page - 1) * page_size
        items_q = (
            filters_applied.order_by(
                ViajeLaboral.fecha_salida.desc(),
                ViajeLaboral.id.desc(),
            )
            .offset(offset)
            .limit(page_size)
        )
        result = await self.db.execute(items_q)
        return list(result.scalars().unique().all()), total

    async def count_by_estado(
        self,
        *,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> dict[str, int]:
        filters = {
            "empleado_id": empleado_id,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "destino": destino,
            "estado": estado,
            "busqueda": busqueda,
            "empleado_ids_scope": empleado_ids_scope,
        }
        q = select(ViajeLaboral.estado, func.count(ViajeLaboral.id)).group_by(
            ViajeLaboral.estado
        )
        q = self._apply_filters(q, **filters)
        result = await self.db.execute(q)
        return {row[0]: int(row[1]) for row in result.all()}
