"""Acceso a datos para Ajustes de Nóminas (autorización de horas extra)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area, Puesto
from app.models.empleados import Empleado
from app.models.empleados_rh import (
    EmpleadoCore,
    EmpleadoRhHorasExtra,
    EmpleadoRhPermisos,
    ensure_rh_horas_extra,
    ensure_rh_permisos,
)
from app.models.horas_extra import HorasExtraAprobador, HorasExtraSolicitud


class NominasAjustesRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
    ):
        stmt = select(Empleado).where(Empleado.estado_id.in_(estados_activos))
        if q:
            patron = f"%{q.strip()}%"
            stmt = (
                stmt.outerjoin(Area, Empleado.area_id == Area.area_id)
                .outerjoin(Puesto, Empleado.puesto_id == Puesto.puesto_id)
                .outerjoin(
                    EmpleadoCore, EmpleadoCore.empleado_id == Empleado.empleado_id
                )
                .where(
                    or_(
                        Empleado.nombre.ilike(patron),
                        Empleado.no_empleado.ilike(patron),
                        EmpleadoCore.email.ilike(patron),
                        Area.descripcion.ilike(patron),
                        Puesto.descripcion.ilike(patron),
                    )
                )
            )
        if autorizado is not None:
            stmt = stmt.outerjoin(
                EmpleadoRhPermisos,
                EmpleadoRhPermisos.empleado_id == Empleado.empleado_id,
            )
            if autorizado:
                stmt = stmt.where(
                    EmpleadoRhPermisos.puede_registrar_horas_extra.is_(True)
                )
            else:
                stmt = stmt.where(
                    or_(
                        EmpleadoRhPermisos.puede_registrar_horas_extra.is_(False),
                        EmpleadoRhPermisos.empleado_id.is_(None),
                    )
                )
        return stmt

    async def list_empleados(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
        offset: int = 0,
        limit: int = 10,
    ) -> list[Empleado]:
        stmt = (
            self._base_query(estados_activos, q=q, autorizado=autorizado)
            .options(
                selectinload(Empleado.core),
                selectinload(Empleado.area),
                selectinload(Empleado.puesto),
                selectinload(Empleado.rh_horas_extra).selectinload(
                    EmpleadoRhHorasExtra.autorizado_por
                ),
            )
            .order_by(Empleado.nombre, Empleado.id)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_empleados(
        self,
        estados_activos: list[int],
        *,
        q: str | None = None,
        autorizado: bool | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(
            self._base_query(estados_activos, q=q, autorizado=autorizado).subquery()
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def count_total_autorizados(self) -> int:
        """Empleados autorizados sin importar su estado laboral."""
        stmt = select(func.count()).where(
            EmpleadoRhPermisos.puede_registrar_horas_extra.is_(True)
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def count_solicitudes_pendientes(self) -> int:
        stmt = select(func.count()).where(HorasExtraSolicitud.estado == "pendiente")
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def count_autorizados_recientes(self, desde: datetime) -> int:
        stmt = (
            select(func.count())
            .select_from(EmpleadoRhPermisos)
            .join(
                EmpleadoRhHorasExtra,
                EmpleadoRhHorasExtra.empleado_id == EmpleadoRhPermisos.empleado_id,
            )
            .where(
                EmpleadoRhPermisos.puede_registrar_horas_extra.is_(True),
                EmpleadoRhHorasExtra.autorizado_en.is_not(None),
                EmpleadoRhHorasExtra.autorizado_en >= desde,
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def get_activos_by_ids(
        self, estados_activos: list[int], ids: list[int]
    ) -> list[Empleado]:
        if not ids:
            return []
        stmt = select(Empleado).where(
            Empleado.id.in_(ids), Empleado.estado_id.in_(estados_activos)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def set_autorizacion(
        self,
        empleados: list[Empleado],
        autorizado: bool,
        *,
        autorizado_por_empleado_id: int | None,
        fecha: datetime,
    ) -> int:
        actualizados = 0
        for emp in empleados:
            if emp.puede_registrar_horas_extra != autorizado:
                permisos = ensure_rh_permisos(self.db, emp)
                permisos.puede_registrar_horas_extra = autorizado
                he = ensure_rh_horas_extra(self.db, emp)
                he.autorizado_en = fecha if autorizado else None
                he.autorizado_por_empleado_id = (
                    autorizado_por_empleado_id if autorizado else None
                )
                actualizados += 1
        if actualizados:
            await self.db.flush()
        return actualizados

    # ── Aprobadores de horas extra ──

    def _aprobadores_query(self):
        return select(HorasExtraAprobador).options(
            selectinload(HorasExtraAprobador.empleado).selectinload(Empleado.area),
            selectinload(HorasExtraAprobador.empleado).selectinload(Empleado.puesto),
        )

    async def list_aprobadores(self) -> list[HorasExtraAprobador]:
        stmt = self._aprobadores_query().order_by(HorasExtraAprobador.id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_aprobador(self, aprobador_id: int) -> HorasExtraAprobador | None:
        stmt = self._aprobadores_query().where(HorasExtraAprobador.id == aprobador_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_aprobadores_by_tipo(self, tipo: str) -> list[HorasExtraAprobador]:
        stmt = self._aprobadores_query().where(HorasExtraAprobador.tipo == tipo)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def exists_director_activo(
        self, *, excluir_id: int | None = None
    ) -> bool:
        stmt = select(func.count()).where(
            HorasExtraAprobador.tipo == "director",
            HorasExtraAprobador.activo.is_(True),
        )
        if excluir_id is not None:
            stmt = stmt.where(HorasExtraAprobador.id != excluir_id)
        result = await self.db.execute(stmt)
        return int(result.scalar_one()) > 0

    async def add_aprobadores(
        self,
        empleado_ids: list[int],
        tipo: str,
        *,
        creado_por_id: int | None,
    ) -> list[HorasExtraAprobador]:
        nuevos = [
            HorasExtraAprobador(
                empleado_id=empleado_id,
                tipo=tipo,
                activo=True,
                creado_por_id=creado_por_id,
            )
            for empleado_id in empleado_ids
        ]
        self.db.add_all(nuevos)
        await self.db.flush()
        return nuevos

    async def delete_aprobador(self, aprobador: HorasExtraAprobador) -> None:
        await self.db.delete(aprobador)
        await self.db.flush()
