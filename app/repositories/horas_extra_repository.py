"""Consultas de solicitudes de horas extra para la vista RH (filas empleado-solicitud)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.horas_extra import (
    CentroCosto,
    HorasExtraAprobacion,
    HorasExtraSolicitud,
    HorasExtraSolicitudDetalle,
)


class HorasExtraRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _filas_query(self):
        """Una fila por empleado dentro de una solicitud (detalle + solicitud)."""
        return (
            select(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id)
        )

    @staticmethod
    def _estado_por_tab(tab: str) -> str | None:
        return {
            "pendientes": "pendiente",
            "aprobados": "aprobado",
            "rechazados": "rechazado",
        }.get(tab)

    def _apply_filtros(
        self,
        query,
        *,
        q: str | None = None,
        tab: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ):
        if ids_permitidos is not None:
            if not ids_permitidos:
                return query.where(Empleado.id == -1)
            query = query.where(Empleado.id.in_(ids_permitidos))
        if area_id is not None:
            query = query.where(HorasExtraSolicitud.area_id == area_id)
        if centrocosto_id is not None:
            query = query.where(HorasExtraSolicitud.centrocosto_id == centrocosto_id)
        if lider_empleado_id is not None:
            query = query.where(Empleado.lider_id == lider_empleado_id)
        if tab and tab != "todos":
            estado = self._estado_por_tab(tab)
            if estado:
                query = query.where(HorasExtraSolicitud.estado == estado)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Empleado.nombre).like(term),
                    func.lower(Empleado.no_empleado).like(term),
                )
            )
        return query

    async def list_filas(
        self,
        *,
        offset: int,
        limit: int,
        q: str | None = None,
        tab: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> list[HorasExtraSolicitudDetalle]:
        query = self._apply_filtros(
            self._filas_query(),
            q=q,
            tab=tab,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            lider_empleado_id=lider_empleado_id,
            ids_permitidos=ids_permitidos,
        )
        query = (
            query.options(
                selectinload(HorasExtraSolicitudDetalle.empleado).selectinload(
                    Empleado.puesto
                ),
                selectinload(HorasExtraSolicitudDetalle.empleado).selectinload(
                    Empleado.lider
                ),
                selectinload(HorasExtraSolicitudDetalle.solicitud).selectinload(
                    HorasExtraSolicitud.area
                ),
                selectinload(HorasExtraSolicitudDetalle.solicitud).selectinload(
                    HorasExtraSolicitud.centro_costo
                ),
                selectinload(HorasExtraSolicitudDetalle.solicitud).selectinload(
                    HorasExtraSolicitud.motivo
                ),
                selectinload(HorasExtraSolicitudDetalle.solicitud).selectinload(
                    HorasExtraSolicitud.registrado_por
                ),
                selectinload(HorasExtraSolicitudDetalle.solicitud)
                .selectinload(HorasExtraSolicitud.aprobaciones)
                .selectinload(HorasExtraAprobacion.aprobador),
            )
            .order_by(
                HorasExtraSolicitud.fecha_solicitud.desc(),
                HorasExtraSolicitud.id.desc(),
                Empleado.nombre.asc(),
                HorasExtraSolicitudDetalle.id.asc(),
            )
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_filas(
        self,
        *,
        q: str | None = None,
        tab: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> int:
        query = self._apply_filtros(
            select(func.count())
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id),
            q=q,
            tab=tab,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            lider_empleado_id=lider_empleado_id,
            ids_permitidos=ids_permitidos,
        )
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)

    async def tabs_counts(
        self,
        *,
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
        ids_permitidos: list[int] | None = None,
    ) -> dict[str, int]:
        """Conteo de filas por estado de solicitud (sin filtro de pestaña)."""
        query = self._apply_filtros(
            select(HorasExtraSolicitud.estado, func.count())
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id),
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            lider_empleado_id=lider_empleado_id,
            ids_permitidos=ids_permitidos,
        ).group_by(HorasExtraSolicitud.estado)
        result = await self.db.execute(query)
        por_estado = {str(estado): int(cnt) for estado, cnt in result.all()}
        return {
            "todos": sum(por_estado.values()),
            "pendientes": por_estado.get("pendiente", 0),
            "aprobados": por_estado.get("aprobado", 0),
            "rechazados": por_estado.get("rechazado", 0),
        }

    async def resumen_filas(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> tuple[Decimal, int, int]:
        """(total horas, empleados con registro, empleados con horas > 0) en el alcance."""
        base = self._apply_filtros(
            select(
                func.coalesce(func.sum(HorasExtraSolicitudDetalle.total_horas), 0),
                func.count(func.distinct(HorasExtraSolicitudDetalle.empleado_id)),
            )
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id),
            ids_permitidos=ids_permitidos,
        )
        total_horas, con_registro = (await self.db.execute(base)).one()

        con_horas_q = self._apply_filtros(
            select(func.count(func.distinct(HorasExtraSolicitudDetalle.empleado_id)))
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id),
            ids_permitidos=ids_permitidos,
        ).where(HorasExtraSolicitudDetalle.total_horas > 0)
        con_horas = (await self.db.execute(con_horas_q)).scalar_one()

        return (
            Decimal(str(total_horas or 0)),
            int(con_registro or 0),
            int(con_horas or 0),
        )

    async def solicitudes_counts(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> dict[str, int]:
        """Solicitudes distintas por estado dentro del alcance."""
        query = self._apply_filtros(
            select(
                HorasExtraSolicitud.estado,
                func.count(func.distinct(HorasExtraSolicitud.id)),
            )
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id),
            ids_permitidos=ids_permitidos,
        ).group_by(HorasExtraSolicitud.estado)
        result = await self.db.execute(query)
        return {str(estado): int(cnt) for estado, cnt in result.all()}

    async def list_centros_costo_en_solicitudes(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> list[tuple[int, str | None]]:
        """Centros de costo presentes en solicitudes (id, descripción)."""
        query = self._apply_filtros(
            select(
                HorasExtraSolicitud.centrocosto_id,
                func.max(CentroCosto.descripcion),
            )
            .select_from(HorasExtraSolicitudDetalle)
            .join(
                HorasExtraSolicitud,
                HorasExtraSolicitudDetalle.solicitud_id == HorasExtraSolicitud.id,
            )
            .join(Empleado, HorasExtraSolicitudDetalle.empleado_id == Empleado.id)
            .outerjoin(
                CentroCosto,
                CentroCosto.centrocosto_id == HorasExtraSolicitud.centrocosto_id,
            ),
            ids_permitidos=ids_permitidos,
        ).group_by(HorasExtraSolicitud.centrocosto_id)
        result = await self.db.execute(query)
        return sorted(
            ((int(cc_id), desc) for cc_id, desc in result.all()),
            key=lambda par: par[0],
        )

    async def count_empleados_activos_planta(
        self,
        *,
        ids_permitidos: list[int] | None = None,
    ) -> int:
        query = select(func.count()).select_from(Empleado).where(
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
        )
        if ids_permitidos is not None:
            if not ids_permitidos:
                return 0
            query = query.where(Empleado.id.in_(ids_permitidos))
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)
