"""
Catálogo de vistas configurables por ROL base (`empleado`, `supervisor`, `gerente`).

Complementa —no sustituye— a `app/core/rh_module_registry.py`, que otorga módulos RH a
usuarios concretos. Aquí la unidad de configuración es el par (rol, vista): un admin RH
enciende o apaga una vista para todo un rol desde `#/ajustes/vistas-rol`, y el cambio se
persiste en `levelup_vistas_rol`.

El catálogo vive en código a propósito: agregar una vista nueva es agregar una entrada
aquí (más su espejo en `frontend/src/auth/vistaRolRegistry.ts`), sin tocar la BD ni la
pantalla de administración. Las vistas que ya existen como módulo RH derivan su label,
hashes y prefijos de `RH_MODULES` para no mantener el mismo dato en dos sitios.

Reglas que sostienen el diseño:

- `default_habilitado` reproduce EXACTAMENTE lo que cada rol ve hoy en el menú
  (`EMPLEADO_VISIBLE_NAV_IDS` / `SUPERVISOR_VISIBLE_NAV_IDS` y las compuertas
  `empleadoMayAccessHash` / `supervisorMayAccessHash` de `shellNavPolicy.ts`). Una vista
  nueva sin `default_habilitado` nace apagada para todos.
- El gate de API **solo bloquea lo que la configuración había concedido**: se rechaza
  cuando la vista venía encendida de fábrica para ese rol y el admin la apagó. Si de
  fábrica estaba apagada, el acceso lo sigue decidiendo `role_checker` como siempre.
  Sin esta asimetría, la primera versión cerraba accesos de API que un rol ya tenía por
  su `role_checker` aunque la pantalla no estuviera en su menú (p. ej. `supervisor` con
  `/api/v1/comedor/comedores`), rompiendo ~80 tests de la suite.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.core.rh_module_registry import RH_MODULES, RH_MODULE_EXEMPT_API_PREFIXES

# Roles cuyo acceso es configurable. `director` y `rh` quedan fuera por decisión de
# producto; el admin RH (flag `puede_administrar_permisos_rh`) está siempre exento.
ROLES_CONFIGURABLES: tuple[str, ...] = ("empleado", "supervisor", "gerente")

_TODOS = frozenset(ROLES_CONFIGURABLES)
_GESTORES = frozenset({"supervisor", "gerente"})


@dataclass(frozen=True)
class VistaRolDef:
    key: str
    label: str
    descripcion: str
    grupo: str
    hash_prefixes: tuple[str, ...]
    api_prefixes: tuple[str, ...]
    nav_item_ids: tuple[str, ...]
    activa: bool = True
    default_habilitado: frozenset[str] = field(default_factory=frozenset)


def _desde_modulo(
    module_key: str,
    *,
    descripcion: str,
    default_habilitado: Iterable[str] = (),
    label: str | None = None,
    grupo: str | None = None,
    hash_prefixes: tuple[str, ...] | None = None,
    api_prefixes: tuple[str, ...] | None = None,
    nav_item_ids: tuple[str, ...] | None = None,
) -> VistaRolDef:
    """Vista derivada de un módulo RH: hereda label/hashes/prefijos de `RH_MODULES`."""
    mod = RH_MODULES[module_key]
    return VistaRolDef(
        key=module_key,
        label=label or mod.label,
        descripcion=descripcion,
        grupo=grupo or mod.group,
        hash_prefixes=hash_prefixes if hash_prefixes is not None else mod.hash_prefixes,
        api_prefixes=api_prefixes if api_prefixes is not None else mod.api_prefixes,
        nav_item_ids=nav_item_ids if nav_item_ids is not None else mod.nav_item_ids,
        default_habilitado=frozenset(default_habilitado),
    )


GRUPO_AUTOSERVICIO = "Autoservicio"

# Orden de presentación en la pantalla de configuración (mismo criterio que
# RH_MODULE_GROUP_ORDER, con Autoservicio arriba porque es lo que ve el empleado).
VISTA_ROL_GRUPO_ORDEN: tuple[str, ...] = (
    "General",
    GRUPO_AUTOSERVICIO,
    "Laborales",
    "Comedor",
    "Nóminas",
    "Puestos",
    "Talento",
    "Desempeño",
    "Desarrollo",
    "Personal Externo",
)


_VISTAS: tuple[VistaRolDef, ...] = (
    # ---------------------------------------------------------------- General
    _desde_modulo(
        "dashboard",
        descripcion="Pantalla de inicio con los indicadores del usuario.",
        default_habilitado=_TODOS,
    ),
    _desde_modulo(
        "organigrama",
        descripcion="Estructura jerárquica de la organización.",
    ),
    _desde_modulo(
        "empleados",
        descripcion="Directorio y expediente de empleados.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "level-up",
        descripcion="Menú de acceso a las herramientas de Level Up.",
    ),
    # ----------------------------------------------------------- Autoservicio
    VistaRolDef(
        key="comedor",
        label="Comedor",
        descripcion="Reserva y consulta de los propios accesos al comedor.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/comedor",),
        api_prefixes=(
            "/api/v1/comedor/mi-comedor-asignado",
            "/api/v1/comedor/registro",
            "/api/v1/comedor/accesos/mis-reservas",
            "/api/v1/comedor/accesos/mis-proximas-reservas",
            "/api/v1/comedor/accesos/mis-fechas-ocupadas",
            "/api/v1/comedor/accesos/primera-fecha-permitida",
            "/api/v1/comedor/accesos/equipo",
        ),
        nav_item_ids=("comedor",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mis-evaluaciones",
        label="Mis evaluaciones",
        descripcion="Evaluaciones 360° que el usuario debe responder como evaluador.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/mis-evaluaciones",),
        api_prefixes=(
            "/api/v1/evaluacion-360/mis-evaluaciones",
            "/api/v1/evaluacion-360/evaluaciones",
        ),
        nav_item_ids=("mis-evaluaciones",),
        default_habilitado=frozenset({"empleado"}),
    ),
    VistaRolDef(
        key="mis-encuestas",
        label="Encuestas de curso",
        descripcion="Encuestas pendientes de los cursos que el usuario tomó.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/mis-encuestas",),
        api_prefixes=("/api/v1/level-up/encuestas",),
        nav_item_ids=("mis-encuestas",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mis-encuestas-rh",
        label="Encuestas de RH",
        descripcion="Encuestas de clima y cultura dirigidas al usuario.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/talento/mis-encuestas",),
        api_prefixes=("/api/v1/encuestas-rh/mis-encuestas",),
        nav_item_ids=("mis-encuestas-rh",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mis-firmas",
        label="Mis firmas",
        descripcion="Evidencias de capacitación pendientes de firma.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/mis-firmas",),
        api_prefixes=(
            "/api/v1/level-up/evidencias/mis-firmas",
            "/api/v1/level-up/evidencias/firmas",
        ),
        nav_item_ids=("mis-firmas",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mis-aprobaciones-opl",
        label="Aprobaciones de OPL",
        descripcion="OPLs que el usuario debe aprobar o regresar.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/mis-aprobaciones-opl",),
        api_prefixes=(
            "/api/v1/level-up/opls/mis-aprobaciones",
            "/api/v1/level-up/opls/aprobaciones",
        ),
        nav_item_ids=("mis-aprobaciones-opl",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mis-metas",
        label="Mis metas",
        descripcion="Metas propias y check-ins de resultados clave.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/talento/mis-metas",),
        api_prefixes=("/api/v1/metas/mis-metas",),
        nav_item_ids=("mis-metas",),
        default_habilitado=_TODOS,
    ),
    VistaRolDef(
        key="mi-desempeno",
        label="Mi desempeño",
        descripcion="Resultado propio de los ciclos de desempeño cerrados.",
        grupo=GRUPO_AUTOSERVICIO,
        hash_prefixes=("#/talento/mi-desempeno",),
        api_prefixes=(
            "/api/v1/ciclo-desempeno/mis-resultados",
            "/api/v1/historial-objetivo/mi-historial",
        ),
        nav_item_ids=("mi-desempeno",),
        default_habilitado=_TODOS,
    ),
    # -------------------------------------------------------------- Laborales
    _desde_modulo(
        "solicitudes",
        descripcion="Solicitudes de vacaciones y permisos: registro y aprobación.",
        default_habilitado=_TODOS,
    ),
    _desde_modulo(
        "metricas",
        descripcion="Indicadores laborales y reportes de la plantilla.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "incidencias",
        descripcion="Registro y seguimiento de quejas de calidad y seguridad.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "faltas-retardos",
        descripcion="Incidencias de asistencia importadas de nómina.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "actas",
        descripcion="Actas administrativas del personal.",
    ),
    _desde_modulo(
        "viajes-laborales",
        descripcion="Registro de viajes laborales del personal.",
    ),
    # ---------------------------------------------------------------- Comedor
    _desde_modulo(
        "reportes",
        descripcion="Estadísticas y proyecciones de consumo del comedor.",
    ),
    _desde_modulo(
        "comedor-gestion",
        descripcion="Alta de comedores y códigos de personal externo.",
    ),
    _desde_modulo(
        "comedor-planear",
        descripcion="Planeación del menú del comedor.",
    ),
    # ---------------------------------------------------------------- Nóminas
    _desde_modulo(
        "nominas-horas-extra",
        descripcion="Gestión de horas extra de nómina.",
    ),
    _desde_modulo(
        "nominas-conciliacion",
        descripcion="Conciliación de nómina contra el sistema de asistencia.",
    ),
    _desde_modulo(
        "nominas-ajustes",
        descripcion="Ajustes y autorizaciones de nómina.",
    ),
    # ---------------------------------------------------------------- Puestos
    _desde_modulo(
        "puestos",
        descripcion="Perfiles de puesto y su estructura WTW.",
    ),
    _desde_modulo(
        "competencias",
        descripcion="Catálogo de competencias y matriz de multihabilidades.",
    ),
    _desde_modulo(
        "tareas-catalogo",
        descripcion="Catálogo de tareas asignables a un perfil de puesto.",
    ),
    _desde_modulo(
        "puestos-ajustes",
        descripcion="Catálogos base del perfil de puesto (niveles, grados, métodos).",
    ),
    # ---------------------------------------------------------------- Talento
    _desde_modulo(
        "dashboard-talento",
        descripcion="Panel agregado de la suite de talento.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "encuestas-rh",
        descripcion="Diseño y resultados de las encuestas de RH.",
    ),
    _desde_modulo(
        "operaciones",
        descripcion="Cobertura y polivalencia por área.",
    ),
    # -------------------------------------------------------------- Desempeño
    _desde_modulo(
        "evaluaciones",
        descripcion="Evaluaciones de desempeño por empleado.",
        # `#/evaluaciones` ya pasaba `supervisorMayAccessHash`.
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "metas",
        descripcion="Metas y resultados clave del equipo.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "ciclo-desempeno",
        descripcion="Ciclos de desempeño: apertura, seguimiento y cierre.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "historial-objetivo",
        descripcion="Índice histórico objetivo por empleado.",
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "evaluacion-360",
        descripcion="Administración de las evaluaciones 360°.",
    ),
    # -------------------------------------------------------------- Desarrollo
    _desde_modulo(
        "pdi-gestion",
        descripcion="Planes de desarrollo individual del equipo.",
        # `#/pdi-gestion` ya pasaba `supervisorMayAccessHash`.
        default_habilitado=_GESTORES,
    ),
    _desde_modulo(
        "cursos",
        descripcion="Catálogo de cursos de capacitación.",
    ),
    _desde_modulo(
        "cursos-seguimiento",
        descripcion="Seguimiento del avance de capacitaciones.",
    ),
    _desde_modulo(
        "sesiones",
        descripcion="Sesiones programadas de los cursos.",
    ),
    _desde_modulo(
        "capacitaciones",
        descripcion="Inscripción y control de capacitaciones.",
    ),
    _desde_modulo(
        "encuestas",
        descripcion="Administración de encuestas post curso.",
    ),
    _desde_modulo(
        "cursos-ajustes",
        descripcion="Catálogos base de cursos.",
    ),
    _desde_modulo(
        "juntas",
        descripcion="Registro de juntas y su asistencia.",
    ),
    _desde_modulo(
        "opls",
        descripcion="Administración de OPLs.",
    ),
    _desde_modulo(
        "evidencias",
        descripcion="Motor de evidencias de capacitación.",
    ),
    _desde_modulo(
        "sugerencias",
        descripcion="Motor de sugerencias de capacitación.",
    ),
    # -------------------------------------------------------- Personal Externo
    _desde_modulo(
        "proveedores-externos",
        descripcion="Contratistas y su personal.",
    ),
    _desde_modulo(
        "cursos-externos",
        descripcion="Cursos del personal externo.",
    ),
    _desde_modulo(
        "cursos-vencimientos",
        descripcion="Vencimientos de cursos del personal externo.",
    ),
)

VISTAS_ROL: dict[str, VistaRolDef] = {v.key: v for v in _VISTAS}


# Rutas que nunca se evalúan: infraestructura, la propia administración de vistas y las
# de horas extra (Regla B, ver abajo).
VISTA_ROL_EXEMPT_API_PREFIXES: tuple[str, ...] = RH_MODULE_EXEMPT_API_PREFIXES + (
    "/api/v1/vistas-rol",
    "/api/v1/horas-extra",
)

# Regla B: registrar y aprobar horas extra dependen ÚNICAMENTE de la autorización
# explícita de nómina (claims `he_autorizado` / `he_aprobador`), nunca del rol ni de un
# permiso de módulo. Sus ítems de menú ya están fuera del catálogo, pero sus RUTAS caen
# bajo el prefijo `#/nominas/horas-extra` de la vista «Horas Extra» —apagada de fábrica
# para los roles base—, así que el gate las bloqueaba antes de que la Regla B pudiera
# decidir: un empleado designado aprobador veía "Acceso no autorizado".
HASH_EXENTOS_REGLA_B: tuple[str, ...] = (
    "#/horas-extra/solicitud",
    "#/nominas/horas-extra/aprobaciones",
)


def all_vista_keys() -> list[str]:
    return list(VISTAS_ROL.keys())


def is_valid_vista_key(key: str) -> bool:
    return key in VISTAS_ROL


def is_rol_configurable(rol_nombre: str | None) -> bool:
    return rol_nombre in ROLES_CONFIGURABLES


# Modo de UI simulado (`X-RH-UI-Mode`) → rol cuya configuración se aplica.
# `operativo` (Modo RH) y `director` no mapean: ahí el admin ve todo.
_MODO_UI_A_ROL: dict[str, str] = {
    "empleado": "empleado",
    "lider": "supervisor",
    "gerente": "gerente",
}


def rol_configurable_para_modo(rh_ui_mode: str | None) -> str | None:
    """Rol al que se le aplica el gate cuando un admin simula otro perfil.

    Un admin RH está exento en Modo RH (`operativo`), pero al cambiar el toggle a
    empleado/líder/gerente debe ver exactamente lo que ve ese rol — si no, no puede
    comprobar el efecto de su propia configuración.
    """
    if not rh_ui_mode:
        return None
    return _MODO_UI_A_ROL.get(str(rh_ui_mode).strip().lower())


def _path_matches_prefix(path: str, prefix: str) -> bool:
    if path == prefix:
        return True
    if prefix.endswith("/"):
        return path.startswith(prefix)
    return path.startswith(prefix + "/") or path.startswith(prefix)


def resolve_vista_from_api_path(path: str) -> str | None:
    """Vista dueña de una ruta de API. Gana el prefijo más largo (igual que módulos RH)."""
    if any(_path_matches_prefix(path, exempt) for exempt in VISTA_ROL_EXEMPT_API_PREFIXES):
        return None

    best_key: str | None = None
    best_len = -1
    for vista in VISTAS_ROL.values():
        for prefix in vista.api_prefixes:
            if _path_matches_prefix(path, prefix) and len(prefix) > best_len:
                best_key = vista.key
                best_len = len(prefix)
    return best_key


def resolve_vista_from_hash(hash_value: str) -> str | None:
    h = (hash_value or "#/").strip()
    if h in ("", "#", "#/"):
        return "dashboard"

    if any(h.startswith(prefix) for prefix in HASH_EXENTOS_REGLA_B):
        return None

    best_key: str | None = None
    best_len = -1
    for vista in VISTAS_ROL.values():
        for prefix in vista.hash_prefixes:
            if prefix == "#/":
                continue
            if h == prefix or h.startswith(prefix + "/") or h.startswith(prefix):
                if len(prefix) > best_len:
                    best_key = vista.key
                    best_len = len(prefix)
    return best_key


def nav_item_to_vista_key(nav_item_id: str) -> str | None:
    for vista in VISTAS_ROL.values():
        if nav_item_id in vista.nav_item_ids:
            return vista.key
    return None


def vista_habilitada_de_fabrica(rol_nombre: str, vista_key: str) -> bool:
    """True si la vista venía encendida para ese rol en la configuración inicial."""
    vista = VISTAS_ROL.get(vista_key)
    return bool(vista and rol_nombre in vista.default_habilitado)


def gate_api_bloquea(rol_nombre: str, vista_key: str, habilitado: bool) -> bool:
    """True si hay que responder 403 para este (rol, vista).

    Solo **retira** lo que la configuración concedía. Una vista apagada de fábrica nunca
    bloquea el API — ahí el acceso lo decide `role_checker`, como siempre —, porque un rol
    puede llegar a endpoints de una pantalla que no tiene en el menú y cerrarlos sería una
    regresión.
    """
    if habilitado:
        return False
    return vista_habilitada_de_fabrica(rol_nombre, vista_key)


def gate_api_amplia(rol_nombre: str, vista_key: str, habilitado: bool) -> bool:
    """True si la configuración concede acceso que el rol no tenía.

    Simétrico a `gate_api_bloquea`: solo cuenta cuando el admin encendió una vista que
    venía apagada de fábrica. Si ya venía encendida, el acceso del rol lo siguen
    decidiendo los `role_checker` de cada endpoint — de lo contrario, tener la pantalla
    abriría también sus endpoints de administración, reservados a RH.
    """
    return habilitado and not vista_habilitada_de_fabrica(rol_nombre, vista_key)


def defaults_por_rol() -> dict[str, dict[str, bool]]:
    """Configuración inicial: reproduce el acceso que cada rol tiene hoy."""
    return {
        rol: {v.key: rol in v.default_habilitado for v in VISTAS_ROL.values()}
        for rol in ROLES_CONFIGURABLES
    }


def catalogo_para_api() -> list[dict]:
    """Catálogo serializable para `GET /api/v1/vistas-rol/catalogo`."""
    items: list[dict] = []
    for grupo in VISTA_ROL_GRUPO_ORDEN:
        for vista in VISTAS_ROL.values():
            if vista.grupo != grupo:
                continue
            items.append(
                {
                    "key": vista.key,
                    "label": vista.label,
                    "descripcion": vista.descripcion,
                    "grupo": vista.grupo,
                    "ruta": vista.hash_prefixes[0] if vista.hash_prefixes else "",
                    "activa": vista.activa,
                    "nav_item_ids": list(vista.nav_item_ids),
                    "roles": list(ROLES_CONFIGURABLES),
                }
            )
    return items


def validate_vista_keys(keys: Iterable[str]) -> list[str]:
    """Retorna las claves inválidas."""
    return [k for k in keys if not is_valid_vista_key(k)]


def validate_roles(roles: Iterable[str]) -> list[str]:
    """Retorna los roles no configurables."""
    return [r for r in roles if r not in ROLES_CONFIGURABLES]
