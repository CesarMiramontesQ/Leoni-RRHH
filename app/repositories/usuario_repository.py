from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.models.catalogos import Area, Puesto
from app.repositories.base import BaseRepository

ModoEstadoListado = Literal["todos", "activos", "inactivos"]


class UsuarioRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.estado),
                selectinload(Empleado.area),
                selectinload(Empleado.puesto),
                selectinload(Empleado.subarea),
                selectinload(Empleado.categoria),
                selectinload(Empleado.clasificacion),
            )
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _estado_condition(
        modo_estado: ModoEstadoListado,
        estados_activos: list[int],
    ):
        if modo_estado == "todos":
            return None
        if not estados_activos:
            return None
        if modo_estado == "activos":
            return Empleado.estado_id.in_(estados_activos)
        return or_(
            Empleado.estado_id.is_(None),
            ~Empleado.estado_id.in_(estados_activos),
        )

    @staticmethod
    def _list_filters(
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        modo_estado: ModoEstadoListado,
        estados_activos: list[int],
    ) -> list:
        conditions: list = []
        est = UsuarioRepository._estado_condition(modo_estado, estados_activos)
        if est is not None:
            conditions.append(est)
        if area_id is not None:
            conditions.append(Empleado.area_id == area_id)
        if puesto_id is not None:
            conditions.append(Empleado.puesto_id == puesto_id)
        if q and q.strip():
            term = f"%{q.strip()}%"
            conditions.append(
                or_(
                    Empleado.nombre.ilike(term),
                    Empleado.no_empleado.ilike(term),
                    Empleado.email.ilike(term),
                )
            )
        return conditions

    async def list_page(
        self,
        offset: int,
        limit: int,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        modo_estado: ModoEstadoListado = "todos",
        estados_activos: list[int] | None = None,
    ) -> list[Empleado]:
        ea = estados_activos or []
        conditions = self._list_filters(q, area_id, puesto_id, modo_estado, ea)
        query = select(Empleado).options(
            selectinload(Empleado.rol),
            selectinload(Empleado.lider),
            selectinload(Empleado.estado),
            selectinload(Empleado.area),
            selectinload(Empleado.puesto),
            selectinload(Empleado.subarea),
            selectinload(Empleado.categoria),
            selectinload(Empleado.clasificacion),
        )
        for cond in conditions:
            query = query.where(cond)
        query = query.order_by(Empleado.id).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        modo_estado: ModoEstadoListado = "todos",
        estados_activos: list[int] | None = None,
    ) -> int:
        ea = estados_activos or []
        conditions = self._list_filters(q, area_id, puesto_id, modo_estado, ea)
        query = select(func.count()).select_from(Empleado)
        for cond in conditions:
            query = query.where(cond)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_subordinados(self, lider_id: int, estados_activos: list[int]) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(
                Empleado.lider_id == lider_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())

    async def list_areas_activas(self) -> list[Area]:
        result = await self.db.execute(
            select(Area).where(Area.estatus_id == 1).order_by(Area.descripcion)
        )
        return list(result.scalars().all())

    async def list_puestos_activos(self) -> list[Puesto]:
        result = await self.db.execute(
            select(Puesto).where(Puesto.estatus_id == 1).order_by(Puesto.descripcion)
        )
        return list(result.scalars().all())

    async def count_activos(self, estados_activos: list[int]) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(Empleado.estado_id.in_(estados_activos))
        )
        return result.scalar_one()

    async def count_inactivos(self, estados_activos: list[int]) -> int:
        if not estados_activos:
            return 0
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(
                or_(
                    Empleado.estado_id.is_(None),
                    ~Empleado.estado_id.in_(estados_activos),
                )
            )
        )
        return result.scalar_one()
