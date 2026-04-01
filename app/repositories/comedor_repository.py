# app/repositories/comedor_repository.py
"""
Repositorio de Comedor: menus semanales, registros de seleccion y validacion de huella.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comedor import Comedor, ComedorRegistro, MenuSemanal
from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class ComedorRepository(BaseRepository[Comedor]):
    def __init__(self, db: AsyncSession):
        super().__init__(Comedor, db)

    async def get_activos(self) -> list[Comedor]:
        result = await self.db.execute(
            select(Comedor).where(Comedor.activo == True)  # noqa: E712
        )
        return list(result.scalars().all())


class MenuSemanalRepository(BaseRepository[MenuSemanal]):
    def __init__(self, db: AsyncSession):
        super().__init__(MenuSemanal, db)

    async def get_menu_semana(
        self,
        comedor_id: int,
        semana: date,
    ) -> list[MenuSemanal]:
        result = await self.db.execute(
            select(MenuSemanal)
            .where(
                MenuSemanal.comedor_id == comedor_id,
                MenuSemanal.semana == semana,
            )
            .order_by(MenuSemanal.dia)
        )
        return list(result.scalars().all())

    async def get_menu_semana_todos(self, semana: date) -> list[MenuSemanal]:
        """Retorna todos los menus de todos los comedores para una semana."""
        result = await self.db.execute(
            select(MenuSemanal)
            .options(selectinload(MenuSemanal.comedor))
            .where(MenuSemanal.semana == semana)
            .order_by(MenuSemanal.comedor_id, MenuSemanal.dia)
        )
        return list(result.scalars().all())


class ComedorRegistroRepository(BaseRepository[ComedorRegistro]):
    def __init__(self, db: AsyncSession):
        super().__init__(ComedorRegistro, db)

    async def get_registro_semana(
        self,
        empleado_id: int,
        semana: date,
    ) -> ComedorRegistro | None:
        result = await self.db.execute(
            select(ComedorRegistro)
            .where(
                ComedorRegistro.empleado_id == empleado_id,
                ComedorRegistro.semana == semana,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_huella(self, num_empleado: str) -> Empleado | None:
        """
        Stub: busca empleado por num_empleado.
        En produccion el campo de huella biometrica se mapearia directamente.
        """
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(
                Empleado.num_empleado == num_empleado,
                Empleado.activo == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def get_registros_semana(self, semana: date) -> list[ComedorRegistro]:
        result = await self.db.execute(
            select(ComedorRegistro)
            .options(
                selectinload(ComedorRegistro.empleado),
                selectinload(ComedorRegistro.comedor),
            )
            .where(ComedorRegistro.semana == semana)
        )
        return list(result.scalars().all())

    async def get_registros_semanas_recientes(self, n: int = 4) -> list[ComedorRegistro]:
        """Retorna todos los registros de las ultimas n semanas para proyecciones."""
        from sqlalchemy import desc, func
        subquery = (
            select(ComedorRegistro.semana)
            .distinct()
            .order_by(desc(ComedorRegistro.semana))
            .limit(n)
            .subquery()
        )
        result = await self.db.execute(
            select(ComedorRegistro)
            .options(
                selectinload(ComedorRegistro.empleado),
                selectinload(ComedorRegistro.comedor),
            )
            .where(ComedorRegistro.semana.in_(select(subquery)))
        )
        return list(result.scalars().all())
