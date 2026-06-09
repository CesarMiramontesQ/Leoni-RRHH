/**
 * Visibilidad del menú lateral y rutas permitidas por rol (fuente única para app shell + router).
 */

import {
  canAccessRhPermisosAdmin,
  hasExplicitModuleGrant,
  hasRhModule,
  isModulosRhEnrolled,
} from "../auth/rhModulePermissions.ts";
import { navItemIdToModuleKey, resolveModuleFromHash } from "../auth/rhModuleRegistry.ts";
import { isComedorHubVisibleForRol } from "./comedorNav.ts";
import { isLaboralesHubVisibleForRol } from "./laboralesNav.ts";
import {
  isLevelUpHubVisibleForRol,
  getVisibleLevelUpCategoriesForRhSidebar,
} from "./levelUpNav.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { isRhEmpleadoUiMode, isRhGerenteUiMode, isRhGestorTeamUiMode, isRhLiderUiMode, isRhOperativoUiMode } from "../auth/rhUiMode.ts";

/** Ruta segura cuando un RH inscrito no tiene ningún módulo asignado. */
export const RH_SIN_PERMISOS_HASH = "#/sin-permisos-rh";

type RhNavLandingEntry = {
  itemId: AppShellNavItemId;
  hash: string;
};

/** Orden de aterrizaje alineado con el menú lateral RH (appShell). */
const RH_NAV_LANDING_ORDER: readonly RhNavLandingEntry[] = [
  { itemId: "dashboard", hash: "#/" },
  { itemId: "organigrama", hash: "#/organigrama" },
  { itemId: "metricas", hash: "#/metricas" },
  { itemId: "solicitudes", hash: "#/solicitudes" },
  { itemId: "incidencias", hash: "#/incidencias" },
  { itemId: "actas", hash: "#/actas" },
  { itemId: "comedor", hash: "#/comedor" },
  { itemId: "reportes", hash: "#/comedor/reporte" },
  { itemId: "level-up", hash: "#/level-up/resumen" },
  { itemId: "capacitaciones", hash: "#/capacitaciones" },
  { itemId: "puestos", hash: "#/puestos" },
  { itemId: "competencias", hash: "#/competencias" },
  { itemId: "tareas-catalogo", hash: "#/tareas-catalogo" },
  { itemId: "evaluaciones", hash: "#/evaluaciones" },
  { itemId: "capacidades", hash: "#/capacidades" },
  { itemId: "cursos", hash: "#/cursos" },
  { itemId: "sesiones", hash: "#/sesiones" },
  { itemId: "opls", hash: "#/opls" },
  { itemId: "evidencias", hash: "#/evidencias" },
  { itemId: "sugerencias", hash: "#/sugerencias" },
  { itemId: "encuestas", hash: "#/encuestas" },
  { itemId: "empleados", hash: "#/empleados" },
];

export function isRhHomeHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  return h === "" || h === "#" || h === "#/";
}

/** Primera página del menú RH a la que el usuario tiene acceso; null si ninguna. */
export function resolveRhOperativoLandingHash(): string | null {
  for (const entry of RH_NAV_LANDING_ORDER) {
    if (isShellNavItemVisibleForRol("rh", entry.itemId)) {
      return entry.hash;
    }
  }
  if (canAccessRhPermisosAdmin()) {
    return "#/ajustes/permisos-rh";
  }
  return null;
}

/**
 * Hash inicial tras login o recarga para usuarios RH con permisos limitados.
 * Solo ajusta la ruta de inicio (#/); no altera deep links válidos.
 */
export function resolveRhInitialHash(currentHash?: string): string {
  const h = (currentHash ?? (typeof window !== "undefined" ? window.location.hash : "") ?? "#/").trim() || "#/";
  if (getRolFromAccessToken() !== "rh") return h;
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode()) return isRhHomeHash(h) ? "#/" : h;
  if (!isRhHomeHash(h)) return h;
  if (rhMayAccessHash("#/")) return "#/";
  const landing = resolveRhOperativoLandingHash();
  return landing ?? RH_SIN_PERMISOS_HASH;
}

