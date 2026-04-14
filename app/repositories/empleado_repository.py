from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.emails import Email
from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class EmpleadoRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    @staticmethod
    def _no_empleado_variantes(no_empleado: str) -> list[str]:
        valor = (no_empleado or "").strip()
        if not valor:
            return []
        variantes = {valor}
        if valor.isdigit():
            variantes.add(f"{valor}.0")
        if valor.endswith(".0") and valor[:-2].isdigit():
            variantes.add(valor[:-2])
        return list(variantes)

    async def get_by_email(self, email: str) -> Empleado | None:
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            return None
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.email_alterno),
            )
            .outerjoin(Email, Email.no_empleado == Empleado.no_empleado)
            .where(
                or_(
                    func.lower(Empleado.email) == normalized_email,
                    func.lower(Email.email) == normalized_email,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_by_usuario(self, usuario: str) -> Empleado | None:
        u = usuario.strip()
        if not u:
            return None
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.email_alterno),
            )
            .where(
                Empleado.usuario.isnot(None),
                func.lower(Empleado.usuario) == u.lower(),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_no_empleado(self, no_empleado: str) -> Empleado | None:
        variantes = self._no_empleado_variantes(no_empleado)
        if not variantes:
            return None
        variantes_lower = [v.lower() for v in variantes]
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.email_alterno),
            )
            .where(
                func.lower(Empleado.no_empleado).in_(variantes_lower),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_empleado_id(self, empleado_id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado).where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_subordinados(self, lider_id: int, estados_activos: list[int]) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado).where(
                Empleado.lider_id == lider_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())
