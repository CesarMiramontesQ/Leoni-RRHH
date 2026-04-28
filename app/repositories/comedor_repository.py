# app/repositories/comedor_repository.py
"""
Repositorio de Comedor: menus semanales, registros de seleccion y validacion de huella.
"""

from datetime import date

from sqlalchemy import and_, case, delete, func, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorAccesoEstado,
    ComedorRegistro,
    ComedorTipoComida,
    MenuSemanal,
)
from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class ComedorRepository(BaseRepository[Comedor]):
    def __init__(self, db: AsyncSession):
        super().__init__(Comedor, db)

    async def get_activos(self) -> list[Comedor]:
        result = await self.db.execute(
            select(Comedor).where(Comedor.activo == True)  # noqa: E712
        )
        return list(result.scalars().all())


class MenuSemanalRepository(BaseRepository[MenuSemanal]):
    def __init__(self, db: AsyncSession):
        super().__init__(MenuSemanal, db)

    async def get_menu_semana(
        self,
        comedor_id: int,
        semana: date,
    ) -> list[MenuSemanal]:
        result = await self.db.execute(
            select(MenuSemanal)
            .where(
                MenuSemanal.comedor_id == comedor_id,
                MenuSemanal.semana == semana,
            )
            .order_by(MenuSemanal.dia)
        )
        return list(result.scalars().all())

    async def get_menu_semana_todos(self, semana: date) -> list[MenuSemanal]:
        """Retorna todos los menus de todos los comedores para una semana."""
        result = await self.db.execute(
            select(MenuSemanal)
            .options(selectinload(MenuSemanal.comedor))
            .where(MenuSemanal.semana == semana)
            .order_by(MenuSemanal.comedor_id, MenuSemanal.dia)
        )
        return list(result.scalars().all())