/** Mostrar «Organigrama» en el sidebar. La ruta `#/organigrama` sigue disponible para RH. */
export const ORGANIGRAMA_MENU_VISIBLE = false;

export type AppShellNavItemId =
  | "dashboard"
  | "organigrama"
  | "laborales"
  | "metricas"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "comedor-menu"
  | "empleados"
  | "evaluaciones"
  | "capacitaciones"
  | "reportes"
  | "puestos"
  | "puestos-ajustes"
  | "tareas-catalogo"
  | "competencias"
  | "capacidades"
  | "cursos"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "sesiones"
  | "encuestas"
  | "level-up";

const EMPLEADO_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "solicitudes",
  "comedor",
]);

/** Rol con menú lateral plano (sin hubs ni submenús). */
export function isEmpleadoFlatNavRol(rol: string | null): boolean {
  if (rol === "empleado") return true;
  if (rol === "rh" && isRhEmpleadoUiMode()) return true;
  return false;
}

const SUPERVISOR_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "metricas",
  "incidencias",
  "solicitudes",
  "comedor",
  "empleados",
]);

/** Rol con menú lateral estructurado por secciones (Laborales, Comedor). */
export function isSupervisorStructuredNavRol(rol: string | null): boolean {
  if (rol === "supervisor" || rol === "gerente") return true;
  if (rol === "rh" && (isRhLiderUiMode() || isRhGerenteUiMode())) return true;
  return false;
}

/** RH operativo: sidebar con secciones desplegables (Laborales, Comedor, Level Up). */
export function isRhStructuredNavRol(rol: string | null): boolean {
  return rol === "rh" && isRhOperativoUiMode();
}

/** Supervisor y gerente comparten política de rutas permitidas (sin hubs ni módulos extra). */
export function usesSupervisorRoutePolicy(rol: string | null): boolean {
  return rol === "supervisor" || rol === "gerente";
}

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

const METRICAS_NAV_ROLES: ReadonlySet<string> = new Set(["rh", "gerente"]);

const TALENTO_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "puestos-ajustes", "tareas-catalogo", "competencias", "capacidades",
  "cursos", "opls", "evidencias", "sugerencias", "encuestas", "level-up",
]);

const SUPERVISOR_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

const GERENTE_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set();

function effectiveShellNavRol(rol: string | null): string | null {
  if (rol === "rh") {
    if (isRhLiderUiMode()) return "supervisor";
    if (isRhGerenteUiMode()) return "gerente";
  }
  return rol;
}

function roleOnlyNavVisible(rol: string | null, itemId: AppShellNavItemId): boolean {
  const navRol = effectiveShellNavRol(rol);
  if (itemId === "organigrama" && !ORGANIGRAMA_MENU_VISIBLE) return false;
  if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  if (rol === "supervisor" || rol === "gerente") return SUPERVISOR_VISIBLE_NAV_IDS.has(itemId);
  if (itemId === "metricas") return METRICAS_NAV_ROLES.has(navRol ?? "");
  if (RH_ONLY_NAV_IDS.has(itemId)) return navRol === "rh";
  if (TALENTO_NAV_IDS.has(itemId)) return navRol === "rh" || navRol === "director" || navRol === "gerente";
  if (navRol === "supervisor" && rol !== "supervisor" && SUPERVISOR_HIDDEN_NAV_IDS.has(itemId)) return false;
  if (navRol === "gerente" && GERENTE_HIDDEN_NAV_IDS.has(itemId)) return false;
  return true;
}

function moduleNavAllowed(rol: string | null, itemId: AppShellNavItemId): boolean {
  const moduleKey = navItemIdToModuleKey(itemId);
  if (rol === "rh") {
    if (isRhEmpleadoUiMode()) return true;
    return hasRhModule(moduleKey);
  }
  if (isModulosRhEnrolled()) return hasExplicitModuleGrant(moduleKey);
  return true;
}

