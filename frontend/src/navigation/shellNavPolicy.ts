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
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { isRhEmpleadoUiMode, isRhOperativoUiMode } from "../auth/rhUiMode.ts";

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
  { itemId: "puestos", hash: "#/puestos" },
  { itemId: "competencias", hash: "#/competencias" },
  { itemId: "tareas-catalogo", hash: "#/tareas-catalogo" },
  { itemId: "evaluaciones", hash: "#/evaluaciones" },
  { itemId: "capacitaciones", hash: "#/capacitaciones" },
  { itemId: "level-up", hash: "#/level-up" },
  { itemId: "capacidades", hash: "#/capacidades" },
  { itemId: "cursos", hash: "#/cursos" },
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
  if (isRhEmpleadoUiMode()) return isRhHomeHash(h) ? "#/" : h;
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
  | "metricas"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "empleados"
  | "evaluaciones"
  | "capacitaciones"
  | "reportes"
  | "puestos"
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
  "capacitaciones",
]);

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

const METRICAS_NAV_ROLES: ReadonlySet<string> = new Set(["rh", "gerente"]);

const TALENTO_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "tareas-catalogo", "competencias", "capacidades",
  "cursos", "opls", "evidencias", "sugerencias", "encuestas", "level-up",
]);

const SUPERVISOR_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

const GERENTE_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set();

function roleOnlyNavVisible(rol: string | null, itemId: AppShellNavItemId): boolean {
  if (itemId === "organigrama" && !ORGANIGRAMA_MENU_VISIBLE) return false;
  if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  if (itemId === "metricas") return METRICAS_NAV_ROLES.has(rol ?? "");
  if (RH_ONLY_NAV_IDS.has(itemId)) return rol === "rh";
  if (TALENTO_NAV_IDS.has(itemId)) return rol === "rh" || rol === "director" || rol === "gerente";
  if (rol === "supervisor" && SUPERVISOR_HIDDEN_NAV_IDS.has(itemId)) return false;
  if (rol === "gerente" && GERENTE_HIDDEN_NAV_IDS.has(itemId)) return false;
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
  const byRole = roleOnlyNavVisible(rol, itemId);
  if (rol === "rh") {
    if (isRhEmpleadoUiMode()) {
      return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
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
  if (h.startsWith("#/metricas")) return false;
  if (h.startsWith("#/comedor/reporte")) return false;
  if (h.startsWith("#/reportes")) return false;
  if (h.startsWith("#/evaluaciones")) return true;
  if (h.startsWith("#/capacitaciones")) return true;
  return true;
}

function hashAllowedByRole(rol: string | null, hash: string): boolean {
  if (rol === "empleado") return empleadoMayAccessHash(hash);
  if (rol === "supervisor") return supervisorMayAccessHash(hash);
  return true;
}

export function modulosMayAccessHash(hash: string, rol: string | null): boolean {
  const h = (hash || "#/").trim();
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
  return modulosMayAccessHash(hash, "rh");
}

