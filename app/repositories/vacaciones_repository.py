from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainValidationError, NotFoundError
from app.models.vacaciones import Vacaciones
from app.repositories.base import BaseRepository


class VacacionesRepository(BaseRepository[Vacaciones]):
    def __init__(self, db: AsyncSession):
        super().__init__(Vacaciones, db)

    async def get_by_empleado_id(self, empleado_id: int) -> Vacaciones | None:
        result = await self.db.execute(
            select(Vacaciones).where(Vacaciones.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, empleado_id: int) -> Vacaciones:
        row = await self.get_by_empleado_id(empleado_id)
        if row is not None:
            return row
        return await self.create({"empleado_id": empleado_id, "dias_disponibles": 0})

    async def get_dias_disponibles(self, empleado_id: int) -> int:
        row = await self.get_by_empleado_id(empleado_id)
        return row.dias_disponibles if row is not None else 0

    async def establecer(self, empleado_id: int, dias_disponibles: int) -> Vacaciones:
        if dias_disponibles < 0:
            raise DomainValidationError(detail="Los días disponibles no pueden ser negativos.")
        row = await self.get_by_empleado_id(empleado_id)
        if row is None:
            return await self.create(
                {"empleado_id": empleado_id, "dias_disponibles": dias_disponibles}
            )
        row.dias_disponibles = dias_disponibles
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def debitar(self, empleado_id: int, dias: int) -> Vacaciones:
        if dias <= 0:
            raise DomainValidationError(detail="La cantidad de días a rebajar debe ser mayor a cero.")
        row = await self.get_or_create(empleado_id)
        if dias > row.dias_disponibles:
            raise DomainValidationError(
                detail=(
                    f"Saldo insuficiente: hay {row.dias_disponibles} día(s) disponible(s) "
                    f"y se solicitan {dias}."
                )
            )
        row.dias_disponibles -= dias
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def acreditar(self, empleado_id: int, dias: int) -> Vacaciones:
        if dias <= 0:
            return await self.get_or_create(empleado_id)
        row = await self.get_or_create(empleado_id)
        row.dias_disponibles += dias
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def ensure_empleado_exists(self, empleado_id: int) -> None:
        from app.models.empleados import Empleado

        result = await self.db.execute(select(Empleado.id).where(Empleado.id == empleado_id))
        if result.scalar_one_or_none() is None:
            raise NotFoundError(entidad="Empleado", id=empleado_id)