export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  if (itemId === "level-up") {
    if (isRhStructuredNavRol(rol)) {
      return getVisibleLevelUpCategoriesForRhSidebar(rol).some((category) => category.items.length > 0);
    }
    return isLevelUpHubVisibleForRol(rol);
  }
  if (itemId === "laborales") {
    return isLaboralesHubVisibleForRol(rol);
  }
  if (itemId === "comedor-menu") {
    return isComedorHubVisibleForRol(rol);
  }
  const byRole = roleOnlyNavVisible(rol, itemId);
  if (rol === "rh") {
    if (isRhEmpleadoUiMode()) {
      return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
    }
    if (isRhGestorTeamUiMode()) {
      return byRole;
    }
    return byRole && moduleNavAllowed(rol, itemId);
  }
  if (isModulosRhEnrolled()) {
    return byRole || hasExplicitModuleGrant(navItemIdToModuleKey(itemId));
  }
  return byRole;
}

export function empleadoMayAccessHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  if (h === "" || h === "#" || h === "#/") return true;
  if (h.startsWith("#/solicitudes")) return true;
  if (h.startsWith("#/comedor")) return true;
  if (h.startsWith("#/notificaciones")) return true;
  if (h.startsWith("#/capacitaciones")) return true;
  if (h.startsWith("#/metricas")) return false;
  return false;
}

export function supervisorMayAccessHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  if (h.startsWith("#/actas")) return false;
  if (h.startsWith("#/comedor/reporte")) return false;
  if (h.startsWith("#/reportes")) return false;
  if (h.startsWith("#/evaluaciones")) return true;
  if (h.startsWith("#/capacitaciones")) return true;
  return true;
}

function hashAllowedByRole(rol: string | null, hash: string): boolean {
  if (rol === "empleado") return empleadoMayAccessHash(hash);
  if (usesSupervisorRoutePolicy(rol)) return supervisorMayAccessHash(hash);
  return true;
}

export function modulosMayAccessHash(hash: string, rol: string | null): boolean {
  const h = (hash || "#/").trim();
  if (h === "#/level-up") {
    return isLevelUpHubVisibleForRol(rol);
  }
  if (h === "#/laborales") {
    return isLaboralesHubVisibleForRol(rol);
  }
  if (h === "#/comedor/accesos") {
    return isComedorHubVisibleForRol(rol);
  }
  if (h.startsWith("#/notificaciones")) return true;
  if (h.startsWith(RH_SIN_PERMISOS_HASH)) {
    return rol === "rh" && isRhOperativoUiMode();
  }
  if (h.startsWith("#/ajustes/permisos-rh")) {
    return isRhOperativoUiMode() && canAccessRhPermisosAdmin();
  }

  const moduleKey = resolveModuleFromHash(h);
  if (moduleKey === null) return true;

  if (rol === "rh") {
    if (h.startsWith("#/comedor/reporte") || h.startsWith("#/reportes")) {
      return hasRhModule("reportes");
    }
    if (h.startsWith("#/comedor")) {
      return hasRhModule("comedor");
    }
    return hasRhModule(moduleKey);
  }
  if (isModulosRhEnrolled()) {
    return hashAllowedByRole(rol, h) || hasExplicitModuleGrant(moduleKey);
  }
  return true;
}

/** Rutas permitidas para RH en modo empleado (autoservicio). */
export function rhEmpleadoMayAccessHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  if (h.startsWith("#/ajustes/permisos-rh")) return false;
  if (h.startsWith("#/comedor/gestion")) return false;
  if (h.startsWith("#/comedor/planear")) return false;
  if (h.startsWith("#/comedor/codigos-externos")) return false;
  if (h.startsWith("#/comedor/reporte")) return false;
  if (h.startsWith("#/reportes")) return false;
  return empleadoMayAccessHash(hash);
}

/** Control de hash para usuarios RH según modo UI. */
export function rhMayAccessHash(hash: string): boolean {
  if (isRhEmpleadoUiMode()) {
    return rhEmpleadoMayAccessHash(hash);
  }
  if (isRhGestorTeamUiMode()) {
    const h = (hash || "#/").trim();
    if (h.startsWith("#/ajustes/permisos-rh") || h.startsWith(RH_SIN_PERMISOS_HASH)) return false;
    const navRol = isRhGerenteUiMode() ? "gerente" : "supervisor";
    if (navRol === "supervisor") {
      return supervisorMayAccessHash(hash);
    }
    return hashAllowedByRole(navRol, hash);
  }
  return modulosMayAccessHash(hash, "rh");
}

