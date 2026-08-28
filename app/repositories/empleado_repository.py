import logging
from typing import Sequence

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.catalogos import Area
from app.models.empleados import Empleado
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.base import BaseRepository
from app.utils.turno_empleado_match import no_empleado_as_turno_str, turno_empleado_join_on, turno_no_empleado_matches

logger = logging.getLogger(__name__)


def _avisar_ciclo(lider_empleado_id: int, repetidos: set[int]) -> None:
    """Deja rastro del dato corrupto que obligó a cortar el recorrido.

    El sistema ya no se cuelga, pero un `lider_id` en círculo sigue siendo un error de
    la jerarquía que solo RH puede corregir en Bono, y sin este aviso no se notaría.
    """
    if not repetidos:
        return
    logger.warning(
        "Jerarquía cíclica al recorrer el subárbol de %s: %s ya se había expandido "
        "(revisar lider_id en `empleados`)",
        lider_empleado_id,
        sorted(repetidos),
    )


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
            .options(
                selectinload(Empleado.core),
                selectinload(Empleado.puesto),
            )
            .where(func.lower(Empleado.email) == normalized_email)
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

    async def get_nombres_por_empleado_ids(
        self, empleado_ids: Sequence[int]
    ) -> dict[int, tuple[str | None, str | None]]:
        """Mapa `empleado_id` -> (`no_empleado` como str, `nombre`) en una sola
        query. Evita el N+1 de resolver nombres uno por uno (p. ej.
        `HistorialObjetivoService.indice_equipo` para empleados sin eventos de
        bono en el rango). Mismo patrón que
        `MetasRepository.get_nombres_empleados` / `CicloDesempenoRepository.
        get_nombres_empleados`, aquí incluyendo también `no_empleado`."""
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.no_empleado, Empleado.nombre).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
        return {
            eid: (str(no) if no is not None else None, nombre)
            for eid, no, nombre in result.all()
        }

    async def list_no_empleados_filtrados(
        self,
        *,
        empleado_ids_scope: Sequence[int] | None = None,
        empleado_id: int | None = None,
        busqueda: str | None = None,
        area: str | None = None,
    ) -> list[int]:
        """Números de empleado (`CB_CODIGO` en TRESS) que pasan los filtros locales.

        Los nombres y el organigrama viven en Postgres, así que el filtro por
        nombre/área se resuelve aquí y viaja a datos-analisis como lista de
        números. Mismos predicados que `FaltasRetardosRepository._apply_filters`.
        """
        query = select(Empleado.no_empleado).where(Empleado.no_empleado.is_not(None))
        if empleado_ids_scope is not None:
            if not empleado_ids_scope:
                return []
            query = query.where(Empleado.empleado_id.in_(empleado_ids_scope))
        if empleado_id is not None:
            query = query.where(Empleado.empleado_id == empleado_id)
        if busqueda and busqueda.strip():
            term = f"%{busqueda.strip()}%"
            query = query.where(
                or_(
                    Empleado.nombre.ilike(term),
                    cast(Empleado.no_empleado, String).ilike(term),
                )
            )
        if area and area.strip():
            query = query.join(Area, Area.area_id == Empleado.area_id).where(
                func.lower(func.trim(Area.descripcion)) == area.strip().lower()
            )
        result = await self.db.execute(query)
        salida: list[int] = []
        for (no_empleado,) in result.all():
            parsed = self._no_empleado_int(no_empleado)
            if parsed is not None:
                salida.append(parsed)
        return sorted(set(salida))

    async def list_no_empleados_activos(self, estados_activos: Sequence[int]) -> list[int]:
        """Números de empleado (`CB_CODIGO` en TRESS) de los empleados activos.

        Universo del sync de saldos de vacaciones: solo activos, ya que TRESS no tiene
        periodos vigentes para las bajas.
        """
        if not estados_activos:
            return []
        result = await self.db.execute(
            select(Empleado.no_empleado).where(
                Empleado.no_empleado.is_not(None),
                Empleado.estado_id.in_(list(estados_activos)),
            )
        )
        salida: list[int] = []
        for (no_empleado,) in result.all():
            parsed = self._no_empleado_int(no_empleado)
            if parsed is not None:
                salida.append(parsed)
        return sorted(set(salida))

    async def list_plantilla_para_reporte(
        self,
        *,
        estados_activos: Sequence[int],
        empleado_ids_scope: Sequence[int] | None = None,
    ) -> list[tuple[int, str]]:
        """`(no_empleado, nombre)` de la plantilla activa, ordenada por número.

        Universo de renglones del reporte semanal de incidencias: sale una fila por
        empleado aunque no haya tenido nada en las tres semanas. Es **una** consulta con
        el nombre incluido; el reporte nunca vuelve por el nombre empleado por empleado.

        `empleado_ids_scope` es el alcance del usuario (None = sin restricción, como en
        `list_no_empleados_filtrados`): un supervisor descarga a su equipo, RH a todos.
        """
        if not estados_activos:
            return []
        query = select(Empleado.no_empleado, Empleado.nombre).where(
            Empleado.no_empleado.is_not(None),
            Empleado.estado_id.in_(list(estados_activos)),
        )
        if empleado_ids_scope is not None:
            if not empleado_ids_scope:
                return []
            query = query.where(Empleado.empleado_id.in_(list(empleado_ids_scope)))
        result = await self.db.execute(query)

        # Un mismo CB_CODIGO no debería repetirse entre activos, pero si pasara el
        # empleado saldría dos veces en el Excel y el reporte pide un renglón por
        # empleado: se queda el primer nombre no vacío.
        vistos: dict[int, str] = {}
        for no_empleado, nombre in result.all():
            parsed = self._no_empleado_int(no_empleado)
            if parsed is None:
                continue
            limpio = (nombre or "").strip()
            if parsed not in vistos or (not vistos[parsed] and limpio):
                vistos[parsed] = limpio
        return sorted(vistos.items())

    async def map_por_no_empleados(
        self, no_empleados: Sequence[int]
    ) -> dict[int, tuple[int, str | None]]:
        """Mapa `no_empleado` -> (`empleado_id`, `nombre`) para hidratar filas de TRESS."""
        if not no_empleados:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.no_empleado, Empleado.nombre).where(
                Empleado.no_empleado.in_(list({int(n) for n in no_empleados}))
            )
        )
        salida: dict[int, tuple[int, str | None]] = {}
        for empleado_id, no_empleado, nombre in result.all():
            parsed = self._no_empleado_int(no_empleado)
            if parsed is not None:
                salida[parsed] = (int(empleado_id), nombre)
        return salida

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
        self,
        lider_empleado_id: int,
        estados_activos: list[int],
        *,
        atravesar_inactivos: bool = False,
        max_niveles: int | None = None,
    ) -> set[int]:
        """
        IDs locales (PK) de empleados activos bajo el líder identificado por ``empleado_id``.

        Con ``atravesar_inactivos`` el recorrido baja también por líderes intermedios
        que no están activos (una baja en medio de la cadena no esconde a su gente);
        el resultado sigue conteniendo solo empleados activos.

        ``max_niveles`` corta el recorrido a N niveles bajo el líder (1 = solo
        directos). None = sin límite. Un líder inactivo ocupa su nivel igual.
        """
        if not estados_activos:
            return set()
        if max_niveles is not None and max_niveles < 1:
            return set()
        collected: set[int] = set()
        expandidos: set[int] = set()
        frontier: set[int] = {lider_empleado_id}
        nivel = 0
        while frontier:
            if max_niveles is not None and nivel >= max_niveles:
                break
            nivel += 1
            expandidos |= frontier
            query = select(Empleado.id, Empleado.empleado_id, Empleado.estado_id).where(
                Empleado.lider_id.in_(frontier)
            )
            if not atravesar_inactivos:
                query = query.where(Empleado.estado_id.in_(estados_activos))
            result = await self.db.execute(query)
            rows = result.all()
            if not rows:
                break
            next_frontier: set[int] = set()
            repetidos: set[int] = set()
            for local_id, emp_id, estado_id in rows:
                if estado_id in estados_activos:
                    collected.add(local_id)
                # Sin esto, una jerarquía cíclica (A → B → C → A, o alguien puesto
                # como líder de sí mismo) devuelve la frontera a nodos ya expandidos
                # y el bucle consulta la BD para siempre. `lider_id` es dato de Bono:
                # el ciclo se corta aquí, no se puede confiar en que no exista.
                if int(emp_id) in expandidos:
                    repetidos.add(int(emp_id))
                else:
                    next_frontier.add(int(emp_id))
            _avisar_ciclo(lider_empleado_id, repetidos)
            frontier = next_frontier
        return collected

    async def get_by_ids_con_area(self, ids: list[int]) -> list[Empleado]:
        """Empleados por PK con `area` precargada (evita lazy-load en contexto async)."""
        if not ids:
            return []
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.area))
            .where(Empleado.id.in_(ids))
        )
        return list(result.scalars().all())

    async def get_ids_subarbol_sin_filtro_estado(self, lider_empleado_id: int) -> set[int]:
        """Subárbol bajo ``lider_empleado_id`` (cualquier estado); retorna IDs locales."""
        collected: set[int] = set()
        expandidos: set[int] = set()
        frontier: set[int] = {lider_empleado_id}
        while frontier:
            expandidos |= frontier
            result = await self.db.execute(
                select(Empleado.id, Empleado.empleado_id).where(
                    Empleado.lider_id.in_(frontier)
                )
            )
            rows = result.all()
            if not rows:
                break
            next_frontier: set[int] = set()
            repetidos: set[int] = set()
            for local_id, emp_id in rows:
                collected.add(local_id)
                # Mismo corte de ciclos que en `get_ids_subarbol`: sin filtro de estado
                # el recorrido alcanza aún más nodos, así que la guarda importa más.
                if int(emp_id) in expandidos:
                    repetidos.add(int(emp_id))
                else:
                    next_frontier.add(int(emp_id))
            _avisar_ciclo(lider_empleado_id, repetidos)
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
            .outerjoin(TurnoEmpleado, turno_empleado_join_on())
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
            .outerjoin(TurnoEmpleado, turno_empleado_join_on())
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                or_(TurnoEmpleado.id.is_(None), TurnoEmpleado.comedor.is_(None)),
            )
            .order_by(Empleado.nombre.asc())
        )
        return list(result.scalars().unique().all())

    async def comedores_por_no_empleado(
        self, no_empleados: Sequence[int]
    ) -> dict[int, int | None]:
        """Comedor asignado en `turnos_empleados`, indexado por número de empleado.

        Consulta en bloque para no hacer una query por fila del buscador. Se buscan las
        dos variantes del número («123» y «123.0») porque la columna es texto y arrastra
        el formato de los listados de Excel — mismo criterio que `turno_no_empleado_matches`.
        """
        if not no_empleados:
            return {}
        variantes: list[str] = []
        for numero in no_empleados:
            base = no_empleado_as_turno_str(numero)
            variantes.extend((base, f"{base}.0"))

        result = await self.db.execute(
            select(TurnoEmpleado.no_empleado, TurnoEmpleado.comedor).where(
                TurnoEmpleado.no_empleado.in_(variantes)
            )
        )
        comedores: dict[int, int | None] = {}
        for no_str, comedor_id in result.all():
            try:
                clave = int(float(no_str))
            except (TypeError, ValueError):
                continue
            # Si hay filas duplicadas por el formato, gana la que sí trae comedor.
            if comedor_id is not None or clave not in comedores:
                comedores[clave] = comedor_id
        return comedores

    async def asignar_comedor_en_turno(
        self,
        *,
        no_empleado: str,
        nombre: str,
        comedor_id: int,
        clasificacion: str | None = None,
    ) -> None:
        """Crea o actualiza `turnos_empleados` con el comedor indicado.

        Solo toca el comedor: **el turno se deja vacío** y lo llena el sync de las 04:20
        desde `dbo.COLABORA`. Antes se escribía `"G1"` fijo, lo que hacía pasar por turno
        real un valor inventado y, ahora que de él depende la ventana de comida, le habría
        asignado a esa persona el horario de otra rotación.
        """
        no_int = self._no_empleado_int(no_empleado)
        if no_int is None:
            raise ValueError(f"no_empleado inválido: {no_empleado!r}")
        no_turno = no_empleado_as_turno_str(no_int)
        result = await self.db.execute(
            select(TurnoEmpleado).where(turno_no_empleado_matches(no_int))
        )
        turno = result.scalar_one_or_none()
        if turno is None:
            self.db.add(
                TurnoEmpleado(
                    no_empleado=no_turno,
                    nombre=nombre,
                    clasificacion=clasificacion,
                    comedor=comedor_id,
                    turno=None,
                    tu_codigo=None,
                )
            )
        else:
            turno.comedor = comedor_id
            if nombre.strip():
                turno.nombre = nombre.strip()
        await self.db.flush()
