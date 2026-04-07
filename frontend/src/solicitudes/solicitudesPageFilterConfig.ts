import { getRolFromAccessToken } from "../auth/jwt.ts";

/** Roles con acceso a `#/solicitudes` (gestores + empleado). */
export type SolicitudesPageRole = "rh" | "supervisor" | "gerente" | "empleado";

export type SolicitudesPageVariant = "gestor" | "empleado";

export type RequestFilterKey = "area" | "supervisor" | "type" | "employee" | "status" | "period";

export const filtersByRole: Record<SolicitudesPageRole, readonly RequestFilterKey[]> = {
  rh: ["area", "supervisor", "type", "employee", "status", "period"],
  supervisor: ["type", "employee", "status", "period"],
  gerente: ["type", "employee", "status", "period"],
  empleado: ["type", "status"],
} as const;

/**
 * Claves que ya tienen control en la barra de filtros.
 * `period` permanece solo en `filtersByRole` hasta incorporar rango de fechas (API/UI).
 */
export const SOLICITUDES_FILTER_KEYS_WITH_UI: ReadonlySet<RequestFilterKey> = new Set([
  "area",
  "supervisor",
  "type",
  "employee",
  "status",
]);

export type SolicitudesPageUiConfig = {
  variant: SolicitudesPageVariant;
  role: SolicitudesPageRole;
  visibleFilterKeys: readonly RequestFilterKey[];
  /** KPIs agregados del alcance (gestores). */
  showStatsCards: boolean;
  /** KPIs personales del colaborador. */
  showEmployeePersonalStats: boolean;
  /** Botón exportar listado (solo RH en toolbar gestor). */
  showExportButton: boolean;
  /** Botón «Nueva solicitud» en el encabezado. */
  showNewRequestButton: boolean;
  /** Exportar + nueva solicitud en nombre de terceros (compat: ambos gestor). */
  showGestorToolbar: boolean;
};

/** Alcance de datos para mock / futura API. */
export type SolicitudesDataScope = "rh_global" | "lider_equipo" | "empleado_self";

export function normalizeSolicitudesPageRole(rol: string | null): SolicitudesPageRole | null {
  if (rol === "rh" || rol === "supervisor" || rol === "gerente" || rol === "empleado") return rol;
  return null;
}

export function getSolicitudesPageRoleFromSession(): SolicitudesPageRole | null {
  return normalizeSolicitudesPageRole(getRolFromAccessToken());
}

export function resolveVisibleFilterKeys(role: SolicitudesPageRole): RequestFilterKey[] {
  return filtersByRole[role].filter((k) => SOLICITUDES_FILTER_KEYS_WITH_UI.has(k));
}

export function buildDefaultSolicitudesPageUiConfig(role: SolicitudesPageRole): SolicitudesPageUiConfig {
  const variant: SolicitudesPageVariant = role === "empleado" ? "empleado" : "gestor";
  const isGestor = variant === "gestor";
  return {
    variant,
    role,
    visibleFilterKeys: resolveVisibleFilterKeys(role),
    showStatsCards: isGestor,
    showEmployeePersonalStats: variant === "empleado",
    showExportButton: isGestor,
    showNewRequestButton: true,
    showGestorToolbar: isGestor,
  };
}

export function dataScopeForSolicitudesRole(role: SolicitudesPageRole): SolicitudesDataScope {
  if (role === "rh") return "rh_global";
  if (role === "empleado") return "empleado_self";
  return "lider_equipo";
}
