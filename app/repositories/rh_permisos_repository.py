from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.roles import Rol


class RhPermisosRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_empleado_by_id(self, empleado_pk: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.id == empleado_pk)
        )
        return result.scalar_one_or_none()

    async def list_empleados_gestionados(self) -> list[Empleado]:
        """RH (todos) + empleados de cualquier rol con permisos explícitos."""
        result = await self.db.execute(
            select(Empleado)
            .join(Rol, Empleado.rol_id == Rol.id)
            .options(selectinload(Empleado.rol))
            .where(
                or_(
                    Rol.nombre == "rh",
                    Empleado.modulos_rh != {},
                )
            )
            .order_by(Empleado.nombre.asc())
        )
        return list(result.scalars().all())

    async def search_empleados_disponibles(
        self,
        *,
        q: str,
        limit: int = 15,
    ) -> list[Empleado]:
        term = (q or "").strip()
        if not term:
            return []

        pattern = f"%{term}%"
        managed = select(Empleado.empleado_id).join(Rol, Empleado.rol_id == Rol.id).where(
            or_(Rol.nombre == "rh", Empleado.modulos_rh != {})
        )

        result = await self.db.execute(
            select(Empleado)
            .join(Rol, Empleado.rol_id == Rol.id)
            .options(selectinload(Empleado.rol))
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                Empleado.empleado_id.not_in(managed),
                or_(
                    Empleado.nombre.ilike(pattern),
                    Empleado.no_empleado.ilike(pattern),
                    Empleado.email.ilike(pattern),
                ),
            )
            .order_by(Empleado.nombre.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_empleado_id(self, empleado_id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def update_modulos_rh(self, empleado: Empleado, modulos: dict[str, bool]) -> Empleado:
        empleado.modulos_rh = modulos
        await self.db.flush()
        await self.db.refresh(empleado, attribute_names=["modulos_rh"])
        refreshed = await self.get_by_empleado_id(empleado.empleado_id)
        return refreshed or empleado
