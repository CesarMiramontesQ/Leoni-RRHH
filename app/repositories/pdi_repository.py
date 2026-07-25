"""Repository para Plan de Desarrollo Individual (PDI)."""

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area
from app.models.empleados import Empleado
from app.models.talento import PlanDesarrolloIndividual


class PDIRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, pdi_id: int) -> Optional[PlanDesarrolloIndividual]:
        stmt = (
            select(PlanDesarrolloIndividual)
            .options(selectinload(PlanDesarrolloIndividual.competencia))
            .where(PlanDesarrolloIndividual.id == pdi_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> list[PlanDesarrolloIndividual]:
        stmt = (
            select(PlanDesarrolloIndividual)
            .options(selectinload(PlanDesarrolloIndividual.competencia))
            .where(PlanDesarrolloIndividual.empleado_id == empleado_id)
            .order_by(PlanDesarrolloIndividual.fecha_inicio)
        )
        if estado:
            stmt = stmt.where(PlanDesarrolloIndividual.estado == estado)
        if competencia_id:
            stmt = stmt.where(PlanDesarrolloIndividual.competencia_id == competencia_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_empleado(
        self,
        empleado_id: int,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(PlanDesarrolloIndividual)
            .where(PlanDesarrolloIndividual.empleado_id == empleado_id)
        )
        if estado:
            stmt = stmt.where(PlanDesarrolloIndividual.estado == estado)
        if competencia_id:
            stmt = stmt.where(PlanDesarrolloIndividual.competencia_id == competencia_id)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def create(self, instance: PlanDesarrolloIndividual) -> PlanDesarrolloIndividual:
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance, attribute_names=["competencia"])
        return instance

    async def delete(self, pdi_id: int) -> None:
        stmt = delete(PlanDesarrolloIndividual).where(PlanDesarrolloIndividual.id == pdi_id)
        await self.db.execute(stmt)
        await self.db.flush()

    async def list_consolidated(
        self,
        offset: int,
        limit: int,
        area_id: int | None = None,
        area_ids: list[int] | None = None,
        estado: str | None = None,
        fecha_inicio_desde: date | None = None,
        fecha_fin_hasta: date | None = None,
        search: str | None = None,
        solo_vencidas: bool = False,
    ) -> tuple[list[PlanDesarrolloIndividual], int]:
        base = (
            select(PlanDesarrolloIndividual)
            .join(PlanDesarrolloIndividual.empleado)
            .options(
                selectinload(PlanDesarrolloIndividual.empleado).selectinload(Empleado.area),
                selectinload(PlanDesarrolloIndividual.competencia),
            )
        )
        count_base = (
            select(func.count())
            .select_from(PlanDesarrolloIndividual)
            .join(PlanDesarrolloIndividual.empleado)
        )

        if area_ids is not None:
            base = base.where(Empleado.area_id.in_(area_ids))
            count_base = count_base.where(Empleado.area_id.in_(area_ids))

        if area_id is not None:
            base = base.where(Empleado.area_id == area_id)
            count_base = count_base.where(Empleado.area_id == area_id)

        if estado:
            base = base.where(PlanDesarrolloIndividual.estado == estado)
            count_base = count_base.where(PlanDesarrolloIndividual.estado == estado)

        if fecha_inicio_desde:
            base = base.where(PlanDesarrolloIndividual.fecha_inicio >= fecha_inicio_desde)
            count_base = count_base.where(PlanDesarrolloIndividual.fecha_inicio >= fecha_inicio_desde)

        if fecha_fin_hasta:
            base = base.where(PlanDesarrolloIndividual.fecha_fin <= fecha_fin_hasta)
            count_base = count_base.where(PlanDesarrolloIndividual.fecha_fin <= fecha_fin_hasta)

        if search:
            pattern = f"%{search}%"
            base = base.where(Empleado.nombre.ilike(pattern))
            count_base = count_base.where(Empleado.nombre.ilike(pattern))

        if solo_vencidas:
            today = date.today()
            overdue_cond = and_(
                PlanDesarrolloIndividual.fecha_fin < today,
                PlanDesarrolloIndividual.estado.notin_(["completado", "cancelado"]),
            )
            base = base.where(overdue_cond)
            count_base = count_base.where(overdue_cond)

        total_result = await self.db.execute(count_base)
        total = total_result.scalar_one()

        stmt = base.order_by(
            PlanDesarrolloIndividual.fecha_fin.asc()
        ).offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def resumen(self, area_ids: list[int] | None = None) -> dict:
        today = date.today()
        base = select(
            func.count().label("total"),
            func.count().filter(PlanDesarrolloIndividual.estado == "completado").label("completadas"),
            func.count().filter(PlanDesarrolloIndividual.estado == "en_proceso").label("en_proceso"),
            func.count().filter(PlanDesarrolloIndividual.estado == "pendiente").label("pendientes"),
            func.count().filter(
                and_(
                    PlanDesarrolloIndividual.fecha_fin < today,
                    PlanDesarrolloIndividual.estado.notin_(["completado", "cancelado"]),
                )
            ).label("vencidas"),
        ).select_from(PlanDesarrolloIndividual)

        if area_ids is not None:
            base = base.join(PlanDesarrolloIndividual.empleado).where(
                Empleado.area_id.in_(area_ids)
            )

        result = await self.db.execute(base)
        row = result.one()
        return {
            "total_acciones": row.total,
            "completadas": row.completadas,
            "en_proceso": row.en_proceso,
            "pendientes": row.pendientes,
            "vencidas": row.vencidas,
        }

    async def get_with_empleado(self, pdi_id: int) -> Optional[PlanDesarrolloIndividual]:
        stmt = (
            select(PlanDesarrolloIndividual)
            .options(
                selectinload(PlanDesarrolloIndividual.competencia),
                selectinload(PlanDesarrolloIndividual.empleado).selectinload(Empleado.area),
            )
            .where(PlanDesarrolloIndividual.id == pdi_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def progreso_por_empleado(
        self,
        area_ids: list[int] | None = None,
        area_id: int | None = None,
    ) -> list:
        today = date.today()

        stmt = (
            select(
                PlanDesarrolloIndividual.empleado_id,
                Empleado.nombre.label("empleado_nombre"),
                Area.descripcion.label("area_nombre"),
                func.count().label("total"),
                func.count().filter(PlanDesarrolloIndividual.estado == "completado").label("completadas"),
                func.count().filter(PlanDesarrolloIndividual.estado == "en_proceso").label("en_proceso"),
                func.count().filter(PlanDesarrolloIndividual.estado == "pendiente").label("pendientes"),
                func.count().filter(
                    and_(
                        PlanDesarrolloIndividual.fecha_fin < today,
                        PlanDesarrolloIndividual.estado.notin_(["completado", "cancelado"]),
                    )
                ).label("vencidas"),
            )
            .join(PlanDesarrolloIndividual.empleado)
            .outerjoin(Area, Empleado.area_id == Area.area_id)
            .group_by(PlanDesarrolloIndividual.empleado_id, Empleado.nombre, Area.descripcion)
        )

        if area_ids is not None:
            stmt = stmt.where(Empleado.area_id.in_(area_ids))

        if area_id is not None:
            stmt = stmt.where(Empleado.area_id == area_id)

        stmt = stmt.order_by(Empleado.nombre)
        result = await self.db.execute(stmt)
        return list(result.all())

    async def equipo_pdi_aggregates(
        self,
        area_ids: list[int] | None = None,
        area_id: int | None = None,
        empleado_ids: list[int] | None = None,
    ) -> list:
        today = date.today()
        stmt = (
            select(
                PlanDesarrolloIndividual.empleado_id,
                func.count().label("total"),
                func.count().filter(PlanDesarrolloIndividual.estado == "completado").label("completadas"),
                func.count().filter(PlanDesarrolloIndividual.estado == "en_proceso").label("en_proceso"),
                func.count().filter(PlanDesarrolloIndividual.estado == "pendiente").label("pendientes"),
                func.count().filter(
                    and_(
                        PlanDesarrolloIndividual.fecha_fin < today,
                        PlanDesarrolloIndividual.estado.notin_(["completado", "cancelado"]),
                    )
                ).label("vencidas"),
                func.count().filter(PlanDesarrolloIndividual.estado == "cancelado").label("cancelados"),
                func.max(PlanDesarrolloIndividual.updated_at).label("ultima_actualizacion"),
            )
            .join(PlanDesarrolloIndividual.empleado)
            .group_by(PlanDesarrolloIndividual.empleado_id)
        )
        if area_ids is not None:
            stmt = stmt.where(Empleado.area_id.in_(area_ids))
        if area_id is not None:
            stmt = stmt.where(Empleado.area_id == area_id)
        if empleado_ids is not None:
            # Lista vacia = scope que no ve a nadie. `in_([])` devuelve 0 filas,
            # que es exactamente lo correcto: NO equivale a "sin filtro".
            stmt = stmt.where(PlanDesarrolloIndividual.empleado_id.in_(empleado_ids))
        result = await self.db.execute(stmt)
        return list(result.all())

    async def timeline_events(
        self,
        area_ids: list[int] | None = None,
        area_id: int | None = None,
        dias_futuro: int = 30,
        dias_pasado: int = 7,
    ) -> list[PlanDesarrolloIndividual]:
        today = date.today()
        desde = today - timedelta(days=dias_pasado)
        hasta = today + timedelta(days=dias_futuro)

        stmt = (
            select(PlanDesarrolloIndividual)
            .join(PlanDesarrolloIndividual.empleado)
            .options(
                selectinload(PlanDesarrolloIndividual.empleado),
                selectinload(PlanDesarrolloIndividual.competencia),
            )
            .where(
                PlanDesarrolloIndividual.fecha_fin.between(desde, hasta),
                PlanDesarrolloIndividual.estado.notin_(["cancelado"]),
            )
        )
        if area_ids is not None:
            stmt = stmt.where(Empleado.area_id.in_(area_ids))
        if area_id is not None:
            stmt = stmt.where(Empleado.area_id == area_id)
        stmt = stmt.order_by(PlanDesarrolloIndividual.fecha_fin.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
