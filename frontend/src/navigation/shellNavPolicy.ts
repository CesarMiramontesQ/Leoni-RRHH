/**
 * Visibilidad del menú lateral y rutas permitidas por rol (fuente única para app shell + router).
 */

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
  | "habilidades"
  | "cursos"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "encuestas"
  | "level-up";

const EMPLEADO_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "solicitudes",
  "comedor",
  "capacitaciones",
]);

/**
 * Menú lateral para rol `rh` en versión 1.0 de producción.
 * Solo afecta visualización; rutas y permisos backend permanecen intactos.
 */
const RH_V1_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "metricas",
  "solicitudes",
  "incidencias",
  "comedor",
  "reportes",
  "empleados",
]);

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

const METRICAS_NAV_ROLES: ReadonlySet<string> = new Set(["rh", "gerente"]);

/** Items de Formación / Cumplimiento / Level Up visibles solo para director y gerente. */
const TALENTO_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "tareas-catalogo", "competencias", "capacidades", "habilidades",
  "cursos", "opls", "evidencias", "sugerencias", "encuestas", "level-up",
]);

/** Ítems del bloque visual «Talento» en el sidebar (encabezado + hijos). */
const TALENTO_SECTION_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "competencias", "evaluaciones", "capacitaciones",
]);

const TALENTO_SECTION_HIDDEN_ROLES: ReadonlySet<string> = new Set(["supervisor", "gerente"]);

/** Ítems del bloque visual «Formación» en el sidebar. */
const FORMACION_SECTION_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "capacidades", "habilidades", "cursos", "opls",
]);

/** Ítems del bloque visual «Cumplimiento» en el sidebar. */
const CUMPLIMIENTO_SECTION_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "evidencias", "sugerencias", "encuestas",
]);

const FORMACION_CUMPLIMIENTO_HIDDEN_ROLES: ReadonlySet<string> = new Set(["gerente"]);

const SUPERVISOR_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

const GERENTE_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

/**
 * Ítems del sidebar visibles según rol.
 * `empleado` y `rh` usan subconjuntos explícitos; el resto de roles conservan las reglas por defecto.
 */
export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  if (itemId === "organigrama" && !ORGANIGRAMA_MENU_VISIBLE) return false;
  if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  if (rol === "rh") return RH_V1_VISIBLE_NAV_IDS.has(itemId);
  if (itemId === "metricas") return METRICAS_NAV_ROLES.has(rol ?? "");
  if (RH_ONLY_NAV_IDS.has(itemId)) return rol === "rh";
  if (TALENTO_SECTION_NAV_IDS.has(itemId) && TALENTO_SECTION_HIDDEN_ROLES.has(rol ?? "")) return false;
  if (FORMACION_SECTION_NAV_IDS.has(itemId) && FORMACION_CUMPLIMIENTO_HIDDEN_ROLES.has(rol ?? "")) return false;
  if (CUMPLIMIENTO_SECTION_NAV_IDS.has(itemId) && FORMACION_CUMPLIMIENTO_HIDDEN_ROLES.has(rol ?? "")) return false;
  if (TALENTO_NAV_IDS.has(itemId)) return rol === "director" || rol === "gerente";
  if (rol === "supervisor" && SUPERVISOR_HIDDEN_NAV_IDS.has(itemId)) return false;
  if (rol === "gerente" && GERENTE_HIDDEN_NAV_IDS.has(itemId)) return false;
  return true;
}

/**
 * Hash actual permitido para `empleado` (evita acceso funcional escribiendo URL).
 */
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

/**
 * Rutas prohibidas para `supervisor` (hash manual o enlaces profundos).
 */
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
