from datetime import date

from sqlalchemy import Select, String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.faltas_retardos import FaltaRetardoEvento, FaltaRetardoRegistroAuditoria
from app.repositories.base import BaseRepository


class FaltasRetardosRepository(BaseRepository[FaltaRetardoEvento]):
    def __init__(self, db: AsyncSession):
        super().__init__(FaltaRetardoEvento, db)

    def _base_query(self) -> Select:
        return select(FaltaRetardoEvento).options(
            selectinload(FaltaRetardoEvento.empleado),
            selectinload(FaltaRetardoEvento.registrado_por),
        )

    def _apply_filters(
        self,
        query: Select,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> Select:
        if empleado_ids_scope is not None:
            query = query.where(FaltaRetardoEvento.empleado_id.in_(empleado_ids_scope))
        if empleado_id is not None:
            query = query.where(FaltaRetardoEvento.empleado_id == empleado_id)
        if tipo:
            query = query.where(FaltaRetardoEvento.tipo == tipo)
        # Solape de rangos: el evento va de fecha_evento a fecha_fin (o un solo
        # día si fecha_fin es NULL). Un filtro "desde X" sin "hasta" no debe
        # acotar por arriba.
        if fecha_inicio is not None:
            query = query.where(
                or_(
                    FaltaRetardoEvento.fecha_fin >= fecha_inicio,
                    and_(
                        FaltaRetardoEvento.fecha_fin.is_(None),
                        FaltaRetardoEvento.fecha_evento >= fecha_inicio,
                    ),
                )
            )
        if fecha_fin is not None:
            query = query.where(FaltaRetardoEvento.fecha_evento <= fecha_fin)
        if busqueda:
            term = f"%{busqueda.strip()}%"
            query = query.join(
                Empleado, Empleado.empleado_id == FaltaRetardoEvento.empleado_id
            ).where(
                or_(
                    Empleado.nombre.ilike(term),
                    cast(Empleado.no_empleado, String).ilike(term),
                )
            )
        return query

    async def get_with_relations(self, evento_id: int) -> FaltaRetardoEvento | None:
        result = await self.db.execute(
            self._base_query().where(FaltaRetardoEvento.id == evento_id)
        )
        return result.scalar_one_or_none()

    async def list_page(
        self,
        *,
        page: int,
        page_size: int,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> tuple[list[FaltaRetardoEvento], int]:
        filters_applied = self._apply_filters(
            self._base_query(),
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            empleado_ids_scope=empleado_ids_scope,
        )
        count_q = select(func.count(func.distinct(FaltaRetardoEvento.id))).select_from(
            FaltaRetardoEvento
        )
        count_q = self._apply_filters(
            count_q,
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            empleado_ids_scope=empleado_ids_scope,
        )
        total = int((await self.db.execute(count_q)).scalar_one())

        offset = (page - 1) * page_size
        items_q = (
            filters_applied.order_by(
                FaltaRetardoEvento.fecha_evento.desc(),
                FaltaRetardoEvento.id.desc(),
            )
            .offset(offset)
            .limit(page_size)
        )
        result = await self.db.execute(items_q)
        return list(result.scalars().unique().all()), total

    async def list_levelup_filtered(
        self,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
        tipos_permitidos: frozenset[str] | None = None,
    ) -> list[FaltaRetardoEvento]:
        """Lista eventos persistidos en levelup (p. ej. goce), sin paginar."""
        query = self._apply_filters(
            self._base_query(),
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            empleado_ids_scope=empleado_ids_scope,
        )
        if tipos_permitidos is not None:
            query = query.where(FaltaRetardoEvento.tipo.in_(tipos_permitidos))
        query = query.order_by(
            FaltaRetardoEvento.fecha_evento.desc(),
            FaltaRetardoEvento.id.desc(),
        )
        result = await self.db.execute(query)
        return list(result.scalars().unique().all())

    async def create_evento(
        self,
        *,
        empleado_id: int,
        tipo: str,
        fecha_evento: date,
        fecha_fin: date | None,
        observaciones: str | None,
        registrado_por_id: int,
    ) -> FaltaRetardoEvento:
        row = FaltaRetardoEvento(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_evento=fecha_evento,
            fecha_fin=fecha_fin,
            observaciones=observaciones,
            registrado_por_id=registrado_por_id,
        )
        self.db.add(row)
        await self.db.flush()
        loaded = await self.get_with_relations(row.id)
        return loaded if loaded is not None else row

    async def save_registros_auditoria(
        self,
        *,
        bono_origen: str,
        bono_origen_ids: list[int],
        registrado_por_id: int,
        observaciones: str | None = None,
        fecha_fin: date | None = None,
    ) -> None:
        if not bono_origen_ids:
            return
        seen: set[int] = set()
        for bono_origen_id in bono_origen_ids:
            if bono_origen_id in seen:
                continue
            seen.add(bono_origen_id)
            self.db.add(
                FaltaRetardoRegistroAuditoria(
                    bono_origen=bono_origen,
                    bono_origen_id=bono_origen_id,
                    registrado_por_id=registrado_por_id,
                    observaciones=observaciones,
                    fecha_fin=fecha_fin,
                )
            )
        await self.db.flush()

    async def map_registros_auditoria(
        self,
        *,
        bono_origen: str,
        bono_origen_ids: list[int],
    ) -> dict[int, FaltaRetardoRegistroAuditoria]:
        if not bono_origen_ids:
            return {}
        result = await self.db.execute(
            select(FaltaRetardoRegistroAuditoria)
            .options(selectinload(FaltaRetardoRegistroAuditoria.registrado_por))
            .where(
                FaltaRetardoRegistroAuditoria.bono_origen == bono_origen,
                FaltaRetardoRegistroAuditoria.bono_origen_id.in_(bono_origen_ids),
            )
        )
        rows = result.scalars().all()
        return {row.bono_origen_id: row for row in rows}
