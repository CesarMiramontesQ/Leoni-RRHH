from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notificaciones import Notificacion
from app.repositories.base import BaseRepository


class NotificacionRepository(BaseRepository[Notificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(Notificacion, db)

    async def list_recientes_by_user(
        self,
        user_id: int,
        limit: int = 5,
    ) -> list[Notificacion]:
        result = await self.db.execute(
            select(Notificacion)
            .where(Notificacion.user_id == user_id)
            .order_by(Notificacion.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_user_paginated(
        self,
        user_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Notificacion], int | None]:
        query = (
            select(Notificacion)
            .where(Notificacion.user_id == user_id)
            .order_by(Notificacion.id.desc())
        )
        if cursor is not None:
            query = query.where(Notificacion.id < cursor)

        result = await self.db.execute(query.limit(limit + 1))
        items = list(result.scalars().all())

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].id

        return items, next_cursor

    async def count_by_user(self, user_id: int) -> int:
        return await self.count(filters=[Notificacion.user_id == user_id])

    async def count_unread_by_user(self, user_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Notificacion)
            .where(
                Notificacion.user_id == user_id,
                Notificacion.is_read == False,  # noqa: E712
            )
        )
        return int(result.scalar_one())

    async def get_for_user(
        self,
        notificacion_id: int,
        user_id: int,
    ) -> Notificacion | None:
        result = await self.db.execute(
            select(Notificacion).where(
                Notificacion.id == notificacion_id,
                Notificacion.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def marcar_leida(self, notificacion_id: int) -> Notificacion | None:
        return await self.update(notificacion_id, {"is_read": True})

    async def marcar_leida_for_user(
        self,
        notificacion_id: int,
        user_id: int,
    ) -> Notificacion | None:
        notificacion = await self.get_for_user(notificacion_id=notificacion_id, user_id=user_id)
        if notificacion is None:
            return None
        return await self.marcar_leida(notificacion_id)

    async def marcar_todas_leidas_for_user(self, user_id: int) -> int:
        result = await self.db.execute(
            update(Notificacion)
            .where(
                Notificacion.user_id == user_id,
                Notificacion.is_read == False,  # noqa: E712
            )
            .values(is_read=True, updated_at=func.now())
            .execution_options(synchronize_session=False)
        )
        return int(result.rowcount or 0)
