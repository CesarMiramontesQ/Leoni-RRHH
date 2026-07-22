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
import { isNominasHubVisibleForRol } from "./nominasNav.ts";
import { canApproveOvertime, canRegisterOvertime } from "../auth/payrollPermissions.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { isNonRhRhMode, isAdminUser, hasRhPermisosActivos, isRhDirectorUiMode, isRhEmpleadoUiMode, isRhGerenteUiMode, isRhGestorTeamUiMode, isRhLiderUiMode, isRhOperativoUiMode } from "../auth/rhUiMode.ts";

/** Ruta segura cuando un RH inscrito no tiene ningún módulo asignado. */
export const RH_SIN_PERMISOS_HASH = "#/sin-permisos-rh";

/** Pantalla de bienvenida en Modo RH cuando no hay grant de dashboard. */
export const RH_MODO_INICIO_HASH = "#/rh-inicio";

/** Rol de navegación para admin operativo o inscrito en Modo RH (no es el JWT `rol`). */
export const OPERATIVO_NAV_ROL = "operativo" as const;

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
  { itemId: "faltas-retardos", hash: "#/faltas-retardos" },
  { itemId: "viajes-laborales", hash: "#/viajes-laborales" },
  { itemId: "actas", hash: "#/actas" },
  { itemId: "comedor", hash: "#/comedor" },
  { itemId: "reportes", hash: "#/comedor/reporte" },
  { itemId: "level-up", hash: "#/level-up/resumen" },
  { itemId: "puestos", hash: "#/puestos" },
  { itemId: "competencias", hash: "#/competencias" },
  { itemId: "tareas-catalogo", hash: "#/tareas-catalogo" },
  { itemId: "evaluaciones", hash: "#/evaluaciones" },
  { itemId: "pdi-gestion", hash: "#/pdi-gestion" },
  { itemId: "evaluacion-360", hash: "#/level-up/evaluacion-360" },
  { itemId: "capacidades", hash: "#/capacidades" },
  { itemId: "cursos", hash: "#/cursos" },
  { itemId: "sesiones", hash: "#/sesiones" },
  { itemId: "opls", hash: "#/opls" },
  { itemId: "evidencias", hash: "#/evidencias" },
  { itemId: "sugerencias", hash: "#/sugerencias" },
  { itemId: "encuestas", hash: "#/encuestas" },
  { itemId: "empleados", hash: "#/empleados" },
  { itemId: "horas-extra", hash: "#/nominas/horas-extra" },
  { itemId: "conciliacion", hash: "#/nominas/conciliacion" },
  { itemId: "nominas-ajustes", hash: "#/nominas/ajustes" },
];

export function isRhHomeHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  return h === "" || h === "#" || h === "#/";
}

/** Primera página del menú RH a la que el usuario tiene acceso; null si ninguna. */
export function resolveRhOperativoLandingHash(): string | null {
  const rol = getRolFromAccessToken();
  for (const entry of RH_NAV_LANDING_ORDER) {
    if (isShellNavItemVisibleForRol(rol, entry.itemId)) {
      return entry.hash;
    }
  }
  if (canAccessRhPermisosAdmin()) {
    return "#/ajustes/permisos-rh";
  }
  return null;
}

/**
 * Home de Modo RH: dashboard si hay grant; bienvenida si hay otros módulos;
 * sin-permisos si no hay ninguno.
 */
export function resolveRhModoHomeHash(): string {
  if (hasExplicitModuleGrant("dashboard") || (isAdminUser() && isRhOperativoUiMode())) {
    return "#/";
  }
  if (hasRhPermisosActivos()) {
    return RH_MODO_INICIO_HASH;
  }
  return RH_SIN_PERMISOS_HASH;
}

/**
 * Hash inicial tras login o recarga para usuarios RH con permisos limitados.
 * Solo ajusta la ruta de inicio (#/); no altera deep links válidos.
 */
