from sqlalchemy import String, cast
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.empleados_rh import (
    EmpleadoCore,
    EmpleadoRhConfig,
    ensure_rh_config,
)
from app.models.roles import Rol


class RhPermisosRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_empleado_by_id(self, empleado_pk: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.core))
            .where(Empleado.id == empleado_pk)
        )
        return result.scalar_one_or_none()

    async def list_empleados_gestionados(self) -> list[Empleado]:
        """Usuarios gestionados en permisos por módulo: RH no removidos (cualquier
        estado) más empleados de otros roles inscritos explícitamente por RH."""
        result = await self.db.execute(
            select(Empleado)
            .join(EmpleadoCore, EmpleadoCore.empleado_id == Empleado.empleado_id)
            .join(Rol, EmpleadoCore.rol_id == Rol.id)
            .outerjoin(
                EmpleadoRhConfig,
                EmpleadoRhConfig.empleado_id == Empleado.empleado_id,
            )
            .options(selectinload(Empleado.core))
            .where(
                or_(
                    and_(
                        Rol.nombre == "rh",
                        or_(
                            EmpleadoRhConfig.acceso_rh_removido.is_(False),
                            EmpleadoRhConfig.empleado_id.is_(None),
                        ),
                    ),
                    EmpleadoRhConfig.inscrito_modulos_rh.is_(True),
                )
            )
            .order_by(Empleado.nombre.asc())
        )
        return list(result.scalars().all())

    async def search_empleados_disponibles(
        self,
        *,
        q: str,
        limit: int = 50,
    ) -> list[Empleado]:
        term = (q or "").strip()
        if not term:
            return []

        pattern = f"%{term}%"

        result = await self.db.execute(
            select(Empleado)
            .join(EmpleadoCore, EmpleadoCore.empleado_id == Empleado.empleado_id)
            .join(Rol, EmpleadoCore.rol_id == Rol.id)
            .options(selectinload(Empleado.core))
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                or_(
                    Empleado.nombre.ilike(pattern),
                    cast(Empleado.no_empleado, String).ilike(pattern),
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
            .options(selectinload(Empleado.core))
            .where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def update_modulos_rh(
        self,
        empleado: Empleado,
        modulos: dict[str, bool],
        inscrito: bool | None = None,
    ) -> Empleado:
        config = ensure_rh_config(self.db, empleado)
        config.modulos_rh = modulos
        if inscrito is not None:
            config.inscrito_modulos_rh = inscrito
        await self.db.flush()
        refreshed = await self.get_by_empleado_id(empleado.empleado_id)
        return refreshed or empleado

    async def set_inscripcion(
        self, empleado: Empleado, inscrito: bool, modulos: dict[str, bool]
    ) -> Empleado:
        config = ensure_rh_config(self.db, empleado)
        config.inscrito_modulos_rh = inscrito
        config.modulos_rh = modulos
        await self.db.flush()
        refreshed = await self.get_by_empleado_id(empleado.empleado_id)
        return refreshed or empleado

    async def set_acceso_rh_removido(
        self, empleado: Empleado, removido: bool, modulos: dict[str, bool]
    ) -> Empleado:
        """Marca/desmarca a un usuario RH como removido de la administración de
        permisos y fija sus accesos (el rol nunca cambia)."""
        config = ensure_rh_config(self.db, empleado)
        config.acceso_rh_removido = removido
        config.modulos_rh = modulos
        await self.db.flush()
        refreshed = await self.get_by_empleado_id(empleado.empleado_id)
        return refreshed or empleado