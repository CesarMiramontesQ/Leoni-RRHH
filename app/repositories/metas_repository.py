# app/repositories/metas_repository.py
"""Capa de acceso a datos del modulo Metas (OKR ligero).

Solo queries (SQLAlchemy async). La logica de negocio (ciclo de vida,
formulas de avance/cumplimiento, validaciones) vive en `MetasService`.
Precarga con `selectinload` donde el service necesita atravesar relaciones
lazy en contexto async (evita MissingGreenlet) — mismo patron que
`app/repositories/encuestas_rh_repository.py`.
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.metas import Meta, MetaCiclo, MetaResultadoClave


class MetasRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Ciclo ────────────────────────────────────────────────────────────
    async def get_ciclo(self, ciclo_id: int) -> Optional[MetaCiclo]:
        result = await self.db.execute(
            select(MetaCiclo).where(MetaCiclo.id == ciclo_id)
        )
        return result.scalar_one_or_none()

    async def list_ciclos(self, estado: Optional[str] = None) -> Sequence[MetaCiclo]:
        query = select(MetaCiclo).order_by(MetaCiclo.id.desc())
        if estado is not None:
            query = query.where(MetaCiclo.estado == estado)
        result = await self.db.execute(query)
        return result.scalars().all()

    # ── Meta ─────────────────────────────────────────────────────────────
    async def get_meta(self, meta_id: int) -> Optional[Meta]:
        """Meta con `ciclo`, `resultados_clave` (+ sus `checkins`, para el
        guard de borrado) y `submetas` (+ sus `resultados_clave`, para el
        roll-up de avance de una meta de equipo) precargados."""
        result = await self.db.execute(
            select(Meta)
            .where(Meta.id == meta_id)
            .options(
                selectinload(Meta.ciclo),
                selectinload(Meta.resultados_clave).selectinload(
                    MetaResultadoClave.checkins
                ),
                selectinload(Meta.submetas).selectinload(Meta.resultados_clave),
            )
        )
        return result.scalar_one_or_none()

    async def list_metas(
        self,
        ciclo_id: Optional[int] = None,
        empleado_id: Optional[int] = None,
        nivel: Optional[str] = None,
    ) -> Sequence[Meta]:
        query = (
            select(Meta)
            .options(
                selectinload(Meta.resultados_clave),
                selectinload(Meta.submetas).selectinload(Meta.resultados_clave),
            )
            .order_by(Meta.id)
        )
        if ciclo_id is not None:
            query = query.where(Meta.ciclo_id == ciclo_id)
        if empleado_id is not None:
            query = query.where(Meta.empleado_id == empleado_id)
        if nivel is not None:
            query = query.where(Meta.nivel == nivel)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_metas_individuales_no_cerradas(self, ciclo_id: int) -> Sequence[Meta]:
        """Metas individuales del ciclo sin calificar (bloquean `cerrar_ciclo`)."""
        result = await self.db.execute(
            select(Meta).where(
                Meta.ciclo_id == ciclo_id,
                Meta.nivel == "individual",
                Meta.estado != "cerrada",
            )
        )
        return result.scalars().all()

    async def list_metas_equipo_no_cerradas(self, ciclo_id: int) -> Sequence[Meta]:
        """Metas de equipo del ciclo aun no cerradas: `cerrar_ciclo` las
        congela automaticamente (no exigen calificacion previa, ver
        MetasService.cerrar_ciclo)."""
        result = await self.db.execute(
            select(Meta).where(
                Meta.ciclo_id == ciclo_id,
                Meta.nivel == "equipo",
                Meta.estado != "cerrada",
            )
        )
        return result.scalars().all()

    async def list_metas_cerradas_empleado(
        self, ciclo_id: int, empleado_id: int
    ) -> Sequence[Meta]:
        """Metas individuales cerradas (calificadas) de un empleado en un
        ciclo — base de `MetasService.cumplimiento_empleado`."""
        result = await self.db.execute(
            select(Meta).where(
                Meta.ciclo_id == ciclo_id,
                Meta.empleado_id == empleado_id,
                Meta.estado == "cerrada",
            )
        )
        return result.scalars().all()

    # ── Empleado (solo lectura, tabla Bono externa) ──────────────────────
    async def get_nombres_empleados(self, empleado_ids: Sequence[int]) -> dict[int, str]:
        """Mapa `empleado_id` -> `nombre` para enriquecer el tablero de
        equipo/export (Tarea 4). Solo lectura sobre `empleados` (Bono,
        prohibido escribir/alterar el esquema desde este proyecto)."""
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.nombre).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
        return {eid: nombre for eid, nombre in result.all()}

    # ── Resultado clave ──────────────────────────────────────────────────
    async def get_rc(self, rc_id: int) -> Optional[MetaResultadoClave]:
        result = await self.db.execute(
            select(MetaResultadoClave)
            .where(MetaResultadoClave.id == rc_id)
            .options(
                selectinload(MetaResultadoClave.checkins),
                selectinload(MetaResultadoClave.meta).selectinload(Meta.ciclo),
            )
        )
        return result.scalar_one_or_none()
