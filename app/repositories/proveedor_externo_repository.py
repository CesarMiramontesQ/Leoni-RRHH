# app/repositories/proveedor_externo_repository.py
"""
Capa de acceso a datos del modulo de Personal Externo (proveedores, personas,
cursos externos y registros de vencimiento).

Solo queries (SQLAlchemy async). La logica de negocio vive en el service.
Usa `selectinload` en detalle/listado para evitar MissingGreenlet al serializar
las relaciones en async.
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.proveedores_externos import (
    CursoExterno,
    Proveedor,
    ProveedorPersona,
    ProveedorPersonaCurso,
)
from app.repositories.base import BaseRepository


class ProveedorExternoRepository(BaseRepository[Proveedor]):
    def __init__(self, db: AsyncSession):
        super().__init__(Proveedor, db)

    # ── Proveedores ───────────────────────────────────────────────────────────
    async def list_proveedores(
        self, filters: list, page: int, page_size: int
    ) -> tuple[Sequence[Proveedor], int]:
        base = select(Proveedor)
        for cond in filters:
            base = base.where(cond)

        total_res = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_res.scalar_one()

        query = (
            base.options(selectinload(Proveedor.personas))
            .order_by(Proveedor.nombre.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_proveedor_detalle(self, proveedor_id: int) -> Optional[Proveedor]:
        result = await self.db.execute(
            select(Proveedor)
            .where(Proveedor.id == proveedor_id)
            .options(selectinload(Proveedor.personas))
        )
        return result.scalar_one_or_none()

    # ── Personas ──────────────────────────────────────────────────────────────
    async def get_persona(self, persona_id: int) -> Optional[ProveedorPersona]:
        result = await self.db.execute(
            select(ProveedorPersona).where(ProveedorPersona.id == persona_id)
        )
        return result.scalar_one_or_none()

    async def list_personas_de_proveedor(
        self, proveedor_id: int, solo_activas: bool = True
    ) -> Sequence[ProveedorPersona]:
        query = select(ProveedorPersona).where(
            ProveedorPersona.proveedor_id == proveedor_id
        )
        if solo_activas:
            query = query.where(ProveedorPersona.activo.is_(True))
        query = query.order_by(ProveedorPersona.nombre.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    # ── Cursos externos ───────────────────────────────────────────────────────
    async def get_curso_externo(self, curso_id: int) -> Optional[CursoExterno]:
        result = await self.db.execute(
            select(CursoExterno).where(CursoExterno.id == curso_id)
        )
        return result.scalar_one_or_none()

    async def list_cursos_externos(
        self, filters: list, page: int, page_size: int
    ) -> tuple[Sequence[CursoExterno], int]:
        base = select(CursoExterno)
        for cond in filters:
            base = base.where(cond)

        total_res = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_res.scalar_one()

        query = (
            base.order_by(CursoExterno.nombre.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all(), total

    # ── Registros / Vencimientos ──────────────────────────────────────────────
    async def get_registro(self, registro_id: int) -> Optional[ProveedorPersonaCurso]:
        result = await self.db.execute(
            select(ProveedorPersonaCurso)
            .where(ProveedorPersonaCurso.id == registro_id)
            .options(
                selectinload(ProveedorPersonaCurso.persona).selectinload(
                    ProveedorPersona.proveedor
                ),
                selectinload(ProveedorPersonaCurso.curso),
            )
        )
        return result.scalar_one_or_none()

    async def list_vencimientos(
        self,
        filters: list,
        page: int,
        page_size: int,
        incluir_historico: bool,
    ) -> tuple[Sequence[ProveedorPersonaCurso], int]:
        """Lista registros de curso con sus relaciones precargadas.

        Por defecto (``incluir_historico=False``) devuelve solo el registro mas
        reciente por (persona, curso) — el "estado actual". El filtro de estado
        se aplica como condiciones sobre `fecha_vencimiento` (armadas en el
        service) para que la paginacion sea correcta.
        """
        base = select(ProveedorPersonaCurso).join(
            ProveedorPersona,
            ProveedorPersonaCurso.persona_id == ProveedorPersona.id,
        )
        for cond in filters:
            base = base.where(cond)

        if not incluir_historico:
            # id del registro mas reciente por (persona, curso): mayor fecha_realizado,
            # desempatado por id. Subquery de ids "vigentes" para filtrar.
            latest_ids = (
                select(func.max(ProveedorPersonaCurso.id))
                .group_by(
                    ProveedorPersonaCurso.persona_id,
                    ProveedorPersonaCurso.curso_externo_id,
                )
                .scalar_subquery()
            )
            base = base.where(ProveedorPersonaCurso.id.in_(latest_ids))

        total_res = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_res.scalar_one()

        query = (
            base.options(
                selectinload(ProveedorPersonaCurso.persona).selectinload(
                    ProveedorPersona.proveedor
                ),
                selectinload(ProveedorPersonaCurso.curso),
            )
            .order_by(ProveedorPersonaCurso.fecha_vencimiento.asc().nulls_last())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all(), total