export function resolveRhInitialHash(currentHash?: string): string {
  const h = (currentHash ?? (typeof window !== "undefined" ? window.location.hash : "") ?? "#/").trim() || "#/";
  if (isAdminUser()) {
    if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) {
      return isRhHomeHash(h) ? "#/" : h;
    }
    if (!isRhHomeHash(h)) return h;
    return resolveRhModoHomeHash();
  }
  if (isModulosRhEnrolled() && isNonRhRhMode()) {
    if (!isRhHomeHash(h)) return h;
    return resolveRhModoHomeHash();
  }
  return h;
}

/**
 * Dashboard de aterrizaje al alternar Modo RH / modo operativo (toggle).
 * Siempre redirige al inicio del modo activo, sin conservar deep links.
 */
export function resolveRhModeLandingHash(): string {
  if (isAdminUser()) {
    if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) {
      return "#/";
    }
    return resolveRhModoHomeHash();
  }
  if (isModulosRhEnrolled() && isNonRhRhMode()) {
    return resolveRhModoHomeHash();
  }
  return "#/";
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
  | "faltas-retardos"
  | "viajes-laborales"
  | "comedor"
  | "comedor-menu"
  | "comedor-gestion"
  | "comedor-planear"
  | "empleados"
  | "evaluaciones"
  | "pdi-gestion"
  | "evaluacion-360"
  | "reportes"
  | "puestos"
  | "puestos-ajustes"
  | "tareas-catalogo"
  | "competencias"
  | "capacidades"
  | "cursos"
  | "cursos-seguimiento"
  | "cursos-ajustes"
  | "cursos-juntas"
  | "cursos-proveedores"
  | "cursos-externos"
  | "cursos-vencimientos"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "sesiones"
  | "encuestas"
  | "encuestas-rh"
  | "metas"
  | "ciclo-desempeno"
  | "historial-objetivo"
  | "mis-encuestas"
  | "mis-encuestas-rh"
  | "mis-metas"
  | "mi-desempeno"
  | "mis-evaluaciones"
  | "level-up"
  | "nominas"
  | "horas-extra"
  | "horas-extra-aprobaciones"
  | "horas-extra-solicitud"
  | "conciliacion"
  | "nominas-ajustes";

const EMPLEADO_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "solicitudes",
  "comedor",
  "mis-encuestas",
  "mis-encuestas-rh",
  "mis-metas",
  "mi-desempeno",
  "mis-evaluaciones",
]);

/** Rol con menú lateral plano (sin hubs ni submenús). */
export function isEmpleadoFlatNavRol(rol: string | null): boolean {
  if (isRhOperativoUiMode()) return false;
  if (rol === "empleado") return true;
  return isRhEmpleadoUiMode();
}

const SUPERVISOR_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "metricas",
  "incidencias",
  "faltas-retardos",
  "viajes-laborales",
  "solicitudes",
  "mis-encuestas",
  "mis-encuestas-rh",
  "mis-metas",
  "metas",
  "mi-desempeno",
  "ciclo-desempeno",
  "historial-objetivo",
  "comedor",
  "empleados",
]);

/** Rol con menú lateral estructurado por secciones (Laborales, Comedor). */
export function isSupervisorStructuredNavRol(rol: string | null): boolean {
  if (isRhOperativoUiMode()) return false;
  if (rol === "supervisor" || rol === "gerente") return true;
  return isRhGestorTeamUiMode();
}

/** ADMIN en modo operativo: sidebar con secciones desplegables (Laborales, Comedor, Level Up). */
export function isRhStructuredNavRol(rol: string | null): boolean {
  void rol;
  return isRhOperativoUiMode();
}

/** Usa el sidebar RH estructurado (acordeón): admin operativo o no-RH en Modo RH. */
export function usesRhStructuredSidebar(rol: string | null): boolean {
  return isRhStructuredNavRol(rol) || isNonRhRhMode();
}

