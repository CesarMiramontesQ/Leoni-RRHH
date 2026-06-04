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
  if (rol === "rh") return hasRhModule(moduleKey);
  if (isModulosRhEnrolled()) return hasExplicitModuleGrant(moduleKey);
  return true;
}

export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  const byRole = roleOnlyNavVisible(rol, itemId);
  if (rol === "rh") {
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
  if (h.startsWith("#/ajustes/permisos-rh")) return canAccessRhPermisosAdmin();

  const moduleKey = resolveModuleFromHash(h);
  if (moduleKey === null) return true;

  if (rol === "rh") {
    return hasRhModule(moduleKey);
  }
  if (isModulosRhEnrolled()) {
    return hashAllowedByRole(rol, h) || hasExplicitModuleGrant(moduleKey);
  }
  return true;
}

/** @deprecated Usar modulosMayAccessHash */
export function rhMayAccessHash(hash: string): boolean {
  return modulosMayAccessHash(hash, "rh");
}
