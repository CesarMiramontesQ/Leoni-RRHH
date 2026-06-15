"""
Registro central de módulos/páginas accesibles por usuarios RH.

Agregar un módulo aquí es suficiente para exponerlo en catálogo API,
validación middleware y UI de administración (vía GET /rh-permisos/modulos).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterable

from app.core.rh_gestor_registry import resolve_rh_gestor_alcance

if TYPE_CHECKING:
    from app.models.empleados import Empleado


@dataclass(frozen=True)
class RhModuleDef:
    key: str
    label: str
    group: str
    nav_item_ids: tuple[str, ...]
    hash_prefixes: tuple[str, ...]
    api_prefixes: tuple[str, ...]


RH_MODULES: dict[str, RhModuleDef] = {
    "dashboard": RhModuleDef(
        key="dashboard",
        label="Dashboard",
        group="General",
        nav_item_ids=("dashboard",),
        hash_prefixes=("#/",),
        api_prefixes=("/api/v1/bono-productividad",),
    ),
    "organigrama": RhModuleDef(
        key="organigrama",
        label="Organigrama",
        group="General",
        nav_item_ids=("organigrama",),
        hash_prefixes=("#/organigrama",),
        api_prefixes=("/api/v1/organigrama",),
    ),
    "empleados": RhModuleDef(
        key="empleados",
        label="Empleados",
        group="General",
        nav_item_ids=("empleados",),
        hash_prefixes=("#/empleados",),
        api_prefixes=("/api/v1/empleados", "/api/v1/usuarios"),
    ),
    "metricas": RhModuleDef(
        key="metricas",
        label="Métricas",
        group="Laborales",
        nav_item_ids=("metricas",),
        hash_prefixes=("#/metricas",),
        api_prefixes=("/api/v1/reportes",),
    ),
    "solicitudes": RhModuleDef(
        key="solicitudes",
        label="Solicitudes (gestión RH)",
        group="Laborales",
        nav_item_ids=("solicitudes",),
        hash_prefixes=("#/solicitudes",),
        api_prefixes=("/api/v1/solicitudes",),
    ),
    "incidencias": RhModuleDef(
        key="incidencias",
        label="Incidencias",
        group="Laborales",
        nav_item_ids=("incidencias",),
        hash_prefixes=("#/incidencias",),
        api_prefixes=("/api/v1/incidencias",),
    ),
    "actas": RhModuleDef(
        key="actas",
        label="Actas",
        group="Laborales",
        nav_item_ids=("actas",),
        hash_prefixes=("#/actas",),
        api_prefixes=("/api/v1/actas",),
    ),
    "comedor": RhModuleDef(
        key="comedor",
        label="Comedor (gestión RH)",
        group="Comedor",
        nav_item_ids=("comedor",),
        hash_prefixes=("#/comedor/gestion", "#/comedor/planear", "#/comedor/codigos-externos"),
        api_prefixes=(
            "/api/v1/comedor/rh",
            "/api/v1/comedor/accesos/rh",
            "/api/v1/comedor/comedores",
            "/api/v1/comedor/menus",
            "/api/v1/comedor/codigos-externos",
        ),
    ),
    "reportes": RhModuleDef(
        key="reportes",
        label="Reporte Comedor",
        group="Comedor",
        nav_item_ids=("reportes",),
        hash_prefixes=("#/comedor/reporte", "#/reportes"),
        api_prefixes=(
            "/api/v1/comedor/estadisticas",
            "/api/v1/comedor/proyecciones",
        ),
    ),
    "nominas": RhModuleDef(
        key="nominas",
        label="Nóminas",
        group="Nóminas",
        nav_item_ids=(
            "nominas",
            "horas-extra",
            "horas-extra-aprobaciones",
            "conciliacion",
            "nominas-ajustes",
        ),
        hash_prefixes=("#/nominas",),
        api_prefixes=("/api/v1/nominas",),
    ),
    "puestos": RhModuleDef(
        key="puestos",
        label="Perfiles de Puesto",
        group="Talento",
        nav_item_ids=("puestos",),
        hash_prefixes=("#/puestos",),
        api_prefixes=(
            "/api/v1/puestos-perfil",
            "/api/v1/perfiles",
            "/api/v1/cualificaciones-catalogo",
            "/api/v1/niveles-puesto",
            "/api/v1/grados-puesto",
            "/api/v1/metodos-calificacion-competencia",
            "/api/v1/grupos-competencia",
        ),
    ),
    "tareas-catalogo": RhModuleDef(
        key="tareas-catalogo",
        label="Catálogo de Tareas",
        group="Talento",
        nav_item_ids=("tareas-catalogo",),
        hash_prefixes=("#/tareas-catalogo",),
        api_prefixes=("/api/v1/tareas-catalogo",),
    ),
    "competencias": RhModuleDef(
        key="competencias",
        label="Matriz de Competencias",
        group="Talento",
        nav_item_ids=("competencias",),
        hash_prefixes=("#/competencias",),
        api_prefixes=("/api/v1/competencias",),
    ),
    "evaluaciones": RhModuleDef(
        key="evaluaciones",
        label="Evaluaciones",
        group="Talento",
        nav_item_ids=("evaluaciones",),
        hash_prefixes=("#/evaluaciones",),
        api_prefixes=("/api/v1/evaluaciones",),
    ),
    "capacitaciones": RhModuleDef(
        key="capacitaciones",
        label="Capacitaciones",
        group="Talento",
        nav_item_ids=("capacitaciones",),
        hash_prefixes=("#/capacitaciones",),
        api_prefixes=("/api/v1/capacitaciones",),
    ),
    "level-up": RhModuleDef(
        key="level-up",
        label="Level Up",
        group="Level Up",
        nav_item_ids=("level-up",),
        hash_prefixes=("#/level-up",),
        api_prefixes=("/api/v1/level-up",),
    ),
    "capacidades": RhModuleDef(
        key="capacidades",
        label="Matriz de Multihabilidades",
        group="Level Up",
        nav_item_ids=("capacidades",),
        hash_prefixes=("#/capacidades",),
        api_prefixes=("/api/v1/competencias/multihabilidades",),
    ),
    "cursos": RhModuleDef(
        key="cursos",
        label="Manejo de Cursos",
        group="Level Up",
        nav_item_ids=("cursos",),
        hash_prefixes=("#/cursos",),
        api_prefixes=(),
    ),
    "opls": RhModuleDef(
        key="opls",
        label="Manejo de OPLs",
        group="Level Up",
        nav_item_ids=("opls",),
        hash_prefixes=("#/opls",),
        api_prefixes=(),
    ),
    "evidencias": RhModuleDef(
        key="evidencias",
        label="Motor de Evidencias",
        group="Level Up",
        nav_item_ids=("evidencias",),
        hash_prefixes=("#/evidencias",),
        api_prefixes=(),
    ),
    "sugerencias": RhModuleDef(
        key="sugerencias",
        label="Motor de Sugerencias",
        group="Level Up",
        nav_item_ids=("sugerencias",),
        hash_prefixes=("#/sugerencias",),
        api_prefixes=(),
    ),
    "encuestas": RhModuleDef(
        key="encuestas",
        label="Encuestas Post Curso",
        group="Level Up",
        nav_item_ids=("encuestas",),
        hash_prefixes=("#/encuestas",),
        api_prefixes=(),
    ),
}

# Orden de grupos en UI de administración
RH_MODULE_GROUP_ORDER: tuple[str, ...] = (
    "General",
    "Laborales",
    "Comedor",
    "Nóminas",
    "Talento",
    "Level Up",
)

# Rutas API exentas de control por módulo (transversales o propias del sistema de permisos)
RH_MODULE_EXEMPT_API_PREFIXES: tuple[str, ...] = (
    "/api/v1/auth",
    "/api/v1/notificaciones",
    "/api/v1/rh-permisos",
)

# Autoservicio RH: siempre permitido sin módulo de gestión (modo empleado / uso personal)
RH_SELF_SERVICE_API_PREFIXES: tuple[str, ...] = (
    "/api/v1/solicitudes",
    "/api/v1/comedor/mi-comedor-asignado",
    "/api/v1/comedor/accesos/mis-reservas",
    "/api/v1/comedor/accesos/mis-proximas-reservas",
    "/api/v1/comedor/accesos/mis-fechas-ocupadas",
    "/api/v1/comedor/accesos/primera-fecha-permitida",
    "/api/v1/comedor/registro",
    "/api/v1/bono-productividad",
)


def all_module_keys() -> list[str]:
    return list(RH_MODULES.keys())


def is_valid_module_key(key: str) -> bool:
    return key in RH_MODULES


def effective_modules(modulos_rh: dict | None) -> dict[str, bool]:
    """Vacío o null → acceso completo (compatibilidad retroactiva RH sin configurar)."""
    if not modulos_rh:
        return {key: True for key in all_module_keys()}
    return {key: bool(modulos_rh.get(key, False)) for key in all_module_keys()}


def has_personalized_modulos_rh(empleado: "Empleado") -> bool:
    """True si el RH tiene restricciones explícitas guardadas en modulos_rh."""
    modulos = getattr(empleado, "modulos_rh", None) or {}
    return bool(modulos)


def is_modulos_rh_enrolled(empleado: "Empleado") -> bool:
    """Usuario incluido en el sistema de permisos por módulo.

    RH siempre está inscrito; usuarios de otros roles quedan inscritos cuando RH
    los agrega explícitamente (flag ``inscrito_modulos_rh``), sin cambiar su rol.
    """
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    if rol == "rh":
        return True
    return bool(getattr(empleado, "inscrito_modulos_rh", False))


def effective_modules_for_display(empleado: "Empleado") -> dict[str, bool]:
    """Permisos efectivos para UI de administración."""
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if rol == "rh" and not modulos:
        return {key: True for key in all_module_keys()}
    return {key: bool(modulos.get(key, False)) for key in all_module_keys()}


def empty_modulos_rh_config() -> dict[str, bool]:
    return {key: False for key in all_module_keys()}


def user_has_module(empleado: "Empleado", module_key: str) -> bool:
    if not is_valid_module_key(module_key):
        return False
    if getattr(empleado, "puede_administrar_permisos_rh", False):
        return True
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if rol == "rh":
        if not modulos:
            return True
        return bool(modulos.get(module_key, False))
    # Roles distintos a RH: acceso aditivo sólo si fueron inscritos por RH y el
    # módulo les fue otorgado explícitamente.
    if is_modulos_rh_enrolled(empleado):
        return bool(modulos.get(module_key, False))
    return False


def _path_matches_prefix(path: str, prefix: str) -> bool:
    if path == prefix:
        return True
    if prefix.endswith("/"):
        return path.startswith(prefix)
    return path.startswith(prefix + "/") or path.startswith(prefix)


def is_rh_self_service_api_path(path: str) -> bool:
    """Rutas de uso personal para colaboradores RH (sin permiso de módulo de gestión)."""
    return any(_path_matches_prefix(path, prefix) for prefix in RH_SELF_SERVICE_API_PREFIXES)


def resolve_module_from_api_path(path: str) -> str | None:
    if any(_path_matches_prefix(path, exempt) for exempt in RH_MODULE_EXEMPT_API_PREFIXES):
        return None

    best_key: str | None = None
    best_len = -1
    for mod in RH_MODULES.values():
        for prefix in mod.api_prefixes:
            if _path_matches_prefix(path, prefix) and len(prefix) > best_len:
                best_key = mod.key
                best_len = len(prefix)
    return best_key


def resolve_module_from_hash(hash_value: str) -> str | None:
    h = (hash_value or "#/").strip()
    if h in ("", "#", "#/"):
        return "dashboard"

    best_key: str | None = None
    best_len = -1
    for mod in RH_MODULES.values():
        for prefix in mod.hash_prefixes:
            if prefix in ("#/",):
                continue
            if h == prefix or h.startswith(prefix + "/") or h.startswith(prefix):
                if len(prefix) > best_len:
                    best_key = mod.key
                    best_len = len(prefix)
    return best_key


def nav_item_to_module_key(nav_item_id: str) -> str | None:
    for mod in RH_MODULES.values():
        if nav_item_id in mod.nav_item_ids:
            return mod.key
    return None


def catalog_for_api() -> list[dict]:
    """Catálogo serializable para GET /rh-permisos/modulos."""
    items: list[dict] = []
    for group in RH_MODULE_GROUP_ORDER:
        for mod in RH_MODULES.values():
            if mod.group == group:
                items.append(
                    {
                        "key": mod.key,
                        "label": mod.label,
                        "group": mod.group,
                        "nav_item_ids": list(mod.nav_item_ids),
                    }
                )
    return items


def rh_claims_for_token(empleado: "Empleado") -> dict:
    """Claims JWT para permisos por módulo (solo rol RH)."""
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if rol != "rh":
        return {}

    claims: dict = {
        "rh_admin": bool(getattr(empleado, "puede_administrar_permisos_rh", False)),
        "rh_enrolled": True,
    }
    if modulos:
        claims["rh_modulos"] = effective_modules(modulos)
    alcance = resolve_rh_gestor_alcance(empleado)
    if alcance:
        claims["rh_gestor_alcance"] = alcance
    return claims


def jwt_module_guard_applies(payload: dict) -> bool:
    """Indica si el middleware debe evaluar permisos de módulo."""
    if payload.get("rh_admin"):
        return False
    if payload.get("rol") == "rh":
        return True
    return bool(payload.get("rh_enrolled"))


def user_has_module_from_claims(
    payload: dict,
    module_key: str,
    rh_ui_mode: str | None = None,
) -> bool:
    if payload.get("rh_admin"):
        return True
    rol = payload.get("rol")
    modulos = payload.get("rh_modulos")

    if rol == "rh":
        from app.core.rh_ui_mode import (
            RH_UI_MODE_LIDER,
            RH_UI_MODE_GERENTE,
            RH_UI_MODE_OPERATIVO,
            effective_rh_ui_mode,
        )

        mode = effective_rh_ui_mode(rh_ui_mode)
        if mode in (RH_UI_MODE_LIDER, RH_UI_MODE_GERENTE):
            return True
        if payload.get("rh_gestor_alcance") and mode == RH_UI_MODE_OPERATIVO:
            return True

    if rol == "rh" and modulos is None:
        return True
    if not payload.get("rh_enrolled"):
        return True
    if not isinstance(modulos, dict):
        return False
    return bool(modulos.get(module_key, False))


def validate_modulos_rh_keys(keys: Iterable[str]) -> list[str]:
    """Retorna keys inválidas."""
    return [k for k in keys if not is_valid_module_key(k)]
