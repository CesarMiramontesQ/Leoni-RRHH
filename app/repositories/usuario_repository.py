# app/repositories/usuario_repository.py
"""
Repositorio de Empleados/Usuarios.
Extiende EmpleadoRepository con queries adicionales para el modulo usuarios.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class UsuarioRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_by_email(self, email: str) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_num_empleado(self, num: str) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.num_empleado == num)
        )
        return result.scalar_one_or_none()

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def list_activos(
        self,
        cursor: int | None,
        limit: int,
        filtros: dict | None = None,
    ) -> tuple[list[Empleado], int | None]:
        conditions = [Empleado.activo == True]  # noqa: E712

        if filtros:
            if filtros.get("departamento"):
                conditions.append(Empleado.departamento == filtros["departamento"])
            if filtros.get("puesto"):
                conditions.append(Empleado.puesto == filtros["puesto"])
            if filtros.get("rol_id"):
                conditions.append(Empleado.rol_id == filtros["rol_id"])

        query = select(Empleado).options(selectinload(Empleado.rol))
        for cond in conditions:
            query = query.where(cond)

        if cursor is not None:
            query = query.where(Empleado.id > cursor)

        query = query.order_by(Empleado.id).limit(limit + 1)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].id

        return items, next_cursor

    @staticmethod
    def _list_filters(
        q: str | None,
        departamento: str | None,
        puesto: str | None,
        activo: bool | None,
    ) -> list:
        conditions: list = []
        if activo is not None:
            conditions.append(Empleado.activo == activo)
        if departamento:
            conditions.append(Empleado.departamento == departamento)
        if puesto:
            conditions.append(Empleado.puesto == puesto)
        if q and q.strip():
            term = f"%{q.strip()}%"
            conditions.append(
                or_(
                    Empleado.nombre.ilike(term),
                    Empleado.apellido.ilike(term),
                    Empleado.email.ilike(term),
                    Empleado.num_empleado.ilike(term),
                )
            )
        return conditions

    async def list_page(
        self,
        offset: int,
        limit: int,
        q: str | None,
        departamento: str | None,
        puesto: str | None,
        activo: bool | None,
    ) -> list[Empleado]:
        conditions = self._list_filters(q, departamento, puesto, activo)
        query = select(Empleado).options(
            selectinload(Empleado.rol),
            selectinload(Empleado.supervisor),
        )
        for cond in conditions:
            query = query.where(cond)
        query = query.order_by(Empleado.id).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        q: str | None,
        departamento: str | None,
        puesto: str | None,
        activo: bool | None,
    ) -> int:
        conditions = self._list_filters(q, departamento, puesto, activo)
        query = select(func.count()).select_from(Empleado)
        for cond in conditions:
            query = query.where(cond)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def distinct_departamentos(self, solo_activos: bool = False) -> list[str]:
        conds = [
            Empleado.departamento.isnot(None),
            Empleado.departamento != "",
        ]
        if solo_activos:
            conds.append(Empleado.activo == True)  # noqa: E712
        result = await self.db.execute(
            select(Empleado.departamento)
            .where(*conds)
            .distinct()
            .order_by(Empleado.departamento)
        )
        return [row[0] for row in result.all() if row[0]]

    async def distinct_puestos(self, solo_activos: bool = False) -> list[str]:
        conds = [
            Empleado.puesto.isnot(None),
            Empleado.puesto != "",
        ]
        if solo_activos:
            conds.append(Empleado.activo == True)  # noqa: E712
        result = await self.db.execute(
            select(Empleado.puesto)
            .where(*conds)
            .distinct()
            .order_by(Empleado.puesto)
        )
        return [row[0] for row in result.all() if row[0]]

    async def get_subordinados(self, supervisor_id: int) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.supervisor_id == supervisor_id, Empleado.activo == True)  # noqa: E712
        )
        return list(result.scalars().all())
