# app/repositories/notificacion_repository.py

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notificaciones import Notificacion
from app.repositories.base import BaseRepository


class NotificacionRepository(BaseRepository[Notificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(Notificacion, db)

    async def list_no_leidas(self, destinatario_id: int) -> list[Notificacion]:
        result = await self.db.execute(
            select(Notificacion)
            .where(
                Notificacion.destinatario_id == destinatario_id,
                Notificacion.leida == False,  # noqa: E712
            )
            .order_by(Notificacion.id.desc())
        )
        return list(result.scalars().all())

    async def marcar_leida(self, notificacion_id: int) -> Notificacion | None:
        return await self.update(notificacion_id, {"leida": True})
