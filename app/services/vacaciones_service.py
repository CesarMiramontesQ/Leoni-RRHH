from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.rh_module_registry import user_has_module
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.repositories.datos_analisis_vacaciones_repository import (
    DatosAnalisisVacacionesRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.vacaciones_repository import VacacionesRepository
from app.schemas.vacaciones import (
    SaldoVacacionesRealResponse,
    VacacionesResponse,
    VacacionesUpdate,
)


async def obtener_saldo_gozo_tress(no_empleado: int) -> float:
    """Saldo real de días de gozo desde datos-analisis (función GET_SALDOS_VACACION).

    Crea un motor efímero de solo lectura y lo desecha. **Bloquea** (levanta
    ``ServiceUnavailableError``) si la BD externa no está configurada o falla, para que el
    llamador no continúe sin un saldo confiable. Devuelve 0.0 si el empleado no tiene periodos.
    """
    engine = DatosAnalisisReadClient.create_read_engine()
    if engine is None:
        raise ServiceUnavailableError(
            "No se pudo verificar el saldo de vacaciones (datos-analisis no configurada)."
        )
    try:
        total = await DatosAnalisisVacacionesRepository(engine).get_saldo_gozo_total(
            cb_codigo=no_empleado
        )
    except SQLAlchemyError as exc:
        raise ServiceUnavailableError(
            f"No se pudo verificar el saldo de vacaciones: {type(exc).__name__}"
        ) from exc
    finally:
        await engine.dispose()
    return float(total) if total is not None else 0.0


class VacacionesService:
    def __init__(self, db: AsyncSession):
        self.repo = VacacionesRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    async def _ensure_puede_ver_empleado(
        self, current_user: Empleado, empleado_id: int
    ) -> None:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        # Acceso global por permiso de módulo (RH con `solicitudes`, o no-RH inscrito
        # con el módulo otorgado): puede ver vacaciones de cualquier empleado.
        if user_has_module(current_user, "solicitudes"):
            return
        if empleado_id == current_user.id:
            return
        if rol in ("director", "gerente", "supervisor"):
            empleado = await self.empleado_repo.get(empleado_id)
            if not empleado:
                raise NotFoundError(entidad="Empleado", id=empleado_id)
            if rol == "supervisor":
                subordinados = await self.empleado_repo.get_subordinados(
                    current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
                )
                if empleado_id not in {e.id for e in subordinados}:
                    raise ForbiddenError(detail="No tienes acceso a este empleado")
                return
            if rol == "gerente":
                equipo = await self.empleado_repo.get_ids_subarbol(
                    current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
                )
                if empleado_id not in equipo:
                    raise ForbiddenError(detail="No tienes acceso a este empleado")
                return
            return
        raise ForbiddenError(detail="No tienes acceso a este empleado")

    async def obtener_saldo(
        self, empleado_id: int, current_user: Empleado
    ) -> VacacionesResponse:
        await self.repo.ensure_empleado_exists(empleado_id)
        await self._ensure_puede_ver_empleado(current_user, empleado_id)
        dias = await self.repo.get_dias_disponibles(empleado_id)
        return VacacionesResponse(empleado_id=empleado_id, dias_disponibles=dias)

    async def obtener_saldo_real(
        self, empleado_id: int, current_user: Empleado
    ) -> SaldoVacacionesRealResponse:
        """Saldo real de días de gozo desde SQL Server datos-analisis (función GET_SALDOS_VACACION)."""
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=empleado_id)
        await self._ensure_puede_ver_empleado(current_user, empleado_id)

        total = await obtener_saldo_gozo_tress(empleado.no_empleado)

        return SaldoVacacionesRealResponse(
            empleado_id=empleado_id,
            no_empleado=empleado.no_empleado,
            saldo_gozo_total=total,
        )

    async def actualizar_saldo(
        self,
        empleado_id: int,
        data: VacacionesUpdate,
        current_user: Empleado,
    ) -> VacacionesResponse:
        if not user_has_module(current_user, "solicitudes"):
            raise ForbiddenError(detail="No tienes permiso para actualizar el saldo de vacaciones")
        await self.repo.ensure_empleado_exists(empleado_id)
        row = await self.repo.establecer(empleado_id, data.dias_disponibles)
        return VacacionesResponse(empleado_id=empleado_id, dias_disponibles=row.dias)