/** Supervisor y gerente comparten política de rutas permitidas (sin hubs ni módulos extra). */
export function usesSupervisorRoutePolicy(rol: string | null): boolean {
  if (isRhGestorTeamUiMode()) return true;
  return rol === "supervisor" || rol === "gerente";
}

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

const METRICAS_NAV_ROLES: ReadonlySet<string> = new Set([OPERATIVO_NAV_ROL, "gerente", "supervisor"]);

const NOMINAS_NAV_ROLES: ReadonlySet<string> = new Set([OPERATIVO_NAV_ROL, "director", "gerente"]);

const TALENTO_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "puestos-ajustes", "tareas-catalogo", "competencias", "capacidades",
  "cursos", "cursos-seguimiento", "cursos-ajustes", "cursos-juntas", "cursos-proveedores", "cursos-externos", "cursos-vencimientos", "sesiones", "opls", "evidencias", "sugerencias", "encuestas", "encuestas-rh", "metas", "ciclo-desempeno", "historial-objetivo", "level-up",
]);

const SUPERVISOR_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

const GERENTE_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set();

function effectiveShellNavRol(rol: string | null): string | null {
  if (isRhLiderUiMode()) return "supervisor";
  if (isRhGerenteUiMode()) return "gerente";
  if (isRhDirectorUiMode()) return "director";
  if (isRhEmpleadoUiMode()) return "empleado";
  if (isRhOperativoUiMode() || isNonRhRhMode()) return OPERATIVO_NAV_ROL;
  return rol;
}

function roleOnlyNavVisible(rol: string | null, itemId: AppShellNavItemId): boolean {
  const navRol = effectiveShellNavRol(rol);
  if (itemId === "organigrama" && !ORGANIGRAMA_MENU_VISIBLE) return false;
  // `horas-extra-solicitud` y `horas-extra-aprobaciones` se resuelven antes de
  // llegar aquí (Regla B, en isShellNavItemVisibleForRol).
  if (itemId === "nominas-ajustes") return navRol === OPERATIVO_NAV_ROL;
  if (!isRhOperativoUiMode()) {
    if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
    if (rol === "supervisor" || rol === "gerente") return SUPERVISOR_VISIBLE_NAV_IDS.has(itemId);
    if (isRhGestorTeamUiMode() && (navRol === "supervisor" || navRol === "gerente")) {
      return SUPERVISOR_VISIBLE_NAV_IDS.has(itemId);
    }
  }
  if (itemId === "metricas") return METRICAS_NAV_ROLES.has(navRol ?? "");
  if (itemId === "evaluacion-360") return navRol === OPERATIVO_NAV_ROL;
  if (itemId === "nominas" || itemId === "horas-extra" || itemId === "conciliacion") {
    return NOMINAS_NAV_ROLES.has(navRol ?? "");
  }
  if (RH_ONLY_NAV_IDS.has(itemId)) return navRol === OPERATIVO_NAV_ROL;
  if (TALENTO_NAV_IDS.has(itemId)) {
    return navRol === OPERATIVO_NAV_ROL || navRol === "director" || navRol === "gerente";
  }
  if (navRol === "supervisor" && rol !== "supervisor" && SUPERVISOR_HIDDEN_NAV_IDS.has(itemId)) return false;
  if (navRol === "gerente" && GERENTE_HIDDEN_NAV_IDS.has(itemId)) return false;
  return true;
}

function moduleNavAllowed(rol: string | null, itemId: AppShellNavItemId): boolean {
  void rol;
  const moduleKey = navItemIdToModuleKey(itemId);
  if (isRhOperativoUiMode() || isNonRhRhMode()) {
    return hasRhModule(moduleKey);
  }
  if (isModulosRhEnrolled()) return hasExplicitModuleGrant(moduleKey);
  return true;
}

