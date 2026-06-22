from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.empleados_rh import EmpleadoCore
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.base import BaseRepository


class EmpleadoRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    @staticmethod
    def _no_empleado_int(no_empleado) -> int | None:
        """no_empleado es entero en Bono. Acepta '25', '25.0', 25 → 25."""
        if no_empleado is None:
            return None
        try:
            return int(str(no_empleado).strip().split(".")[0])
        except (ValueError, TypeError):
            return None

    async def get_by_email(self, email: str) -> Empleado | None:
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            return None
        result = await self.db.execute(
            select(Empleado)
            .join(EmpleadoCore, EmpleadoCore.empleado_id == Empleado.empleado_id)
            .options(
                selectinload(Empleado.core),
                selectinload(Empleado.puesto),
            )
            .where(func.lower(EmpleadoCore.email) == normalized_email)
        )
        return result.scalar_one_or_none()

    async def get_by_usuario(self, usuario: str) -> Empleado | None:
        u = usuario.strip()
        if not u:
            return None
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.core),
                selectinload(Empleado.puesto),
            )
            .where(
                Empleado.usuario.isnot(None),
                func.lower(Empleado.usuario) == u.lower(),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_no_empleado(self, no_empleado: str) -> Empleado | None:
        val = self._no_empleado_int(no_empleado)
        if val is None:
            return None
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.core),
                selectinload(Empleado.puesto),
            )
            .where(Empleado.no_empleado == val)
        )
        return result.scalar_one_or_none()

    async def get_by_no_empleado_con_puesto_y_lider(self, no_empleado: str) -> Empleado | None:
        """Mismo criterio de búsqueda que `get_by_no_empleado`, con puesto y líder cargados."""
        val = self._no_empleado_int(no_empleado)
        if val is None:
            return None
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.puesto),
                selectinload(Empleado.lider),
            )
            .where(Empleado.no_empleado == val)
        )
        return result.scalar_one_or_none()

    async def get_by_empleado_id(self, empleado_id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado).where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.core), selectinload(Empleado.puesto))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_with_area_y_lider(self, id: int) -> Empleado | None:
        """Carga explícita para armar respuestas API sin lazy load (async)."""
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.area),
                selectinload(Empleado.lider),
                selectinload(Empleado.puesto),
            )
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_with_clasificacion(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.clasificacion))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_with_rol_by_empleado_id(self, empleado_id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.core))
            .where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_subordinados(
        self, lider_empleado_id: int, estados_activos: list[int]
    ) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado).where(
                Empleado.lider_id == lider_empleado_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())

    async def get_ids_subarbol(
        self, lider_empleado_id: int, estados_activos: list[int]
    ) -> set[int]:
        """
        IDs locales (PK) de empleados activos bajo el líder identificado por ``empleado_id``.
        """
        if not estados_activos:
            return set()
        collected: set[int] = set()
        frontier: set[int] = {lider_empleado_id}
        while frontier:
            result = await self.db.execute(
                select(Empleado.id, Empleado.empleado_id).where(
                    Empleado.lider_id.in_(frontier),
                    Empleado.estado_id.in_(estados_activos),
                )
            )
            rows = result.all()
            if not rows:
                break
            next_frontier: set[int] = set()
            for local_id, emp_id in rows:
                collected.add(local_id)
                next_frontier.add(int(emp_id))
            frontier = next_frontier
        return collected

    async def get_subordinados_directos_ids(self, lider_empleado_id: int) -> list[int]:
        """IDs locales de reportes directos (``lider_id`` = ``empleado_id`` del jefe)."""
        result = await self.db.execute(
            select(Empleado.id).where(Empleado.lider_id == lider_empleado_id)
        )
        return [row[0] for row in result.all()]

    async def get_ids_subarbol_sin_filtro_estado(self, lider_empleado_id: int) -> set[int]:
        """Subárbol bajo ``lider_empleado_id`` (cualquier estado); retorna IDs locales."""
        collected: set[int] = set()
        frontier: set[int] = {lider_empleado_id}
        while frontier:
            result = await self.db.execute(
                select(Empleado.id, Empleado.empleado_id).where(
                    Empleado.lider_id.in_(frontier)
                )
            )
            rows = result.all()
            if not rows:
                break
            next_frontier: set[int] = set()
            for local_id, emp_id in rows:
                collected.add(local_id)
                next_frontier.add(int(emp_id))
            frontier = next_frontier
        return collected

    async def get_primer_gerente_en_cadena(self, empleado_local_id: int) -> Empleado | None:
        """
        Recorre ``lider_id`` (``empleado_id`` del jefe) hacia arriba y devuelve el primer gerente.
        """
        seen: set[int] = set()
        current = await self.get_with_rol(empleado_local_id)
        while current and current.id not in seen:
            seen.add(current.id)
            if not current.lider_id:
                return None
            parent = await self.get_with_rol_by_empleado_id(current.lider_id)
            if not parent:
                return None
            if parent.rol and parent.rol.nombre == "gerente":
                return parent
            current = parent
        return None

    async def empleado_tiene_como_ancestro(
        self, empleado_local_id: int, posible_ancestro_local_id: int
    ) -> bool:
        """True si el ``empleado_id`` del ancestro aparece en la cadena de ``lider_id``."""
        ancestro = await self.get_with_rol(posible_ancestro_local_id)
        if not ancestro:
            return False
        ancestro_empleado_id = int(ancestro.empleado_id)
        seen: set[int] = set()
        current_id: int | None = empleado_local_id
        while current_id is not None and current_id not in seen:
            seen.add(current_id)
            emp = await self.get_with_rol(current_id)
            if not emp or not emp.lider_id:
                return False
            if int(emp.lider_id) == ancestro_empleado_id:
                return True
            parent = await self.get_by_empleado_id(emp.lider_id)
            current_id = parent.id if parent else None
        return False

    async def count_activos_sin_comedor_asignado(self) -> int:
        """Empleados activos sin fila en turnos o con `turnos_empleados.comedor` nulo."""
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .outerjoin(TurnoEmpleado, TurnoEmpleado.no_empleado == Empleado.no_empleado)
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                or_(TurnoEmpleado.id.is_(None), TurnoEmpleado.comedor.is_(None)),
            )
        )
        return int(result.scalar_one() or 0)

    async def list_activos_sin_comedor_asignado(self) -> list[Empleado]:
        """Empleados activos sin comedor en turnos (sin fila o `comedor` nulo)."""
        result = await self.db.execute(
            select(Empleado)
            .outerjoin(TurnoEmpleado, TurnoEmpleado.no_empleado == Empleado.no_empleado)
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                or_(TurnoEmpleado.id.is_(None), TurnoEmpleado.comedor.is_(None)),
            )
            .order_by(Empleado.nombre.asc())
        )
        return list(result.scalars().unique().all())

    async def asignar_comedor_en_turno(
        self,
        *,
        no_empleado: str,
        nombre: str,
        comedor_id: int,
        clasificacion: str | None = None,
    ) -> None:
        """Crea o actualiza `turnos_empleados` con el comedor indicado."""
        result = await self.db.execute(
            select(TurnoEmpleado).where(TurnoEmpleado.no_empleado == no_empleado)
        )
        turno = result.scalar_one_or_none()
        if turno is None:
            self.db.add(
                TurnoEmpleado(
                    no_empleado=no_empleado,
                    nombre=nombre,
                    clasificacion=clasificacion,
                    comedor=comedor_id,
                    turno="G1",
                )
            )
        else:
            turno.comedor = comedor_id
            if nombre.strip():
                turno.nombre = nombre.strip()
        await self.db.flush()
