import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { hasExplicitModuleGrant, hasRhModule } from "./rhModulePermissions.ts";
import { getAccessToken } from "./session.ts";

function decodePayloadSegment(segment: string): Record<string, unknown> | null {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Lee el payload del JWT (sin verificar firma; la API sigue siendo la fuente de verdad). */
export function getAccessTokenPayload(): Record<string, unknown> | null {
  const token = getAccessToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  return decodePayloadSegment(parts[1]);
}

export function getRolFromAccessToken(): string | null {
  const p = getAccessTokenPayload();
  const r = p?.rol;
  return typeof r === "string" ? r : null;
}

/** Nombre para mostrar (viene en el JWT tras login). */
export function getUserDisplayNameFromAccessToken(): string {
  const p = getAccessTokenPayload();
  const n = p?.nombre;
  if (typeof n === "string" && n.trim()) {
    const raw = n.trim();
    return formatNombreEmpleadoUi(raw) || raw;
  }
  return "Usuario";
}

/** Iniciales para el avatar (2 caracteres). */
export function getUserInitialsFromAccessToken(): string {
  const name = getUserDisplayNameFromAccessToken();
  if (name === "Usuario") return "US";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] ?? "";
    const b = parts[parts.length - 1]![0] ?? "";
    return (a + b).toUpperCase();
  }
  return (parts[0] ?? "U").slice(0, 2).toUpperCase();
}

/** Panel administrativo /api/v1/usuarios (lista completa, inactivos, KPIs plantilla). */
export function canAccessUsuariosAdmin(): boolean {
  if (hasExplicitModuleGrant("empleados")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("empleados");
  return false;
}

/** Dashboard principal con tarjetas operativas (métricas mock / futura API dedicada). */
export function canAccessRhOperationalDashboard(): boolean {
  if (hasExplicitModuleGrant("dashboard")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("dashboard");
  return false;
}

/** Página de organigrama empresarial (`#/organigrama`) exclusiva para RH. */
export function canAccessOrganigramaPage(): boolean {
  if (hasExplicitModuleGrant("organigrama")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("organigrama");
  return false;
}

/** Vista operativa de comedor (`#/comedor`) exclusiva para RH. */
export function canAccessComedorRhPage(): boolean {
  if (hasExplicitModuleGrant("comedor")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("comedor");
  return false;
}

/** Tablero analítico «Reporte comedor» (`#/comedor/reporte`): alineado con GET estadisticas/proyecciones. */
export function canAccessComedorReportePage(): boolean {
  if (hasExplicitModuleGrant("reportes")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("reportes");
  return r === "gerente" || r === "director";
}

/** Vista de comedor para líderes (`#/comedor`): propio + equipo, sin analítica avanzada. */
export function canAccessComedorLiderPage(): boolean {
  const r = getRolFromAccessToken();
  return r === "supervisor" || r === "gerente";
}

/** Dashboard personal (vacaciones, HO, comidas) solo para el propio empleado. */
export function canAccessEmpleadoPersonalDashboard(): boolean {
  return getRolFromAccessToken() === "empleado";
}

/** Dashboard personal + equipo (tarjetas, aprobaciones, calendario del equipo). */
export function canAccessLiderTeamDashboard(): boolean {
  const r = getRolFromAccessToken();
  return r === "supervisor" || r === "gerente";
}

/** Calendario del equipo en `#/` (dashboard líder). Oculto para supervisor y gerente. */
export function canSeeDashboardTeamCalendar(): boolean {
  const r = getRolFromAccessToken();
  return r !== "supervisor" && r !== "gerente";
}

/** Directorio GET /api/v1/empleados (RH ve plantilla completa; otros solo activos). */
export function canAccessDirectorioEmpleados(): boolean {
  if (hasExplicitModuleGrant("empleados")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("empleados");
  return r === "gerente" || r === "director" || r === "supervisor";
}

/** Pantalla #/empleados (misma API de directorio para todos los roles anteriores). */
export function canAccessEmpleadosPage(): boolean {
  return canAccessDirectorioEmpleados();
}

/** KPIs de gestión (colaboradores + contratos) en #/empleados; no aplica a director ni RH. */
export function canAccessEmpleadosKpiGestionEquipo(): boolean {
  const r = getRolFromAccessToken();
  return r === "supervisor" || r === "gerente";
}

/** Vista administrativa global de solicitudes (`#/solicitudes`). Solo RH (catálogo completo de filtros). */
export function canAccessRhSolicitudesAdminPage(): boolean {
  if (hasExplicitModuleGrant("solicitudes")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("solicitudes");
  return false;
}

/** Analítica de solicitudes e incidencias (`#/metricas`). RH (global) y gerente (equipo). */
export function canAccessMetricasPage(): boolean {
  if (hasExplicitModuleGrant("metricas")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("metricas");
  return r === "gerente";
}

/** Gestión de solicitudes (`#/solicitudes`): RH, supervisores y gerentes (alcance y filtros según rol). */
export function canAccessSolicitudesGestorPage(): boolean {
  if (hasExplicitModuleGrant("solicitudes")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("solicitudes");
  return r === "supervisor" || r === "gerente";
}

/** Consulta de solicitudes propias o de equipo (`#/solicitudes`), incluyendo rol `empleado`. */
export function canAccessSolicitudesPage(): boolean {
  return canAccessSolicitudesGestorPage() || getRolFromAccessToken() === "empleado";
}

/**
 * Identificador del colaborador en sesión (p. ej. para filtrar solicitudes en portal).
 * Contrato JWT: ampliar cuando el backend lo incluya en el token.
 */
export function getEmpleadoIdFromAccessToken(): string | null {
  const p = getAccessTokenPayload();
  if (!p) return null;
  for (const k of ["empleado_id", "empleadoId", "id_empleado"] as const) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  /** Algunos JWT usan `sub` como id numérico de empleado (cuando aplique). */
  const sub = p.sub;
  if (typeof sub === "string" && /^\d+$/.test(sub.trim())) return sub.trim();
  return null;
}

/** Número de empleado de sesión (`num` en JWT actual). */
export function getNoEmpleadoFromAccessToken(): string | null {
  const p = getAccessTokenPayload();
  if (!p) return null;
  for (const k of ["num", "no_empleado", "noEmpleado"] as const) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Identificador numérico del directorio para mocks de solicitudes y modal (p. ej. `emp-1001` → 1001).
 * Solo acepta prefijo `emp-` + dígitos o una cadena numérica pura.
 */
export function parseEmpleadoDirectoryNumericId(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /^emp-(\d+)$/i.exec(s);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Id numérico de colaborador en directorio a partir del JWT (`empleado_id`, `emp-NNN`, `sub` numérico).
 * Usado para comparar con `empleado_id` de solicitudes (API numérico → string en filas).
 */
export function getEmpleadoDirectoryNumericIdFromAccessToken(): number | null {
  const raw = getEmpleadoIdFromAccessToken();
  if (raw == null || !raw.trim()) return null;
  return parseEmpleadoDirectoryNumericId(raw);
}

/** Vista de incidencias laborales (`#/incidencias`): RH, director, gerente y supervisor. */
export function canAccessRhIncidenciasPage(): boolean {
  if (hasExplicitModuleGrant("incidencias")) return true;
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("incidencias");
  return r === "director" || r === "gerente" || r === "supervisor";
}