export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  // Regla B (operativa): registrar/aprobar horas extra depende ÚNICAMENTE de la
  // autorización explícita en Ajustes de Nómina, nunca del permiso RH de Nóminas
  // (Regla A) ni del rol. Autoritativo en todos los caminos.
  if (itemId === "horas-extra-aprobaciones") return canApproveOvertime();
  if (itemId === "horas-extra-solicitud") return canRegisterOvertime();
  // No-RH en Modo RH: ver únicamente los módulos asignados (hoy Nóminas es el
  // único cableado a hub). En modo base se cae al comportamiento normal de su rol.
  if (isNonRhRhMode()) {
    if (itemId === "nominas") return isNominasHubVisibleForRol(rol);
    return hasExplicitModuleGrant(navItemIdToModuleKey(itemId));
  }
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
  // Gestión de comedores y Planeación: mismas reglas de acceso que canAccessComedorRhPage
  // (módulo `comedor`). Visibles solo para RH con el módulo o no-RH con grant explícito;
  // ocultas para roles sin acceso y para RH en Modo empleado/gestor.
  if (itemId === "comedor-gestion" || itemId === "comedor-planear") {
    if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
    const moduleKey = navItemIdToModuleKey(itemId);
    if (hasExplicitModuleGrant(moduleKey)) return true;
    if (isRhOperativoUiMode() || isNonRhRhMode()) return hasRhModule(moduleKey);
    return false;
  }
  if (itemId === "nominas") {
    return isNominasHubVisibleForRol(rol);
  }
  const byRole = roleOnlyNavVisible(rol, itemId);
  if (isRhEmpleadoUiMode()) {
    return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  }
  if (isRhGestorTeamUiMode() || isRhDirectorUiMode()) {
    return byRole;
  }
  if (isRhOperativoUiMode() || isNonRhRhMode()) {
    return byRole && moduleNavAllowed(rol, itemId);
  }
  // Sin Modo RH: solo la navegación del rol operativo base.
  return byRole;
}

export function empleadoMayAccessHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  if (h === "" || h === "#" || h === "#/") return true;
  if (h.startsWith("#/horas-extra/solicitud")) return canRegisterOvertime();
  if (h.startsWith("#/nominas/horas-extra/aprobaciones")) return canApproveOvertime();
  if (h.startsWith("#/solicitudes")) return true;
  if (h.startsWith("#/comedor")) return true;
  if (h.startsWith("#/mis-encuestas")) return true;
  if (h.startsWith("#/talento/mis-encuestas")) return true;
  if (h.startsWith("#/talento/mis-metas")) return true;
  if (h.startsWith("#/talento/mi-desempeno")) return true;
  if (h.startsWith("#/mis-evaluaciones")) return true;
  if (h.startsWith("#/notificaciones")) return true;
  if (h.startsWith("#/metricas")) return false;
  return false;
}

export function supervisorMayAccessHash(hash: string): boolean {
  const h = (hash || "#/").trim();
  if (h.startsWith("#/horas-extra/solicitud")) return canRegisterOvertime();
  if (h.startsWith("#/nominas/horas-extra/aprobaciones")) return canApproveOvertime();
  if (h.startsWith("#/nominas/ajustes")) return false;
  if (h.startsWith("#/actas")) return false;
  if (h.startsWith("#/comedor/reporte")) return false;
  if (h.startsWith("#/reportes")) return false;
  if (h.startsWith("#/pdi-gestion")) return true;
  if (h.startsWith("#/evaluaciones")) return true;
  if (h.startsWith("#/cumplimiento/historial-objetivo")) return true;
  if (h.startsWith("#/level-up/evaluacion-360")) return false;
  return true;
}

function hashAllowedByRole(rol: string | null, hash: string): boolean {
  if (rol === "empleado") return empleadoMayAccessHash(hash);
  if (usesSupervisorRoutePolicy(rol)) return supervisorMayAccessHash(hash);
  return true;
}

