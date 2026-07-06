# app/repositories/junta_repository.py
"""
Capa de acceso a datos del modulo Juntas.

Solo queries (SQLAlchemy async). La logica de negocio vive en el service.
Hereda de BaseRepository para el CRUD generico sobre la junta y agrega
consultas especializadas con eager-loading de asistentes (evita MissingGreenlet
al serializar en async).
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.juntas import Junta, JuntaAsistente
from app.repositories.base import BaseRepository


class JuntaRepository(BaseRepository[Junta]):
    def __init__(self, db: AsyncSession):
        super().__init__(Junta, db)

    async def list_juntas(
        self, filters: list, page: int, page_size: int, order_desc: bool = True
    ) -> tuple[Sequence[Junta], int]:
        base = select(Junta)
        for cond in filters:
            base = base.where(cond)

        total_res = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_res.scalar_one()

        order = Junta.id.desc() if order_desc else Junta.id.asc()
        query = (
            base.options(selectinload(Junta.asistentes))
            .order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_junta_detalle(self, junta_id: int) -> Optional[Junta]:
        result = await self.db.execute(
            select(Junta)
            .where(Junta.id == junta_id)
            .options(
                selectinload(Junta.asistentes)
                .selectinload(JuntaAsistente.empleado)
                .selectinload(Empleado.puesto),
                selectinload(Junta.asistentes)
                .selectinload(JuntaAsistente.empleado)
                .selectinload(Empleado.area),
            )
        )
        return result.scalar_one_or_none()

    async def get_junta(self, junta_id: int) -> Optional[Junta]:
        return await self.get(junta_id)

    async def list_asistentes(self, junta_id: int) -> Sequence[JuntaAsistente]:
        result = await self.db.execute(
            select(JuntaAsistente)
            .where(JuntaAsistente.junta_id == junta_id)
            .order_by(JuntaAsistente.id)
        )
        return result.scalars().all()
