from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.roles import Rol
from app.models.vistas_rol import VistaRol


class VistasRolRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def roles_por_nombre(self, nombres: list[str]) -> dict[str, int]:
        result = await self.db.execute(
            select(Rol.nombre, Rol.id).where(Rol.nombre.in_(nombres))
        )
        return {nombre: rol_id for nombre, rol_id in result.all()}

    async def listar(self) -> list[tuple[str, str, bool]]:
        """Filas `(rol_nombre, vista_key, habilitado)` de los roles existentes."""
        result = await self.db.execute(
            select(Rol.nombre, VistaRol.vista_key, VistaRol.habilitado).join(
                Rol, Rol.id == VistaRol.rol_id
            )
        )
        return [(nombre, key, bool(hab)) for nombre, key, hab in result.all()]

    async def upsert(
        self,
        *,
        rol_id: int,
        vista_key: str,
        habilitado: bool,
        actualizado_por_empleado_id: int | None,
    ) -> VistaRol:
        result = await self.db.execute(
            select(VistaRol).where(
                VistaRol.rol_id == rol_id, VistaRol.vista_key == vista_key
            )
        )
        fila = result.scalar_one_or_none()
        if fila is None:
            fila = VistaRol(rol_id=rol_id, vista_key=vista_key)
            self.db.add(fila)
        fila.habilitado = habilitado
        fila.actualizado_por_empleado_id = actualizado_por_empleado_id
        await self.db.flush()
        return fila
