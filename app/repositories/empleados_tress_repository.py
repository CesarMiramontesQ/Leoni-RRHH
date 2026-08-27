"""Acceso a la caché de datos generales del colaborador en Bono (`levelup_empleados_tress`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
Además de la fecha de ingreso (Vista 360) aquí vive el contrato actual, que consume
`contratos_service` para el listado de vencimientos.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Sequence

from sqlalchemy import Integer, String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.catalogos import Area, Puesto
from app.models.empleados import Empleado
from app.models.empleados_tress import EmpleadoTress
from app.repositories.base import BaseRepository


@dataclass(frozen=True)
class ContratoFila:
    """Una fila del listado, ya resuelta contra los catálogos de Bono."""

    tress: EmpleadoTress
    empleado_id: int
    no_empleado: int
    nombre: str
    area: str | None
    puesto: str | None
    supervisor: str | None


def estatus_contrato_expr(hoy: date, ventana_dias: int):
    """`CASE` con el mismo criterio que `contratos_service.calcular_estatus`.

    Se usa para filtrar y para los KPIs en SQL; el servicio recalcula el estatus de cada
    fila en Python con la misma regla, así que ambos siempre coinciden.
    """
    limite = hoy + timedelta(days=ventana_dias)
    fv = EmpleadoTress.fecha_vencimiento_contrato
    return case(
        (EmpleadoTress.contrato_dias == 0, "indefinido"),
        (fv.is_(None), "sin_dato"),
        (fv < hoy, "vencido"),
        (fv <= limite, "por_vencer"),
        else_="vigente",
    )


class EmpleadosTressRepository(BaseRepository[EmpleadoTress]):
    def __init__(self, db: AsyncSession):
        super().__init__(EmpleadoTress, db)

    async def get_fecha_ingreso(self, no_empleado: int) -> date | None:
        """`CB_FEC_ING` cacheada. `None` si no hay fila o si TRESS no la tenía."""
        result = await self.db.execute(
            select(EmpleadoTress.fecha_ingreso).where(
                EmpleadoTress.no_empleado == int(no_empleado)
            )
        )
        return result.scalar_one_or_none()

    async def get_por_no_empleado(self, no_empleado: int) -> EmpleadoTress | None:
        result = await self.db.execute(
            select(EmpleadoTress).where(EmpleadoTress.no_empleado == int(no_empleado))
        )
        return result.scalar_one_or_none()

    async def map_existentes(self) -> dict[int, EmpleadoTress]:
        """Todas las filas por `no_empleado`, para que el sync decida insert/update en memoria."""
        result = await self.db.execute(select(EmpleadoTress))
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}

    # ------------------------------------------------------------------ contratos

    def _base_contratos(self, *, estados_activos: Sequence[int], area_id: int | None, q: str | None):
        """FROM/WHERE común del listado y los KPIs: solo activos en Bono."""
        lider = aliased(Empleado)
        stmt = (
            select(
                EmpleadoTress,
                Empleado.empleado_id,
                Empleado.no_empleado,
                Empleado.nombre,
                Area.descripcion.label("area"),
                Puesto.descripcion.label("puesto"),
                lider.nombre.label("supervisor"),
            )
            .join(Empleado, Empleado.no_empleado == EmpleadoTress.no_empleado)
            .outerjoin(Area, Area.area_id == Empleado.area_id)
            .outerjoin(Puesto, Puesto.puesto_id == Empleado.puesto_id)
            .outerjoin(lider, lider.empleado_id == Empleado.lider_id)
            .where(Empleado.estado_id.in_(list(estados_activos)))
        )
        if area_id is not None:
            stmt = stmt.where(Empleado.area_id == area_id)
        if q:
            texto = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Empleado.nombre.ilike(texto),
                    cast(Empleado.no_empleado, String).ilike(texto),
                )
            )
        return stmt

    async def list_contratos(
        self,
        *,
        hoy: date,
        ventana_dias: int,
        estados_activos: Sequence[int],
        estatus: str | None,
        area_id: int | None,
        q: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[ContratoFila], int]:
        stmt = self._base_contratos(estados_activos=estados_activos, area_id=area_id, q=q)
        if estatus:
            stmt = stmt.where(estatus_contrato_expr(hoy, ventana_dias) == estatus)

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = (
            stmt.order_by(
                EmpleadoTress.fecha_vencimiento_contrato.asc().nulls_last(),
                Empleado.nombre.asc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        filas = (await self.db.execute(stmt)).all()
        return [
            ContratoFila(
                tress=f[0],
                empleado_id=int(f.empleado_id),
                no_empleado=int(f.no_empleado),
                nombre=f.nombre,
                area=f.area,
                puesto=f.puesto,
                supervisor=f.supervisor,
            )
            for f in filas
        ], int(total)

    async def areas_con_contratos(self, *, estados_activos: Sequence[int]) -> list[tuple[int, str]]:
        """Áreas con al menos un activo en la caché, para el combo de filtro."""
        stmt = (
            select(Area.area_id, Area.descripcion)
            .join(Empleado, Empleado.area_id == Area.area_id)
            .join(EmpleadoTress, EmpleadoTress.no_empleado == Empleado.no_empleado)
            .where(Empleado.estado_id.in_(list(estados_activos)))
            .distinct()
            .order_by(Area.descripcion.asc())
        )
        return [(int(a), d) for a, d in (await self.db.execute(stmt)).all()]

    async def kpis_contratos(
        self,
        *,
        hoy: date,
        ventana_dias: int,
        estados_activos: Sequence[int],
        area_id: int | None,
        q: str | None,
    ) -> dict[str, int]:
        base = self._base_contratos(estados_activos=estados_activos, area_id=area_id, q=q)
        sub = base.add_columns(
            estatus_contrato_expr(hoy, ventana_dias).label("estatus")
        ).subquery()
        stmt = select(sub.c.estatus, func.count()).group_by(sub.c.estatus)
        return {str(estatus): int(n) for estatus, n in (await self.db.execute(stmt)).all()}
