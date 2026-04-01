from typing import Any, Generic, Type, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: int) -> ModelType | None:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def list_paginated(
        self,
        cursor: int | None = None,
        limit: int = 20,
        filters: list | None = None,
    ) -> tuple[list[ModelType], int | None]:
        query = select(self.model)

        if filters:
            for condition in filters:
                query = query.where(condition)

        if cursor is not None:
            query = query.where(self.model.id > cursor)

        query = query.order_by(self.model.id).limit(limit + 1)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].id

        return items, next_cursor

    async def count(self, filters: list | None = None) -> int:
        query = select(func.count()).select_from(self.model)
        if filters:
            for condition in filters:
                query = query.where(condition)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, data: dict) -> ModelType:
        instance = self.model(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> ModelType | None:
        instance = await self.get(id)
        if not instance:
            return None
        for key, value in data.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete(self, id: int) -> bool:
        instance = await self.get(id)
        if not instance:
            return False
        if hasattr(instance, "activo"):
            instance.activo = False
            await self.db.flush()
            return True
        return False

    async def hard_delete(self, id: int) -> bool:
        instance = await self.get(id)
        if not instance:
            return False
        await self.db.delete(instance)
        await self.db.flush()
        return True
