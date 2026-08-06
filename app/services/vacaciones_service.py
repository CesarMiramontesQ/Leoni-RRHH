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
from app.repositories.vacaciones_disponibles_repository import (
    VacacionesDisponiblesRepository,
)
from app.schemas.vacaciones import SaldoVacacionesRealResponse


async def obtener_saldo_gozo_cache(db: AsyncSession, no_empleado: int) -> float:
    """Saldo de días de gozo desde la caché en Bono (`levelup_vacaciones_disponibles`).

    Fuente única de lectura del sistema: la escribe el sync desde TRESS (job diario de las
    06:00 y aprobación de vacaciones), de modo que ninguna carga de página tiene que esperar
    a la BD externa. **Bloquea** (``ServiceUnavailableError``) si el empleado todavía no se
    ha sincronizado, en vez de fingir un 0 que parecería un saldo real.
    """
    fila = await VacacionesDisponiblesRepository(db).get_by_no_empleado(no_empleado)
    if fila is None:
        raise ServiceUnavailableError(
            "El saldo de vacaciones de este empleado aún no se ha sincronizado. "
            "Se actualiza automáticamente cada día; si persiste, contacta a RH."
        )
    return float(fila.dias_disponibles)


async def obtener_saldo_gozo_tress(no_empleado: int) -> float:
    """Saldo real de días de gozo desde datos-analisis (función GET_SALDOS_VACACION).

    Crea un motor efímero de solo lectura y lo desecha. **Bloquea** (levanta
    ``ServiceUnavailableError``) si la BD externa no está configurada o falla, para que el
    llamador no continúe sin un saldo confiable. Devuelve 0.0 si el empleado no tiene periodos.

    Solo lo usa el servicio de sincronización; la aplicación lee de
    ``obtener_saldo_gozo_cache``.
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

    async def obtener_saldo_real(
        self, empleado_id: int, current_user: Empleado
    ) -> SaldoVacacionesRealResponse:
        """Saldo de días de gozo desde la caché en Bono, sincronizada desde TRESS.

        Sin consultas a datos-analisis: el dato se refresca en el job de las 06:00 y al
        aprobar vacaciones.
        """
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=empleado_id)
        await self._ensure_puede_ver_empleado(current_user, empleado_id)

        total = await obtener_saldo_gozo_cache(self.db, empleado.no_empleado)

        return SaldoVacacionesRealResponse(
            empleado_id=empleado_id,
            no_empleado=empleado.no_empleado,
            saldo_gozo_total=total,
        )