class ComedorRegistroRepository(BaseRepository[ComedorRegistro]):
    def __init__(self, db: AsyncSession):
        super().__init__(ComedorRegistro, db)

    async def get_registro_semana(
        self,
        empleado_id: int,
        semana: date,
    ) -> ComedorRegistro | None:
        result = await self.db.execute(
            select(ComedorRegistro)
            .where(
                ComedorRegistro.empleado_id == empleado_id,
                ComedorRegistro.semana == semana,
            )
        )
        return result.scalar_one_or_none()

    async def get_registro_semana_comedor(
        self,
        empleado_id: int,
        comedor_id: int,
        semana: date,
    ) -> ComedorRegistro | None:
        result = await self.db.execute(
            select(ComedorRegistro).where(
                ComedorRegistro.empleado_id == empleado_id,
                ComedorRegistro.comedor_id == comedor_id,
                ComedorRegistro.semana == semana,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_huella(self, num_empleado: str) -> Empleado | None:
        """
        Stub: busca empleado por no_empleado.
        En produccion el campo de huella biometrica se mapearia directamente.
        """
        from app.core.config import settings

        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(
                Empleado.no_empleado == num_empleado,
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            )
        )
        return result.scalar_one_or_none()

    async def get_registros_semana(self, semana: date) -> list[ComedorRegistro]:
        result = await self.db.execute(
            select(ComedorRegistro)
            .options(
                selectinload(ComedorRegistro.empleado),
                selectinload(ComedorRegistro.comedor),
            )
            .where(ComedorRegistro.semana == semana)
        )
        return list(result.scalars().all())

    async def get_registros_semanas_recientes(self, n: int = 4) -> list[ComedorRegistro]:
        """Retorna todos los registros de las ultimas n semanas para proyecciones."""
        from sqlalchemy import desc, func
        subquery = (
            select(ComedorRegistro.semana)
            .distinct()
            .order_by(desc(ComedorRegistro.semana))
            .limit(n)
            .subquery()
        )
        result = await self.db.execute(
            select(ComedorRegistro)
            .options(
                selectinload(ComedorRegistro.empleado),
                selectinload(ComedorRegistro.comedor),
            )
            .where(ComedorRegistro.semana.in_(select(subquery)))
        )
        return list(result.scalars().all())


class ComedorAccesoRepository(BaseRepository[ComedorAcceso]):
    def __init__(self, db: AsyncSession):
        super().__init__(ComedorAcceso, db)

    async def get_acceso_por_empleado_y_fecha(
        self,
        empleado_id: int,
        fecha_servicio: date,
    ) -> ComedorAcceso | None:
        result = await self.db.execute(
            select(ComedorAcceso).where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio == fecha_servicio,
            )
        )
        return result.scalar_one_or_none()

    async def list_accesos_por_empleado_y_fechas(
        self,
        empleado_id: int,
        fechas_servicio: list[date],
    ) -> list[ComedorAcceso]:
        if not fechas_servicio:
            return []
        result = await self.db.execute(
            select(ComedorAcceso).where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio.in_(fechas_servicio),
            )
        )
        return list(result.scalars().all())

    async def list_fechas_reserva_activa(
        self,
        empleado_id: int,
        desde: date,
        hasta: date,
    ) -> list[date]:
        """Fechas con reserva PENDIENTE o ACCEDIDO (un empleado solo una fila por fecha)."""
        result = await self.db.execute(
            select(ComedorAcceso.fecha_servicio)
            .where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso.in_(
                    (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
                ),
            )
            .distinct()
            .order_by(ComedorAcceso.fecha_servicio)
        )
        return [row[0] for row in result.all()]

    async def list_pendientes_para_dia(
        self,
        empleado_id: int,
        comedor_id: int,
        fecha_servicio: date,
    ) -> list[ComedorAcceso]:
        result = await self.db.execute(
            select(ComedorAcceso)
            .options(selectinload(ComedorAcceso.registro))
            .where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.comedor_id == comedor_id,
                ComedorAcceso.fecha_servicio == fecha_servicio,
                ComedorAcceso.estado_acceso == ComedorAccesoEstado.PENDIENTE,
            )
            .order_by(ComedorAcceso.id)
        )
        return list(result.scalars().all())

    async def get_pendiente_para_dia(
        self,
        empleado_id: int,
        comedor_id: int,
        fecha_servicio: date,
        tipo_comida_preferido: ComedorTipoComida | None = None,
    ) -> ComedorAcceso | None:
        rows = await self.list_pendientes_para_dia(
            empleado_id=empleado_id,
            comedor_id=comedor_id,
            fecha_servicio=fecha_servicio,
        )
        if not rows:
            return None
        if tipo_comida_preferido is not None:
            for row in rows:
                if row.tipo_comida == tipo_comida_preferido:
                    return row
        return rows[0]

    async def list_accesos_empleado_rango(
        self,
        empleado_id: int,
        desde: date,
        hasta: date,
    ) -> list[ComedorAcceso]:
        result = await self.db.execute(
            select(ComedorAcceso)
            .where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso.in_(
                    (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
                ),
            )
            .order_by(ComedorAcceso.fecha_servicio, ComedorAcceso.tipo_comida)
        )
        return list(result.scalars().all())

    async def list_proximos_accesos_empleado(
        self,
        empleado_id: int,
        desde: date,
        limite: int = 5,
    ) -> list[ComedorAcceso]:
        result = await self.db.execute(
            select(ComedorAcceso)
            .where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.estado_acceso.in_(
                    (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
                ),
            )
            .order_by(ComedorAcceso.fecha_servicio.asc(), ComedorAcceso.id.asc())
            .limit(limite)
        )
        return list(result.scalars().all())

    async def list_proximos_accesos_equipo(
        self,
        empleado_ids: list[int],
        desde: date,
        limite: int = 100,
    ) -> list[ComedorAcceso]:
        if not empleado_ids:
            return []
        result = await self.db.execute(
            select(ComedorAcceso)
            .options(selectinload(ComedorAcceso.empleado))
            .where(
                ComedorAcceso.empleado_id.in_(empleado_ids),
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.estado_acceso.in_(
                    (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
                ),
            )
            .order_by(
                ComedorAcceso.fecha_servicio.asc(),
                ComedorAcceso.empleado_id.asc(),
                ComedorAcceso.id.asc(),
            )
            .limit(limite)
        )
        return list(result.scalars().all())

    async def list_accesos_equipo_mes(
        self,
        empleado_ids: list[int],
        desde: date,
        hasta: date,
    ) -> list[ComedorAcceso]:
        if not empleado_ids:
            return []
        result = await self.db.execute(
            select(ComedorAcceso)
            .options(selectinload(ComedorAcceso.empleado))
            .where(
                ComedorAcceso.empleado_id.in_(empleado_ids),
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso.in_(
                    (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
                ),
            )
            .order_by(
                ComedorAcceso.fecha_servicio.asc(),
                ComedorAcceso.empleado_id.asc(),
                ComedorAcceso.id.asc(),
            )
        )
        return list(result.scalars().all())

    async def get_metricas_reservas_activas_equipo(
        self,
        empleado_ids: list[int],
        semana_actual_inicio: date,
        semana_actual_fin: date,
        semana_siguiente_inicio: date,
        semana_siguiente_fin: date,
    ) -> dict[str, int]:
        if not empleado_ids:
            return {
                "total_semana_actual": 0,
                "total_semana_siguiente": 0,
                "total_activas": 0,
                "total_caseras": 0,
                "total_saludables": 0,
            }

        estado_activo = (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
        stmt = (
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    ComedorAcceso.fecha_servicio >= semana_actual_inicio,
                                    ComedorAcceso.fecha_servicio <= semana_actual_fin,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_semana_actual"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    ComedorAcceso.fecha_servicio >= semana_siguiente_inicio,
                                    ComedorAcceso.fecha_servicio <= semana_siguiente_fin,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_semana_siguiente"),
                func.coalesce(func.count(ComedorAcceso.id), 0).label("total_activas"),
                func.coalesce(
                    func.sum(
                        case(
                            (ComedorAcceso.tipo_comida == ComedorTipoComida.casera, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_caseras"),
                func.coalesce(
                    func.sum(
                        case(
                            (ComedorAcceso.tipo_comida == ComedorTipoComida.saludable, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_saludables"),
            )
            .where(
                ComedorAcceso.empleado_id.in_(empleado_ids),
                ComedorAcceso.estado_acceso.in_(estado_activo),
            )
        )
        row = (await self.db.execute(stmt)).one()
        return {
            "total_semana_actual": int(row.total_semana_actual or 0),
            "total_semana_siguiente": int(row.total_semana_siguiente or 0),
            "total_activas": int(row.total_activas or 0),
            "total_caseras": int(row.total_caseras or 0),
            "total_saludables": int(row.total_saludables or 0),
        }

    async def get_by_id_empleado(
        self,
        acceso_id: int,
        empleado_id: int,
    ) -> ComedorAcceso | None:
        result = await self.db.execute(
            select(ComedorAcceso).where(
                ComedorAcceso.id == acceso_id,
                ComedorAcceso.empleado_id == empleado_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_by_id_empleado(
        self,
        acceso_id: int,
        empleado_id: int,
    ) -> int:
        stmt = delete(ComedorAcceso).where(
            ComedorAcceso.id == acceso_id,
            ComedorAcceso.empleado_id == empleado_id,
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    async def consumir_si_pendiente(
        self,
        acceso_id: int,
        fecha_servicio: date,
    ) -> int:
        stmt = (
            update(ComedorAcceso)
            .where(
                ComedorAcceso.id == acceso_id,
                ComedorAcceso.fecha_servicio == fecha_servicio,
                ComedorAcceso.estado_acceso == ComedorAccesoEstado.PENDIENTE,
            )
            .values(
                estado_acceso=ComedorAccesoEstado.ACCEDIDO,
                hora_entrada=func.now(),
            )
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    async def expirar_pendientes_en_rango_por_empleado(
        self,
        empleado_id: int,
        desde: date,
        hasta: date,
    ) -> int:
        stmt = (
            update(ComedorAcceso)
            .where(
                ComedorAcceso.empleado_id == empleado_id,
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso == ComedorAccesoEstado.PENDIENTE,
            )
            .values(
                estado_acceso=ComedorAccesoEstado.EXPIRADO,
                hora_entrada=None,
            )
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount
