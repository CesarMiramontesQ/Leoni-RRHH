import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { hasExplicitModuleGrant, hasRhModule } from "./rhModulePermissions.ts";
import { isRhDirectorUiMode, isRhEmpleadoUiMode, isRhGerenteUiMode, isRhGestorTeamUiMode, isRhLiderUiMode, isRhOperativoUiMode } from "./rhUiMode.ts";
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

/** Contexto de vistas/capacidades RH operativas (rol `rh` o ADMIN en Modo RH). */
export function hasRhOperativeViewerContext(): boolean {
  if (isRhOperativoUiMode()) return true;
  return getRolFromAccessToken() === "rh";
}

/** RH operativo o grant explícito del módulo (p. ej. comedor para reporte). */
export function hasRhOperativeViewerContextOrGrant(grantKey: string): boolean {
  if (hasRhOperativeViewerContext()) return true;
  return hasExplicitModuleGrant(grantKey);
}

/** Autorización para registrar horas extra (claim `he_autorizado`, administrada por RH en Ajustes de Nóminas). */
export function isHorasExtraRegistroAutorizado(): boolean {
  return getAccessTokenPayload()?.he_autorizado === true;
}

/**
 * Aprobador de horas extra (gerente regional o director) designado por RH en
 * Ajustes de Nóminas (claim `he_aprobador`). No depende del rol del sistema.
 */
export function isHorasExtraAprobador(): boolean {
  return getAccessTokenPayload()?.he_aprobador === true;
}

