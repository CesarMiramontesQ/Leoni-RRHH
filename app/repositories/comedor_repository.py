# app/repositories/comedor_repository.py
"""
Repositorio de Comedor: menus semanales, registros de seleccion y validacion de huella.
"""

from sqlalchemy import String, cast
from datetime import date, time

from sqlalchemy import and_, case, delete, func, or_, select, text, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorAccesoEstado,
    ComedorCodigoExterno,
    ComedorCodigoExternoEstado,
    ComedorExternoCorrelativo,
    ComedorHorarioJornada,
    ComedorRegistro,
    ComedorTipoComida,
    MenuSemanal,
)
from app.models.empleados import Empleado
from app.models.horarios import Horario
from app.models.turnos import Turno
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

    @staticmethod
    def _normalize_menu_dia(dia: str) -> str:
        import unicodedata

        normalized = unicodedata.normalize("NFD", dia.strip())
        without_accents = "".join(
            char for char in normalized if unicodedata.category(char) != "Mn"
        )
        return without_accents.lower()

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

    async def list_menu_items(
        self,
        comedor_id: int,
        semana: date,
        dia: str,
        tipo: str,
    ) -> list[MenuSemanal]:
        dia_key = self._normalize_menu_dia(dia)
        result = await self.db.execute(
            select(MenuSemanal)
            .where(
                MenuSemanal.comedor_id == comedor_id,
                MenuSemanal.semana == semana,
                MenuSemanal.tipo == tipo,
                func.lower(MenuSemanal.dia) == dia_key,
            )
            .order_by(MenuSemanal.id.desc())
        )
        return list(result.scalars().all())

    async def upsert_menu(self, data: dict) -> MenuSemanal:
        """Crea o actualiza un registro por comedor + semana + día + tipo."""
        payload = {
            **data,
            "dia": self._normalize_menu_dia(str(data["dia"])),
        }
        existing_rows = await self.list_menu_items(
            comedor_id=payload["comedor_id"],
            semana=payload["semana"],
            dia=payload["dia"],
            tipo=payload["tipo"],
        )
        if existing_rows:
            primary = existing_rows[0]
            for field in ("descripcion", "detalle", "created_by", "dia"):
                if field in payload:
                    setattr(primary, field, payload[field])
            for duplicate in existing_rows[1:]:
                await self.db.delete(duplicate)
            await self.db.flush()
            await self.db.refresh(primary)
            return primary
        return await self.create(payload)

    async def delete_menu_semana(self, comedor_id: int, semana: date) -> int:
        result = await self.db.execute(
            delete(MenuSemanal).where(
                MenuSemanal.comedor_id == comedor_id,
                MenuSemanal.semana == semana,
            )
        )
        await self.db.flush()
        return int(result.rowcount or 0)

    async def delete_menu_dia(
        self, comedor_id: int, semana: date, dia: str, tipo: str | None = None
    ) -> int:
        """Borra el menú de UN día. Sin `tipo` borra normal y dieta; con él, solo ese.

        Permite corregir o vaciar un día sin tocar el resto de la semana. El día se
        normaliza igual que en `upsert_menu`, para que «Miércoles» encuentre `miercoles`.
        """
        condiciones = [
            MenuSemanal.comedor_id == comedor_id,
            MenuSemanal.semana == semana,
            func.lower(MenuSemanal.dia) == self._normalize_menu_dia(str(dia)),
        ]
        if tipo is not None:
            condiciones.append(MenuSemanal.tipo == tipo)
        result = await self.db.execute(delete(MenuSemanal).where(*condiciones))
        await self.db.flush()
        return int(result.rowcount or 0)

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
            .options(selectinload(Empleado.core))
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

    async def count_proximos_accesos_global_rh(
        self,
        desde: date,
        estados: tuple[ComedorAccesoEstado, ...],
        buscar: str | None = None,
    ) -> int:
        stmt = select(func.count(ComedorAcceso.id)).where(
            ComedorAcceso.fecha_servicio >= desde,
            ComedorAcceso.estado_acceso.in_(estados),
        )
        if buscar and (t := buscar.strip()):
            pattern = f"%{t}%"
            emp_ids = select(Empleado.id).where(
                or_(Empleado.nombre.ilike(pattern), cast(Empleado.no_empleado, String).ilike(pattern))
            )
            stmt = stmt.where(ComedorAcceso.empleado_id.in_(emp_ids))
        return int((await self.db.execute(stmt)).scalar_one() or 0)

    async def list_proximos_accesos_global_rh(
        self,
        desde: date,
        offset: int,
        limit: int,
        estados: tuple[ComedorAccesoEstado, ...],
        buscar: str | None = None,
    ) -> list[ComedorAcceso]:
        stmt = (
            select(ComedorAcceso)
            .options(
                selectinload(ComedorAcceso.empleado).selectinload(Empleado.area),
                selectinload(ComedorAcceso.comedor),
            )
            .where(
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.estado_acceso.in_(estados),
            )
        )
        if buscar and (t := buscar.strip()):
            pattern = f"%{t}%"
            emp_ids = select(Empleado.id).where(
                or_(Empleado.nombre.ilike(pattern), cast(Empleado.no_empleado, String).ilike(pattern))
            )
            stmt = stmt.where(ComedorAcceso.empleado_id.in_(emp_ids))
        stmt = stmt.order_by(ComedorAcceso.fecha_servicio.asc(), ComedorAcceso.id.asc()).offset(offset).limit(
            limit
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def count_accesos_global_rh_en_rango(
        self,
        desde: date,
        hasta: date,
        estados: tuple[ComedorAccesoEstado, ...],
        buscar: str | None = None,
    ) -> int:
        stmt = select(func.count(ComedorAcceso.id)).where(
            ComedorAcceso.fecha_servicio >= desde,
            ComedorAcceso.fecha_servicio <= hasta,
            ComedorAcceso.estado_acceso.in_(estados),
        )
        if buscar and (t := buscar.strip()):
            pattern = f"%{t}%"
            emp_ids = select(Empleado.id).where(
                or_(Empleado.nombre.ilike(pattern), cast(Empleado.no_empleado, String).ilike(pattern))
            )
            stmt = stmt.where(ComedorAcceso.empleado_id.in_(emp_ids))
        return int((await self.db.execute(stmt)).scalar_one() or 0)

    async def list_accesos_global_rh_en_rango(
        self,
        desde: date,
        hasta: date,
        offset: int,
        limit: int,
        estados: tuple[ComedorAccesoEstado, ...],
        buscar: str | None = None,
    ) -> list[ComedorAcceso]:
        stmt = (
            select(ComedorAcceso)
            .options(
                selectinload(ComedorAcceso.empleado).selectinload(Empleado.area),
                selectinload(ComedorAcceso.comedor),
            )
            .where(
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso.in_(estados),
            )
        )
        if buscar and (t := buscar.strip()):
            pattern = f"%{t}%"
            emp_ids = select(Empleado.id).where(
                or_(Empleado.nombre.ilike(pattern), cast(Empleado.no_empleado, String).ilike(pattern))
            )
            stmt = stmt.where(ComedorAcceso.empleado_id.in_(emp_ids))
        stmt = stmt.order_by(ComedorAcceso.fecha_servicio.asc(), ComedorAcceso.id.asc()).offset(offset).limit(
            limit
        )
        return list((await self.db.execute(stmt)).scalars().all())

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
                "total_asistencias": 0,
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
                func.coalesce(
                    func.sum(
                        case(
                            (ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_asistencias"),
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
            "total_asistencias": int(row.total_asistencias or 0),
            "total_activas": int(row.total_activas or 0),
            "total_caseras": int(row.total_caseras or 0),
            "total_saludables": int(row.total_saludables or 0),
        }

    async def list_resumen_diario_global(
        self,
        desde: date,
        hasta: date,
    ) -> list[dict[str, int | date]]:
        estado_activo = (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
        stmt = (
            select(
                ComedorAcceso.fecha_servicio.label("fecha"),
                func.coalesce(
                    func.sum(
                        case(
                            (ComedorAcceso.tipo_comida == ComedorTipoComida.casera, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("caseras"),
                func.coalesce(
                    func.sum(
                        case(
                            (ComedorAcceso.tipo_comida == ComedorTipoComida.saludable, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("saludables"),
                func.count().label("registros"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO,
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("asistencias"),
            )
            .where(
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.fecha_servicio <= hasta,
                ComedorAcceso.estado_acceso.in_(estado_activo),
            )
            .group_by(ComedorAcceso.fecha_servicio)
            .order_by(ComedorAcceso.fecha_servicio.asc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            {
                "fecha": row.fecha,
                "caseras": int(row.caseras or 0),
                "saludables": int(row.saludables or 0),
                "registros": int(row.registros or 0),
                "asistencias": int(row.asistencias or 0),
            }
            for row in rows
        ]

    async def count_accesos_activos_por_dia_desde(
        self, desde: date
    ) -> list[tuple[date, int]]:
        """Cuenta accesos PENDIENTE/ACCEDIDO con fecha_servicio >= desde (una fila por día)."""
        estado_activo = (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
        stmt = (
            select(
                ComedorAcceso.fecha_servicio.label("fecha"),
                func.count().label("cnt"),
            )
            .where(
                ComedorAcceso.fecha_servicio >= desde,
                ComedorAcceso.estado_acceso.in_(estado_activo),
            )
            .group_by(ComedorAcceso.fecha_servicio)
            .order_by(ComedorAcceso.fecha_servicio.asc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [(row.fecha, int(row.cnt or 0)) for row in rows]

    async def count_comidas_activas_en_rango(self, desde: date, hasta: date) -> int:
        """Cuenta accesos PENDIENTE/ACCEDIDO por fecha_servicio (una comida por fila)."""
        estado_activo = (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)
        stmt = select(func.count(ComedorAcceso.id)).where(
            ComedorAcceso.fecha_servicio >= desde,
            ComedorAcceso.fecha_servicio <= hasta,
            ComedorAcceso.estado_acceso.in_(estado_activo),
        )
        return int((await self.db.execute(stmt)).scalar_one() or 0)

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

    async def marcar_repetido_si_accedido(
        self,
        acceso_id: int,
        fecha_servicio: date,
    ) -> int:
        stmt = (
            update(ComedorAcceso)
            .where(
                ComedorAcceso.id == acceso_id,
                ComedorAcceso.fecha_servicio == fecha_servicio,
                ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO,
            )
            .values(
                estado_acceso=ComedorAccesoEstado.REPETIDO,
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


class ComedorExternoCorrelativoRepository:
    """Contador global atómico para códigos CEXT{n} (personal externo)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def reservar_siguientes(self, cantidad: int) -> list[int]:
        if cantidad <= 0:
            return []
        tabla = ComedorExternoCorrelativo.__tablename__
        await self.db.execute(
            text(
                f"INSERT INTO {tabla} (id, siguiente) "
                "VALUES (1, 0) ON CONFLICT (id) DO NOTHING",
            ),
        )
        stmt = (
            update(ComedorExternoCorrelativo)
            .where(ComedorExternoCorrelativo.id == 1)
            .values(siguiente=ComedorExternoCorrelativo.siguiente + cantidad)
            .returning(ComedorExternoCorrelativo.siguiente)
        )
        res = await self.db.execute(stmt)
        nuevo = res.scalar_one()
        inicio = nuevo - cantidad + 1
        return list(range(inicio, nuevo + 1))


class ComedorCodigoExternoRepository(BaseRepository[ComedorCodigoExterno]):
    def __init__(self, db: AsyncSession):
        super().__init__(ComedorCodigoExterno, db)

    async def list_codigos_externos(
        self,
        desde: date | None = None,
        hasta: date | None = None,
        estatus: str | None = None,
    ) -> list[dict]:
        stmt = (
            select(ComedorCodigoExterno)
            .options(selectinload(ComedorCodigoExterno.comedor))
            .order_by(
                ComedorCodigoExterno.fecha_inicio.desc(),
                ComedorCodigoExterno.created_at.desc(),
            )
        )
        if desde:
            stmt = stmt.where(ComedorCodigoExterno.fecha_fin >= desde)
        if hasta:
            stmt = stmt.where(ComedorCodigoExterno.fecha_inicio <= hasta)
        rows = list((await self.db.execute(stmt)).scalars().all())

        result: list[dict] = []
        hoy = date.today()
        for row in rows:
            if row.empleado_id is not None:
                usados_stmt = select(func.count(ComedorAcceso.id)).where(
                    ComedorAcceso.empleado_id == row.empleado_id,
                    ComedorAcceso.comedor_id == row.comedor_id,
                    ComedorAcceso.fecha_servicio == hoy,
                    ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO,
                )
            else:
                prefix = f"{row.codigo_acceso}-"
                usados_stmt = (
                    select(func.count(ComedorAcceso.id))
                    .join(Empleado, Empleado.id == ComedorAcceso.empleado_id)
                    .where(
                        ComedorAcceso.fecha_servicio == hoy,
                        ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO,
                        cast(Empleado.no_empleado, String).like(f"{prefix}%"),
                    )
                )
            usados = int((await self.db.execute(usados_stmt)).scalar() or 0)
            if hoy > row.fecha_fin:
                estado = ComedorCodigoExternoEstado.VENCIDO.value
            elif usados <= 0:
                estado = ComedorCodigoExternoEstado.ACTIVO.value
            elif usados >= row.cantidad_personas:
                estado = ComedorCodigoExternoEstado.USADO_TOTAL.value
            else:
                estado = ComedorCodigoExternoEstado.USADO_PARCIAL.value
            if estatus and estado != estatus:
                continue
            comedor_nm = (row.comedor.nombre if getattr(row, "comedor", None) else "") or ""
            result.append({
                "id": row.id,
                "comedor_id": row.comedor_id,
                "comedor_nombre": comedor_nm.strip(),
                "fecha_inicio": row.fecha_inicio,
                "fecha_fin": row.fecha_fin,
                "cantidad_personas": row.cantidad_personas,
                "tipo_comida": row.tipo_comida.value if hasattr(row.tipo_comida, "value") else str(row.tipo_comida),
                "codigo_acceso": row.codigo_acceso,
                "password_temporal": row.password_temporal,
                "estatus": estado,
                "usados": usados,
                "empleado_id": row.empleado_id,
                "lote_id": row.lote_id,
            })
        return result


class ComedorHorarioJornadaRepository(BaseRepository[ComedorHorarioJornada]):
    """Ventana de comida por jornada, sobre el catálogo replicado `levelup_horarios`.

    `ho_codigo` se guarda **ya normalizado** en las dos tablas, así que aquí no hace falta
    el `RTRIM` que sí necesitan las consultas contra `levelup_turnos` (donde `tu_codigo`
    conserva el relleno de `CHAR(6)`). Aun así se normaliza lo que llega del cliente: una
    URL puede traer espacios.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(ComedorHorarioJornada, db)

    async def list_turnos(self, *, incluir_inactivos: bool = False) -> list[Turno]:
        stmt = select(Turno).order_by(func.rtrim(Turno.tu_codigo))
        if not incluir_inactivos:
            stmt = stmt.where(func.upper(func.rtrim(Turno.tu_activo)) == "S")
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_turno(self, tu_codigo: str) -> Turno | None:
        stmt = select(Turno).where(func.rtrim(Turno.tu_codigo) == tu_codigo.strip())
        return (await self.db.execute(stmt)).scalars().first()

    async def map_jornadas(self) -> dict[str, Horario]:
        """`{ho_codigo: Horario}` del catálogo replicado."""
        result = await self.db.execute(select(Horario))
        return {(h.ho_codigo or "").strip(): h for h in result.scalars().all()}

    async def map_ventanas(self) -> dict[str, ComedorHorarioJornada]:
        """`{ho_codigo: ventana configurada}`."""
        result = await self.db.execute(select(ComedorHorarioJornada))
        return {(v.ho_codigo or "").strip(): v for v in result.scalars().all()}

    async def get_jornada(self, ho_codigo: str) -> Horario | None:
        stmt = select(Horario).where(Horario.ho_codigo == ho_codigo.strip())
        return (await self.db.execute(stmt)).scalars().first()

    async def get_ventana(self, ho_codigo: str) -> ComedorHorarioJornada | None:
        stmt = select(ComedorHorarioJornada).where(
            ComedorHorarioJornada.ho_codigo == ho_codigo.strip()
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def upsert_ventana(
        self,
        *,
        ho_codigo: str,
        hora_inicio: time,
        hora_fin: time,
        empleado_id: int | None,
    ) -> ComedorHorarioJornada:
        codigo = ho_codigo.strip()
        ventana = await self.get_ventana(codigo)
        if ventana is None:
            ventana = ComedorHorarioJornada(ho_codigo=codigo)
            self.db.add(ventana)
        ventana.hora_inicio_comida = hora_inicio
        ventana.hora_fin_comida = hora_fin
        ventana.actualizado_por_empleado_id = empleado_id
        await self.db.commit()
        await self.db.refresh(ventana)
        return ventana