from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.vacaciones_repository import VacacionesRepository
from app.schemas.vacaciones import VacacionesResponse, VacacionesUpdate


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
        row = await self.repo.get_or_create(empleado_id)
        return VacacionesResponse.model_validate(row)

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
        return VacacionesResponse.model_validate(row)
