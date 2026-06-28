from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainValidationError, NotFoundError
from app.models.vacaciones_disponibles import VacacionesDisponibles
from app.repositories.base import BaseRepository


class VacacionesRepository(BaseRepository[VacacionesDisponibles]):
    """Saldo de vacaciones en ``levelup_vacaciones_disponibles`` (por ``no_empleado``)."""

    def __init__(self, db: AsyncSession):
        super().__init__(VacacionesDisponibles, db)

    async def _no_empleado_for(self, empleado_id: int) -> int:
        from app.models.empleados import Empleado

        result = await self.db.execute(
            select(Empleado.no_empleado).where(Empleado.empleado_id == empleado_id)
        )
        no_empleado = result.scalar_one_or_none()
        if no_empleado is None:
            raise NotFoundError(entidad="Empleado", id=empleado_id)
        return no_empleado

    async def get_by_empleado_id(self, empleado_id: int) -> VacacionesDisponibles | None:
        no_empleado = await self._no_empleado_for(empleado_id)
        result = await self.db.execute(
            select(VacacionesDisponibles).where(
                VacacionesDisponibles.no_empleado == no_empleado
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, empleado_id: int) -> VacacionesDisponibles:
        row = await self.get_by_empleado_id(empleado_id)
        if row is not None:
            return row
        no_empleado = await self._no_empleado_for(empleado_id)
        return await self.create({"no_empleado": no_empleado, "dias": 0})

    async def get_dias_disponibles(self, empleado_id: int) -> int:
        row = await self.get_by_empleado_id(empleado_id)
        return row.dias if row is not None else 0

    async def establecer(self, empleado_id: int, dias_disponibles: int) -> VacacionesDisponibles:
        if dias_disponibles < 0:
            raise DomainValidationError(detail="Los días disponibles no pueden ser negativos.")
        row = await self.get_by_empleado_id(empleado_id)
        if row is None:
            no_empleado = await self._no_empleado_for(empleado_id)
            return await self.create({"no_empleado": no_empleado, "dias": dias_disponibles})
        row.dias = dias_disponibles
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def debitar(self, empleado_id: int, dias: int) -> VacacionesDisponibles:
        if dias <= 0:
            raise DomainValidationError(
                detail="La cantidad de días a rebajar debe ser mayor a cero."
            )
        row = await self.get_or_create(empleado_id)
        if dias > row.dias:
            raise DomainValidationError(
                detail=(
                    f"Saldo insuficiente: hay {row.dias} día(s) disponible(s) "
                    f"y se solicitan {dias}."
                )
            )
        row.dias -= dias
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def acreditar(self, empleado_id: int, dias: int) -> VacacionesDisponibles:
        if dias <= 0:
            return await self.get_or_create(empleado_id)
        row = await self.get_or_create(empleado_id)
        row.dias += dias
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def ensure_empleado_exists(self, empleado_id: int) -> None:
        await self._no_empleado_for(empleado_id)
