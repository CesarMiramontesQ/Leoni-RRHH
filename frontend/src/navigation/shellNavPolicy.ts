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

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

const METRICAS_NAV_ROLES: ReadonlySet<string> = new Set(["rh", "gerente"]);

/** Items visibles solo para rh, director, gerente (Talento + Level Up). */
const TALENTO_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "puestos", "competencias", "capacidades", "habilidades",
  "cursos", "opls", "evidencias", "sugerencias", "encuestas", "level-up",
]);

const SUPERVISOR_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["actas", "reportes"]);

const GERENTE_HIDDEN_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set();

/**
 * Ítems del sidebar visibles según rol. Para `empleado` solo el subconjunto definido; el resto de roles ven todo.
 */
export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  if (itemId === "organigrama" && !ORGANIGRAMA_MENU_VISIBLE) return false;
  if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  if (itemId === "metricas") return METRICAS_NAV_ROLES.has(rol ?? "");
  if (RH_ONLY_NAV_IDS.has(itemId)) return rol === "rh";
  if (TALENTO_NAV_IDS.has(itemId)) return rol === "rh" || rol === "director" || rol === "gerente";
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
