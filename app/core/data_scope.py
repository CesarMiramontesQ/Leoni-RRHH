"""Alcance efectivo de datos según rol y modo UI RH."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.rh_ui_mode import effective_solicitud_scope_rol

if TYPE_CHECKING:
    from app.models.empleados import Empleado
    from app.repositories.empleado_repository import EmpleadoRepository


def effective_data_scope_rol(user: "Empleado", rh_ui_mode: str | None = None) -> str:
    """Rol efectivo para filtrar datos. El valor ``rh`` = vista plantilla completa (admin operativo o legacy), no el rol JWT."""
    return effective_solicitud_scope_rol(user, rh_ui_mode)


def effective_data_scope_for_module(
    user: "Empleado", module_key: str, rh_ui_mode: str | None = None
) -> str:
    """Scope de datos elevado por permiso de módulo RH.

    Modelo de permisos RH: un módulo otorgado da **vista global** (``"rh"``),
    no acotada por el rol base. Solo se eleva a un **no-admin con rol base
    distinto de "rh"** que tenga ``module_key`` otorgado; el admin y los usuarios
    con rol legacy "rh" conservan el alcance de su modo simulado (ya resuelto por
    ``effective_data_scope_rol``: p.ej. RH en Modo Empleado ve solo lo suyo).
    """
    from app.core.rh_module_registry import user_has_module
    from app.core.rh_ui_mode import is_admin_user

    scope = effective_data_scope_rol(user, rh_ui_mode)
    if scope == "rh":
        return scope
    rol = user.rol.nombre if user.rol else "empleado"
    if rol != "rh" and not is_admin_user(user) and user_has_module(user, module_key):
        return "rh"
    return scope


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
    if scope in ("supervisor", "gerente"):
        # Supervisor y gerente ven todo su subárbol. Un líder intermedio de baja
        # no esconde a su gente (mismo criterio que Horas Extra y el listado de
        # solicitudes del gerente).
        if alcance_todos_los_estados:
            subarbol = await empleado_repo.get_ids_subarbol_sin_filtro_estado(user.empleado_id)
        else:
            subarbol = await empleado_repo.get_ids_subarbol(
                user.empleado_id, estados, atravesar_inactivos=True
            )
        return list(subarbol) + [user.id]
    return [user.id]


async def empleado_ids_scope_por_modulo(
    empleado_repo: "EmpleadoRepository",
    current_user: "Empleado",
    module_key: str,
    rh_ui_mode: str | None,
) -> list[int] | None:
    """IDs de empleados visibles por scope de equipo, elevado por módulo RH.

    Centraliza la lógica hoy triplicada como ``_empleado_ids_scope`` en
    ``IncidenciaFuentesService``, ``FaltasRetardosService`` y
    ``ViajesLaboralesService`` (replicada aquí sin cambios de comportamiento).

    Usa ``effective_data_scope_for_module`` (scope elevado a ``"rh"`` si el
    usuario tiene ``module_key`` otorgado) para decidir:
    - ``None`` si el scope efectivo es ``"director"`` o ``"rh"`` (universo,
      sin restricción).
    - supervisor / gerente → subárbol completo (``get_ids_subarbol``) + él mismo.
    - resto (empleado base) → solo ``[current_user.empleado_id]``.

    Recibe ``empleado_repo`` (no ``db``) para que el caller controle la
    sesión/instancia del repositorio, igual que hacen las tres copias
    existentes.
    """
    scope = effective_data_scope_for_module(current_user, module_key, rh_ui_mode)
    if scope in ("director", "rh"):
        return None
    if scope in ("supervisor", "gerente"):
        equipo = await empleado_repo.get_ids_subarbol(
            current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS, atravesar_inactivos=True
        )
        return list(equipo) + [current_user.empleado_id]
    return [current_user.empleado_id]


async def equipo_empleado_ids_comedor(
    empleado_repo: "EmpleadoRepository",
    user: "Empleado",
    rh_ui_mode: str | None = None,
) -> set[int]:
    """Subconjunto de empleados para consultas de comedor de equipo."""
    scope = effective_data_scope_rol(user, rh_ui_mode)
    if scope in ("supervisor", "gerente"):
        ids = await empleado_repo.get_ids_subarbol(
            user.empleado_id, settings.ESTADOS_ACTIVOS_IDS, atravesar_inactivos=True
        )
        ids.add(user.id)
        return ids
    return set()
