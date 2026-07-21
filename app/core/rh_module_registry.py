"""
Registro central de módulos/páginas accesibles por usuarios RH.

Agregar un módulo aquí es suficiente para exponerlo en catálogo API,
validación middleware y UI de administración (vía GET /rh-permisos/modulos).

Cada ítem visible en los submenús del sidebar RH debe tener su propia clave.
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


# Claves legacy → nuevas (si la legacy está en true, otorga las hijas).
_LEGACY_MODULE_ALIASES: dict[str, tuple[str, ...]] = {
    "comedor": ("comedor-registro", "comedor-gestion", "comedor-planear"),
    "puestos": ("puestos-ajustes",),
    "cursos": (
        "cursos-seguimiento", "sesiones", "cursos-ajustes", "juntas",
        "proveedores-externos", "cursos-externos", "cursos-vencimientos",
    ),
    "level-up": ("evaluacion-360",),
}


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
        label="Solicitudes",
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
    "faltas-retardos": RhModuleDef(
        key="faltas-retardos",
        label="Faltas y retardos",
        group="Laborales",
        nav_item_ids=("faltas-retardos",),
        hash_prefixes=("#/faltas-retardos",),
        api_prefixes=("/api/v1/faltas-retardos",),
    ),
    "viajes-laborales": RhModuleDef(
        key="viajes-laborales",
        label="Viajes laborales",
        group="Laborales",
        nav_item_ids=("viajes-laborales",),
        hash_prefixes=("#/viajes-laborales",),
        api_prefixes=("/api/v1/viajes-laborales",),
    ),
    "comedor-registro": RhModuleDef(
        key="comedor-registro",
        label="Registro Comedor",
        group="Comedor",
        nav_item_ids=("comedor",),
        hash_prefixes=("#/comedor",),
        api_prefixes=(
            "/api/v1/comedor/rh",
            "/api/v1/comedor/accesos/rh",
        ),
    ),
    "reportes": RhModuleDef(
        key="reportes",
        label="Reportes",
        group="Comedor",
        nav_item_ids=("reportes",),
        hash_prefixes=("#/comedor/reporte", "#/reportes"),
        api_prefixes=(
            "/api/v1/comedor/estadisticas",
            "/api/v1/comedor/proyecciones",
        ),
    ),
    "comedor-gestion": RhModuleDef(
        key="comedor-gestion",
        label="Comedores",
        group="Comedor",
        nav_item_ids=("comedor-gestion",),
        hash_prefixes=("#/comedor/gestion", "#/comedor/codigos-externos"),
        api_prefixes=(
            "/api/v1/comedor/comedores",
            "/api/v1/comedor/codigos-externos",
            "/api/v1/comedor/accesos/rh/codigos-externos",
        ),
    ),
    "comedor-planear": RhModuleDef(
        key="comedor-planear",
        label="Planeación",
        group="Comedor",
        nav_item_ids=("comedor-planear",),
        hash_prefixes=("#/comedor/planear",),
        api_prefixes=("/api/v1/comedor/menu",),
    ),
    "nominas-horas-extra": RhModuleDef(
        key="nominas-horas-extra",
        label="Horas Extra",
        group="Nóminas",
        nav_item_ids=("horas-extra",),
        hash_prefixes=("#/nominas/horas-extra",),
        api_prefixes=("/api/v1/nominas/horas-extra",),
    ),
    "nominas-conciliacion": RhModuleDef(
        key="nominas-conciliacion",
        label="Conciliación",
        group="Nóminas",
        nav_item_ids=("conciliacion",),
        hash_prefixes=("#/nominas/conciliacion",),
        api_prefixes=("/api/v1/nominas/conciliacion",),
    ),
    "nominas-ajustes": RhModuleDef(
        key="nominas-ajustes",
        label="Ajustes de Nóminas",
        group="Nóminas",
        nav_item_ids=("nominas-ajustes",),
        hash_prefixes=("#/nominas/ajustes",),
        api_prefixes=("/api/v1/nominas/ajustes",),
    ),
    "cursos": RhModuleDef(
        key="cursos",
        label="Catálogo de cursos",
        group="Cursos",
        nav_item_ids=("cursos",),
        hash_prefixes=("#/cursos",),
        api_prefixes=("/api/v1/level-up/cursos",),
    ),
    "cursos-seguimiento": RhModuleDef(
        key="cursos-seguimiento",
        label="Seguimiento de capacitaciones",
        group="Cursos",
        nav_item_ids=("cursos-seguimiento",),
        hash_prefixes=("#/cursos/seguimiento",),
        api_prefixes=("/api/v1/level-up/cursos/dashboard",),
    ),
    "sesiones": RhModuleDef(
        key="sesiones",
        label="Sesiones",
        group="Cursos",
        nav_item_ids=("sesiones",),
        hash_prefixes=("#/sesiones",),
        api_prefixes=("/api/v1/level-up/sesiones",),
    ),
    "capacitaciones": RhModuleDef(
        key="capacitaciones",
        label="Capacitaciones",
        group="Cursos",
        nav_item_ids=("capacitaciones",),
        hash_prefixes=("#/capacitaciones",),
        api_prefixes=("/api/v1/capacitaciones",),
    ),
    "encuestas": RhModuleDef(
        key="encuestas",
        label="Encuestas Post Curso",
        group="Cursos",
        nav_item_ids=("encuestas",),
        hash_prefixes=("#/encuestas",),
        api_prefixes=(),
    ),
    "cursos-ajustes": RhModuleDef(
        key="cursos-ajustes",
        label="Ajustes de cursos",
        group="Cursos",
        nav_item_ids=("cursos-ajustes",),
        hash_prefixes=("#/cursos/ajustes",),
        api_prefixes=("/api/v1/level-up/catalogos",),
    ),
    "juntas": RhModuleDef(
        key="juntas",
        label="Juntas",
        group="Cursos",
        nav_item_ids=("cursos-juntas",),
        hash_prefixes=("#/cursos/juntas",),
        api_prefixes=("/api/v1/juntas",),
    ),
    "proveedores-externos": RhModuleDef(
        key="proveedores-externos",
        label="Contratistas",
        group="Personal Externo",
        nav_item_ids=("cursos-proveedores",),
        hash_prefixes=("#/cursos/proveedores",),
        # Las 3 subpaginas comparten el backend; solo esta declara el api_prefix.
        api_prefixes=("/api/v1/proveedores-externos",),
    ),
    "cursos-externos": RhModuleDef(
        key="cursos-externos",
        label="Cursos externos",
        group="Personal Externo",
        nav_item_ids=("cursos-externos",),
        hash_prefixes=("#/cursos/externos",),
        api_prefixes=(),
    ),
    "cursos-vencimientos": RhModuleDef(
        key="cursos-vencimientos",
        label="Vencimientos",
        group="Personal Externo",
        nav_item_ids=("cursos-vencimientos",),
        hash_prefixes=("#/cursos/vencimientos",),
        api_prefixes=(),
    ),
    "puestos": RhModuleDef(
        key="puestos",
        label="Perfiles de puesto",
        group="Puestos",
        nav_item_ids=("puestos",),
        hash_prefixes=("#/puestos",),
        api_prefixes=(
            "/api/v1/puestos-perfil",
            "/api/v1/perfiles",
            "/api/v1/cualificaciones-catalogo",
            "/api/v1/tareas-catalogo",
        ),
    ),
    "competencias": RhModuleDef(
        key="competencias",
        label="Competencias",
        group="Puestos",
        nav_item_ids=("competencias",),
        hash_prefixes=("#/competencias",),
        api_prefixes=("/api/v1/competencias",),
    ),
    "tareas-catalogo": RhModuleDef(
        key="tareas-catalogo",
        label="Tareas",
        group="Puestos",
        nav_item_ids=("tareas-catalogo",),
        hash_prefixes=("#/tareas-catalogo",),
        api_prefixes=("/api/v1/tareas-catalogo",),
    ),
    "puestos-ajustes": RhModuleDef(
        key="puestos-ajustes",
        label="Ajustes perfil de puesto",
        group="Puestos",
        nav_item_ids=("puestos-ajustes",),
        hash_prefixes=("#/puestos/ajustes",),
        api_prefixes=(
            "/api/v1/grados-puesto",
            "/api/v1/metodos-calificacion-competencia",
            "/api/v1/grupos-competencia",
            "/api/v1/tipos-competencia",
            "/api/v1/metodos-calificacion",
        ),
    ),
    "evaluaciones": RhModuleDef(
        key="evaluaciones",
        label="Evaluaciones",
        group="Cumplimiento",
        nav_item_ids=("evaluaciones",),
        hash_prefixes=("#/evaluaciones",),
        api_prefixes=("/api/v1/evaluaciones",),
    ),
    "opls": RhModuleDef(
        key="opls",
        label="Manejo de OPLs",
        group="Cumplimiento",
        nav_item_ids=("opls",),
        hash_prefixes=("#/opls",),
        api_prefixes=(),
    ),
    "evidencias": RhModuleDef(
        key="evidencias",
        label="Motor de Evidencias",
        group="Cumplimiento",
        nav_item_ids=("evidencias",),
        hash_prefixes=("#/evidencias",),
        api_prefixes=(),
    ),
    "sugerencias": RhModuleDef(
        key="sugerencias",
        label="Motor de Sugerencias",
        group="Cumplimiento",
        nav_item_ids=("sugerencias",),
        hash_prefixes=("#/sugerencias",),
        api_prefixes=(),
    ),
    "pdi-gestion": RhModuleDef(
        key="pdi-gestion",
        label="Gestión PDI",
        group="Cumplimiento",
        nav_item_ids=("pdi-gestion",),
        hash_prefixes=("#/pdi-gestion",),
        api_prefixes=("/api/v1/evaluaciones/pdi",),
    ),
    "level-up": RhModuleDef(
        key="level-up",
        label="Resumen operativo",
        group="Level Up",
        nav_item_ids=("level-up",),
        hash_prefixes=("#/level-up/resumen", "#/level-up"),
        api_prefixes=("/api/v1/level-up",),
    ),
    "evaluacion-360": RhModuleDef(
        key="evaluacion-360",
        label="Evaluación 360°",
        group="Level Up",
        nav_item_ids=("evaluacion-360",),
        hash_prefixes=("#/level-up/evaluacion-360",),
        api_prefixes=("/api/v1/evaluacion-360",),
    ),
    "capacidades": RhModuleDef(
        key="capacidades",
        label="Matriz de multihabilidades",
        group="Level Up",
        nav_item_ids=("capacidades",),
        hash_prefixes=("#/capacidades",),
        api_prefixes=("/api/v1/competencias/multihabilidades",),
    ),
    "encuestas-rh": RhModuleDef(
        key="encuestas-rh",
        label="Encuestas",
        group="Talento",
        nav_item_ids=("encuestas-rh",),
        hash_prefixes=("#/talento/encuestas",),
        api_prefixes=("/api/v1/encuestas-rh",),
    ),
}

RH_MODULE_GROUP_ORDER: tuple[str, ...] = (
    "General",
    "Laborales",
    "Comedor",
    "Nóminas",
    "Cursos",
    "Personal Externo",
    "Puestos",
    "Cumplimiento",
    "Level Up",
    "Talento",
)

RH_MODULE_EXEMPT_API_PREFIXES: tuple[str, ...] = (
    "/api/v1/auth",
    "/api/v1/notificaciones",
    "/api/v1/rh-permisos",
    "/api/v1/nominas/horas-extra/aprobaciones",
)

RH_SELF_SERVICE_API_PREFIXES: tuple[str, ...] = (
    "/api/v1/solicitudes",
    "/api/v1/comedor/mi-comedor-asignado",
    "/api/v1/comedor/accesos/mis-reservas",
    "/api/v1/comedor/accesos/mis-proximas-reservas",
    "/api/v1/comedor/accesos/mis-fechas-ocupadas",
    "/api/v1/comedor/accesos/primera-fecha-permitida",
    "/api/v1/comedor/registro",
    "/api/v1/bono-productividad",
    # Evaluacion 360: responder evaluaciones es self-service (cualquier evaluador).
    "/api/v1/evaluacion-360/mis-evaluaciones",
    "/api/v1/evaluacion-360/evaluaciones",
    # Encuestas RH: responder/consultar las propias encuestas es self-service
    # (gana sobre el api_prefix de gestion "/api/v1/encuestas-rh" — ver
    # RhModulePermissionMiddleware.dispatch, que revisa is_rh_self_service_api_path
    # ANTES de exigir el modulo, solo para usuarios rh_admin/rol=="rh").
    "/api/v1/encuestas-rh/mis-encuestas",
)


def all_module_keys() -> list[str]:
    return list(RH_MODULES.keys())


def is_valid_module_key(key: str) -> bool:
    return key in RH_MODULES


def _module_granted(modulos: dict, key: str) -> bool:
    if bool(modulos.get(key, False)):
        return True
    for legacy, targets in _LEGACY_MODULE_ALIASES.items():
        if key in targets and bool(modulos.get(legacy, False)):
            return True
    return False


def _expand_legacy_modulos(modulos: dict) -> dict[str, bool]:
    result = {key: bool(modulos.get(key, False)) for key in all_module_keys()}
    for legacy, targets in _LEGACY_MODULE_ALIASES.items():
        if bool(modulos.get(legacy, False)):
            for target in targets:
                if target in result:
                    result[target] = True
    return result


def effective_modules(modulos_rh: dict | None) -> dict[str, bool]:
    """Vacío o null → acceso completo (compatibilidad retroactiva RH sin configurar)."""
    if not modulos_rh:
        return {key: True for key in all_module_keys()}
    return _expand_legacy_modulos(modulos_rh)


def has_personalized_modulos_rh(empleado: "Empleado") -> bool:
    """True si el RH tiene restricciones explícitas guardadas en modulos_rh."""
    modulos = getattr(empleado, "modulos_rh", None) or {}
    return bool(modulos)


def is_modulos_rh_enrolled(empleado: "Empleado") -> bool:
    """Usuario incluido en permisos por módulo (admin, rol legacy `rh` o inscrito)."""
    from app.core.rh_ui_mode import is_admin_user

    if is_admin_user(empleado):
        return True
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    if rol == "rh":
        return True
    return bool(getattr(empleado, "inscrito_modulos_rh", False))


def empleado_en_lista_permisos(empleado: "Empleado") -> bool:
    """True si el empleado debe aparecer en la tabla de administración de permisos RH."""
    from app.core.rh_ui_mode import is_admin_user

    if is_admin_user(empleado):
        return True
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    if rol == "rh" and not getattr(empleado, "acceso_rh_removido", False):
        return True
    return bool(getattr(empleado, "inscrito_modulos_rh", False))


def effective_modules_for_display(empleado: "Empleado") -> dict[str, bool]:
    """Permisos efectivos para UI de administración."""
    from app.core.rh_ui_mode import is_admin_user

    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if is_admin_user(empleado):
        return {key: True for key in all_module_keys()}
    if rol == "rh" and not modulos:
        return {key: True for key in all_module_keys()}
    return _expand_legacy_modulos(modulos)


def empty_modulos_rh_config() -> dict[str, bool]:
    return {key: False for key in all_module_keys()}


def user_has_module(empleado: "Empleado", module_key: str) -> bool:
    from app.core.rh_ui_mode import is_admin_user

    if not is_valid_module_key(module_key):
        return False
    if is_admin_user(empleado):
        return True
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if rol == "rh":
        if not modulos:
            return True
        return _module_granted(modulos, module_key)
    if is_modulos_rh_enrolled(empleado):
        return _module_granted(modulos, module_key)
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


def _is_empleado_pdi_api_path(path: str) -> bool:
    """CRUD PDI por empleado bajo /evaluaciones/empleado/{id}/pdi."""
    return path.startswith("/api/v1/evaluaciones/empleado/") and "/pdi" in path


def resolve_module_from_api_path(path: str) -> str | None:
    if any(_path_matches_prefix(path, exempt) for exempt in RH_MODULE_EXEMPT_API_PREFIXES):
        return None

    if _is_empleado_pdi_api_path(path):
        return "pdi-gestion"

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
    """Claims JWT para permisos por módulo y flag ADMIN."""
    from app.core.rh_ui_mode import is_admin_user

    claims: dict = {}
    if is_admin_user(empleado):
        claims["rh_admin"] = True

    rol = empleado.rol.nombre if empleado.rol else "empleado"
    modulos = getattr(empleado, "modulos_rh", None) or {}
    if rol == "rh":
        claims["rh_enrolled"] = True
        if modulos:
            claims["rh_modulos"] = effective_modules(modulos)
    elif bool(getattr(empleado, "inscrito_modulos_rh", False)) and modulos:
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
    from app.core.rh_ui_mode import (
        RH_UI_MODE_LIDER,
        RH_UI_MODE_GERENTE,
        RH_UI_MODE_OPERATIVO,
        effective_rh_ui_mode,
    )

    if payload.get("rh_admin"):
        mode = effective_rh_ui_mode(rh_ui_mode)
        if mode == RH_UI_MODE_OPERATIVO:
            return True
        if mode in (RH_UI_MODE_LIDER, RH_UI_MODE_GERENTE):
            return True
        if payload.get("rh_gestor_alcance") and mode == RH_UI_MODE_OPERATIVO:
            return True

    rol = payload.get("rol")
    modulos = payload.get("rh_modulos")

    if rol == "rh":
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
    return _module_granted(modulos, module_key)


def validate_modulos_rh_keys(keys: Iterable[str]) -> list[str]:
    """Retorna keys inválidas."""
    return [k for k in keys if not is_valid_module_key(k)]
