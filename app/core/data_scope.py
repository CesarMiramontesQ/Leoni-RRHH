"""Alcance efectivo de datos según rol y modo UI RH."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.rh_ui_mode import effective_solicitud_scope_rol

if TYPE_CHECKING:
    from app.models.empleados import Empleado
    from app.repositories.empleado_repository import EmpleadoRepository


def effective_data_scope_rol(user: "Empleado", rh_ui_mode: str | None = None) -> str:
    """Rol efectivo para filtrar incidencias, empleados, comedor y métricas."""
    return effective_solicitud_scope_rol(user, rh_ui_mode)


async def empleado_ids_en_alcance(
    empleado_repo: "EmpleadoRepository",
    user: "Empleado",
    rh_ui_mode: str | None = None,
    *,
    alcance_todos_los_estados: bool = False,
) -> list[int] | None:
    """
    IDs de empleados visibles para el usuario.
    None = sin restricción (RH operativo, director).
    """
    scope = effective_data_scope_rol(user, rh_ui_mode)
    estados = settings.ESTADOS_ACTIVOS_IDS

    if scope in ("rh", "director"):
        return None
    if scope == "empleado":
        return [user.id]
    if scope == "supervisor":
        if alcance_todos_los_estados:
            directos = await empleado_repo.get_subordinados_directos_ids(user.empleado_id)
            return directos + [user.id]
        subordinados = await empleado_repo.get_subordinados(user.empleado_id, estados)
        return [e.id for e in subordinados] + [user.id]
    if scope == "gerente":
        if alcance_todos_los_estados:
            subarbol = await empleado_repo.get_ids_subarbol_sin_filtro_estado(user.empleado_id)
        else:
            subarbol = await empleado_repo.get_ids_subarbol(user.empleado_id, estados)
        return list(subarbol) + [user.id]
    return [user.id]


async def equipo_empleado_ids_comedor(
    empleado_repo: "EmpleadoRepository",
    user: "Empleado",
    rh_ui_mode: str | None = None,
) -> set[int]:
    """Subconjunto de empleados para consultas de comedor de equipo."""
    scope = effective_data_scope_rol(user, rh_ui_mode)
    if scope == "supervisor":
        subordinados = await empleado_repo.get_subordinados(
            user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
        )
        ids = {e.id for e in subordinados}
        ids.add(user.id)
        return ids
    if scope == "gerente":
        ids = await empleado_repo.get_ids_subarbol(user.empleado_id, settings.ESTADOS_ACTIVOS_IDS)
        ids.add(user.id)
        return ids
    return set()
