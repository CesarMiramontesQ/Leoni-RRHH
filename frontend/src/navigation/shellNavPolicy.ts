/**
 * Visibilidad del menú lateral y rutas permitidas por rol (fuente única para app shell + router).
 */

export type AppShellNavItemId =
  | "dashboard"
  | "organigrama"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "empleados"
  | "reportes"
  | "auditoria"
  | "notificaciones"
  | "ajustes";

const EMPLEADO_VISIBLE_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "dashboard",
  "solicitudes",
  "comedor",
  "notificaciones",
]);

const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set(["organigrama"]);

/**
 * Ítems del sidebar visibles según rol. Para `empleado` solo el subconjunto definido; el resto de roles ven todo.
 */
export function isShellNavItemVisibleForRol(rol: string | null, itemId: AppShellNavItemId): boolean {
  if (rol === "empleado") return EMPLEADO_VISIBLE_NAV_IDS.has(itemId);
  if (RH_ONLY_NAV_IDS.has(itemId)) return rol === "rh";
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
  return false;
}