/**
 * Hash final a enrutar aplicando las compuertas de ruta por rol (empleado/supervisor).
 * Para un no-RH INSCRITO en permisos RH (`enrolledNonRh`), `modulosMayAccessHash` ya es
 * la autoridad de acceso (rol base + grants en Modo RH), así que las compuertas por rol
 * NO se aplican: respetar el grant de páginas RH-exclusivas en lugar de redirigir a `#/`.
 */
export function resolveRoutedHashForRol(
  rol: string | null,
  rawHash: string,
  opts: { enrolledNonRh: boolean },
): string {
  if (opts.enrolledNonRh) return rawHash;
  if (isRhOperativoUiMode()) return rawHash;
  if (rol === "empleado" && !empleadoMayAccessHash(rawHash)) return "#/";
  if (usesSupervisorRoutePolicy(rol) && !supervisorMayAccessHash(rawHash)) return "#/";
  return rawHash;
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
  if (h.startsWith("#/nominas")) {
    if (h.startsWith("#/nominas/horas-extra/aprobaciones")) return canApproveOvertime();
    const pageModule = resolveModuleFromHash(h);
    if (isRhOperativoUiMode()) {
      if (pageModule === null) return isNominasHubVisibleForRol(rol);
      return hasRhModule(pageModule);
    }
    if (pageModule === null) return isNominasHubVisibleForRol(rol); // hub raíz #/nominas
    // No-RH: acceso por grant solo en Modo RH; en modo base, navegación por rol.
    const grant = isNonRhRhMode() && hasExplicitModuleGrant(pageModule);
    if (h.startsWith("#/nominas/ajustes")) return grant; // Ajustes es RH-exclusivo (no-RH solo por grant)
    return NOMINAS_NAV_ROLES.has(rol ?? "") || grant;
  }
  if (h.startsWith("#/notificaciones")) return true;
  if (h.startsWith(RH_MODO_INICIO_HASH)) {
    return (isRhOperativoUiMode() || isNonRhRhMode()) && hasRhPermisosActivos();
  }
  if (h.startsWith(RH_SIN_PERMISOS_HASH)) {
    return isRhOperativoUiMode() || isNonRhRhMode();
  }
  if (h.startsWith("#/ajustes/permisos-rh")) {
    return isRhOperativoUiMode() && canAccessRhPermisosAdmin();
  }

  const moduleKey = resolveModuleFromHash(h);
  if (moduleKey === null) return true;

  if (isRhOperativoUiMode() || isNonRhRhMode()) {
    if (isRhHomeHash(h)) {
      return hasRhModule("dashboard");
    }
    if (h.startsWith("#/comedor/reporte") || h.startsWith("#/reportes")) {
      return hasRhModule("reportes");
    }
    if (h.startsWith("#/comedor/gestion") || h.startsWith("#/comedor/codigos-externos")) {
      return hasRhModule("comedor-gestion");
    }
    if (h.startsWith("#/comedor/planear")) {
      return hasRhModule("comedor-planear");
    }
    if (h.startsWith("#/comedor")) {
      return hasRhModule("comedor-registro");
    }
    return hasRhModule(moduleKey);
  }

  if (isModulosRhEnrolled()) {
    // Modo RH: rol base + grants; Modo base: solo rutas del rol.
    if (isNonRhRhMode()) {
      if (isRhHomeHash(h)) return hasExplicitModuleGrant("dashboard");
      return hashAllowedByRole(rol, h) || hasExplicitModuleGrant(moduleKey);
    }
    return hashAllowedByRole(rol, h);
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

/** Control de hash para usuarios ADMIN según modo UI. */
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
  if (isRhDirectorUiMode()) {
    const h = (hash || "#/").trim();
    if (h.startsWith("#/ajustes/permisos-rh") || h.startsWith(RH_SIN_PERMISOS_HASH)) return false;
    return hashAllowedByRole("director", hash);
  }
  return modulosMayAccessHash(hash, getRolFromAccessToken());
}

