import re
import unicodedata
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.emails import Email
from app.models.empleados import Empleado
from app.models.catalogos import Area, ClasificacionEmpleado, Puesto
from app.repositories.base import BaseRepository

ModoEstadoListado = Literal["todos", "activos", "inactivos", "permiso"]


class UsuarioRepository(BaseRepository[Empleado]):
    @staticmethod
    def _normalize_search_text(value: str) -> str:
        no_accents = "".join(
            ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn"
        )
        return re.sub(r"\s+", " ", no_accents).strip().lower()

    @staticmethod
    def _normalized_sql(expr):
        # Normaliza en SQL para búsquedas case/diacritics insensitive.
        lowered = func.lower(func.coalesce(expr, ""))
        return func.translate(
            lowered,
            "áéíóúäëïöüàèìòùâêîôûãõñç",
            "aeiouaeiouaeiouaeiouaonc",
        )

    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.estado),
                selectinload(Empleado.area),
                selectinload(Empleado.puesto),
                selectinload(Empleado.subarea),
                selectinload(Empleado.categoria),
                selectinload(Empleado.clasificacion),
                selectinload(Empleado.email_alterno),
            )
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _estado_condition(
        modo_estado: ModoEstadoListado,
        estados_activos: list[int],
        estados_permiso_ids: list[int] | None = None,
    ):
        if modo_estado == "todos":
            return None
        if modo_estado == "permiso":
            ep = estados_permiso_ids or []
            if not ep:
                return Empleado.id == -1
            return Empleado.estado_id.in_(ep)
        if not estados_activos:
            return None
        if modo_estado == "activos":
            return Empleado.estado_id.in_(estados_activos)
        return or_(
            Empleado.estado_id.is_(None),
            ~Empleado.estado_id.in_(estados_activos),
        )

    @staticmethod
    def _list_filters(
        q: str | None,
        area_id: int | None,
        puesto_id: list[int] | None,
        modo_estado: ModoEstadoListado,
        estados_activos: list[int],
        ids_permitidos: list[int] | None = None,
        *,
        estados_permiso_ids: list[int] | None = None,
        solo_contrato_por_vencer: bool = False,
        hoy_contrato: date | None = None,
        dias_ventana_contrato: int = 30,
    ) -> list:
        conditions: list = []
        est = UsuarioRepository._estado_condition(
            modo_estado, estados_activos, estados_permiso_ids
        )
        if est is not None:
            conditions.append(est)
        if area_id is not None:
            conditions.append(Empleado.area_id == area_id)
        if puesto_id:
            conditions.append(Empleado.puesto_id.in_(puesto_id))
        if ids_permitidos is not None:
            if not ids_permitidos:
                conditions.append(Empleado.id == -1)
            else:
                conditions.append(Empleado.id.in_(ids_permitidos))
        if q and q.strip():
            normalized_q = UsuarioRepository._normalize_search_text(q)
            tokens = [tok for tok in normalized_q.split(" ") if tok]
            for token in tokens:
                term = f"%{token}%"
                token_like = [
                    UsuarioRepository._normalized_sql(Empleado.nombre).ilike(term),
                    UsuarioRepository._normalized_sql(Empleado.no_empleado).ilike(term),
                    UsuarioRepository._normalized_sql(Empleado.email).ilike(term),
                    UsuarioRepository._normalized_sql(Email.email).ilike(term),
                    cast(Empleado.id, String).ilike(term),
                    cast(Empleado.empleado_id, String).ilike(term),
                    and_(
                        Empleado.no_sap.isnot(None),
                        UsuarioRepository._normalized_sql(Empleado.no_sap).ilike(term),
                    ),
                    and_(
                        Empleado.usuario.isnot(None),
                        UsuarioRepository._normalized_sql(Empleado.usuario).ilike(term),
                    ),
                ]
                # Cada token debe existir en alguno de los campos (AND entre tokens).
                conditions.append(or_(*token_like))
        if solo_contrato_por_vencer and hoy_contrato is not None:
            hasta = hoy_contrato + timedelta(days=dias_ventana_contrato)
            conditions.extend(
                [
                    Empleado.fecha_fin_contrato.isnot(None),
                    Empleado.fecha_fin_contrato >= hoy_contrato,
                    Empleado.fecha_fin_contrato <= hasta,
                ]
            )
        return conditions

    async def list_page(
        self,
        offset: int,
        limit: int,
        q: str | None,
        area_id: int | None,
        puesto_id: list[int] | None,
        modo_estado: ModoEstadoListado = "todos",
        estados_activos: list[int] | None = None,
        ids_permitidos: list[int] | None = None,
        *,
        estados_permiso_ids: list[int] | None = None,
        solo_contrato_por_vencer: bool = False,
        hoy_contrato: date | None = None,
    ) -> list[Empleado]:
        ea = estados_activos or []
        conditions = self._list_filters(
            q,
            area_id,
            puesto_id,
            modo_estado,
            ea,
            ids_permitidos,
            estados_permiso_ids=estados_permiso_ids,
            solo_contrato_por_vencer=solo_contrato_por_vencer,
            hoy_contrato=hoy_contrato,
        )
        query = select(Empleado).options(
            selectinload(Empleado.rol),
            selectinload(Empleado.lider),
            selectinload(Empleado.estado),
            selectinload(Empleado.area),
            selectinload(Empleado.puesto),
            selectinload(Empleado.subarea),
            selectinload(Empleado.categoria),
            selectinload(Empleado.clasificacion),
            selectinload(Empleado.email_alterno),
        )
        query = query.outerjoin(Email, Email.no_empleado == Empleado.no_empleado)
        for cond in conditions:
            query = query.where(cond)
        query = query.order_by(Empleado.id).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        q: str | None,
        area_id: int | None,
        puesto_id: list[int] | None,
        modo_estado: ModoEstadoListado = "todos",
        estados_activos: list[int] | None = None,
        ids_permitidos: list[int] | None = None,
        *,
        estados_permiso_ids: list[int] | None = None,
        solo_contrato_por_vencer: bool = False,
        hoy_contrato: date | None = None,
    ) -> int:
        ea = estados_activos or []
        conditions = self._list_filters(
            q,
            area_id,
            puesto_id,
            modo_estado,
            ea,
            ids_permitidos,
            estados_permiso_ids=estados_permiso_ids,
            solo_contrato_por_vencer=solo_contrato_por_vencer,
            hoy_contrato=hoy_contrato,
        )
        query = (
            select(func.count())
            .select_from(Empleado)
            .outerjoin(Email, Email.no_empleado == Empleado.no_empleado)
        )
        for cond in conditions:
            query = query.where(cond)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_subordinados(self, lider_id: int, estados_activos: list[int]) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.email_alterno),
            )
            .where(
                Empleado.lider_id == lider_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())

    async def list_areas_activas(self) -> list[Area]:
        result = await self.db.execute(
            select(Area).where(Area.estatus_id == 1).order_by(Area.descripcion)
        )
        return list(result.scalars().all())

    async def list_puestos_activos(self) -> list[Puesto]:
        result = await self.db.execute(
            select(Puesto).where(Puesto.estatus_id == 1).order_by(Puesto.descripcion)
        )
        return list(result.scalars().all())

    async def count_activos(self, estados_activos: list[int]) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(Empleado.estado_id.in_(estados_activos))
        )
        return result.scalar_one()

    async def count_inactivos(self, estados_activos: list[int]) -> int:
        if not estados_activos:
            return 0
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(
                or_(
                    Empleado.estado_id.is_(None),
                    ~Empleado.estado_id.in_(estados_activos),
                )
            )
        )
        return result.scalar_one()

    async def count_sin_lider_asignado(self, estados_activos: list[int] | None = None) -> int:
        query = select(func.count()).select_from(Empleado).where(Empleado.lider_id.is_(None))
        if estados_activos:
            query = query.where(Empleado.estado_id.in_(estados_activos))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def list_clasificaciones_activas(self) -> list[ClasificacionEmpleado]:
        result = await self.db.execute(
            select(ClasificacionEmpleado)
            .where(ClasificacionEmpleado.estatus_id == 1)
            .order_by(ClasificacionEmpleado.descripcion.asc())
        )
        return list(result.scalars().all())

    async def count_activos_por_area_clasificacion(
        self, estados_activos: list[int], clasificacion_id: int
    ) -> list[tuple[str, int]]:
        if not estados_activos:
            return []
        area_label = func.coalesce(Area.descripcion, "Sin área")
        query = (
            select(area_label, func.count())
            .select_from(Empleado)
            .outerjoin(Area, Empleado.area_id == Area.area_id)
            .where(
                Empleado.estado_id.in_(estados_activos),
                Empleado.clasificacion_id == clasificacion_id,
            )
            .group_by(area_label)
            .order_by(func.count().desc(), area_label.asc())
        )
        result = await self.db.execute(query)
        return [(str(label), int(total)) for label, total in result.all()]

    async def count_contratos_por_vencer(
        self,
        estados_activos: list[int],
        ids_permitidos: list[int] | None,
        hoy: date,
        dias_ventana: int = 30,
    ) -> int:
        if not estados_activos:
            return 0
        hasta = hoy + timedelta(days=dias_ventana)
        conditions = [
            Empleado.estado_id.in_(estados_activos),
            Empleado.fecha_fin_contrato.isnot(None),
            Empleado.fecha_fin_contrato >= hoy,
            Empleado.fecha_fin_contrato <= hasta,
        ]
        if ids_permitidos is not None:
            if not ids_permitidos:
                return 0
            conditions.append(Empleado.id.in_(ids_permitidos))
        query = select(func.count()).select_from(Empleado).where(*conditions)
        result = await self.db.execute(query)
        return result.scalar_one()