/** Capacidad gestor para usuarios RH (`supervisor` = líder, `gerente`). */
export function getRhGestorAlcanceFromToken(): "supervisor" | "gerente" | null {
  const p = getAccessTokenPayload();
  const alcance = p?.rh_gestor_alcance;
  if (alcance === "supervisor" || alcance === "gerente") return alcance;
  return null;
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

/** Rol de navegación efectivo (ADMIN en modo operativo de su rol → supervisor/gerente/director/empleado). */
export function getEffectiveGestorNavRol(): string | null {
  if (isRhLiderUiMode()) return "supervisor";
  if (isRhGerenteUiMode()) return "gerente";
  if (isRhDirectorUiMode()) return "director";
  if (isRhEmpleadoUiMode()) return "empleado";
  return getRolFromAccessToken();
}

/** Panel administrativo /api/v1/usuarios (lista completa, inactivos, KPIs plantilla). */
export function canAccessUsuariosAdmin(): boolean {
  if (isRhGestorTeamUiMode() || isRhEmpleadoUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("empleados")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("empleados");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("empleados");
  return false;
}

/** Dashboard principal con tarjetas operativas (métricas mock / futura API dedicada). */
export function canAccessRhOperationalDashboard(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("dashboard")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("dashboard");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("dashboard");
  return false;
}

/** Página de organigrama empresarial (`#/organigrama`) exclusiva para RH. */
export function canAccessOrganigramaPage(): boolean {
  if (hasExplicitModuleGrant("organigrama")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("organigrama");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("organigrama");
  return false;
}

/** Vista operativa de comedor (`#/comedor`) exclusiva para RH. */
export function canAccessComedorRhPage(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("comedor")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("comedor");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("comedor");
  return false;
}

/** Comedor personal para RH en modo empleado. */
export function canAccessComedorPersonalForRh(): boolean {
  return isRhEmpleadoUiMode();
}

/** Tablero analítico «Reporte comedor» (`#/comedor/reporte`): alineado con GET estadisticas/proyecciones. */
export function canAccessComedorReportePage(): boolean {
  if (hasExplicitModuleGrant("reportes")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("reportes");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("reportes");
  return r === "gerente" || r === "director";
}

/** Vista de comedor para líderes (`#/comedor`): propio + equipo, sin analítica avanzada. */
export function canAccessComedorLiderPage(): boolean {
  if (isRhOperativoUiMode()) return false;
  const r = getRolFromAccessToken();
  if (r === "supervisor" || r === "gerente") return true;
  return isRhGestorTeamUiMode();
}

/** Dashboard personal (vacaciones, HO, comidas) solo para el propio empleado. */
export function canAccessEmpleadoPersonalDashboard(): boolean {
  if (isRhOperativoUiMode()) return false;
  if (isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (isRhEmpleadoUiMode()) return true;
  return getRolFromAccessToken() === "empleado";
}

/** Dashboard personal + equipo (tarjetas, aprobaciones, calendario del equipo). */
export function canAccessLiderTeamDashboard(): boolean {
  if (isRhOperativoUiMode()) return false;
  if (isRhGestorTeamUiMode()) return true;
  const r = getRolFromAccessToken();
  return r === "supervisor" || r === "gerente";
}

/** Calendario del equipo en `#/` (dashboard líder). Oculto para supervisor y gerente. */
export function canSeeDashboardTeamCalendar(): boolean {
  if (isRhOperativoUiMode()) return true;
  const r = getEffectiveGestorNavRol();
  return r !== "supervisor" && r !== "gerente";
}

/** Directorio GET /api/v1/empleados (RH ve plantilla completa; otros solo activos). */
export function canAccessDirectorioEmpleados(): boolean {
  if (isRhGestorTeamUiMode()) return true;
  if (hasExplicitModuleGrant("empleados")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("empleados");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("empleados");
  return r === "gerente" || r === "director" || r === "supervisor";
}

/** Pantalla #/empleados (misma API de directorio para todos los roles anteriores). */
export function canAccessEmpleadosPage(): boolean {
  return canAccessDirectorioEmpleados();
}

/** KPIs de gestión (colaboradores + contratos) en #/empleados; no aplica a director ni RH operativo. */
export function canAccessEmpleadosKpiGestionEquipo(): boolean {
  if (isRhGestorTeamUiMode()) return true;
  const r = getEffectiveGestorNavRol();
  return r === "supervisor" || r === "gerente";
}

/** Vista administrativa global de solicitudes (`#/solicitudes`). Solo RH (catálogo completo de filtros). */
export function canAccessRhSolicitudesAdminPage(): boolean {
  if (isRhEmpleadoUiMode()) return false;
  if (hasExplicitModuleGrant("solicitudes")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("solicitudes");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("solicitudes");
  return false;
}

/** Analítica de solicitudes e incidencias (`#/metricas`). RH (global), supervisor (equipo directo) y gerente (subárbol). */
export function canAccessMetricasPage(): boolean {
  if (isRhGerenteUiMode()) return true;
  if (isRhGestorTeamUiMode()) return false;
  if (hasExplicitModuleGrant("metricas")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("metricas");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("metricas");
  return r === "supervisor" || r === "gerente";
}

/** Gestión de solicitudes (`#/solicitudes`): RH, supervisores y gerentes (alcance y filtros según rol). */
export function canAccessSolicitudesGestorPage(): boolean {
  if (isRhEmpleadoUiMode()) return false;
  if (hasExplicitModuleGrant("solicitudes")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("solicitudes");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("solicitudes");
  return r === "supervisor" || r === "gerente";
}

/** Consulta de solicitudes propias o de equipo (`#/solicitudes`), incluyendo rol `empleado`. */
export function canAccessSolicitudesPage(): boolean {
  if (isRhEmpleadoUiMode()) return true;
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
  if (isRhOperativoUiMode()) return hasRhModule("incidencias");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("incidencias");
  return r === "director" || r === "gerente" || r === "supervisor";
}

/** Página de faltas y retardos (`#/faltas-retardos`). */
export function canAccessFaltasRetardosPage(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("faltas-retardos")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("faltas-retardos");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("faltas-retardos");
  return r === "director" || r === "gerente" || r === "supervisor";
}

/** Página de actas (`#/actas`): RH con módulo `actas` o no-RH con el módulo otorgado. */
export function canAccessActasPage(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("actas")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("actas");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("actas");
  return false;
}

/** Ajustes de Nóminas (`#/nominas/ajustes`): RH con módulo o no-RH con el módulo otorgado. */
export function canAccessNominasAjustesPage(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant("nominas-ajustes")) return true;
  if (isRhOperativoUiMode()) return hasRhModule("nominas-ajustes");
  const r = getRolFromAccessToken();
  if (r === "rh") return hasRhModule("nominas-ajustes");
  return false;
}
