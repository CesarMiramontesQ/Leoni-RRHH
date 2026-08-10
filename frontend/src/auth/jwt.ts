import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { hasExplicitModuleGrant, hasRhModule } from "./rhModulePermissions.ts";
import {
  isNonRhRhMode,
  isRhDirectorUiMode,
  isRhEmpleadoUiMode,
  isRhGerenteUiMode,
  isRhGestorTeamUiMode,
  isRhLiderUiMode,
  isRhOperativoUiMode,
} from "./rhUiMode.ts";
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

/** Admin en Modo RH o colaborador inscrito viendo módulos RH asignados. */
export function hasRhOperativeViewerContext(): boolean {
  return isRhOperativoUiMode() || isNonRhRhMode();
}

/** RH operativo o grant explícito del módulo (p. ej. comedor para reporte). */
export function hasRhOperativeViewerContextOrGrant(grantKey: string): boolean {
  if (hasRhOperativeViewerContext()) return true;
  return hasExplicitModuleGrant(grantKey);
}

type RhModuleAccessOpts = {
  blockGestorTeam?: boolean;
  blockEmpleado?: boolean;
  blockDirector?: boolean;
};

/** Acceso a módulo RH vía admin operativo, Modo RH inscrito o grant explícito. */
export function canAccessRhAssignedModule(moduleKey: string, opts: RhModuleAccessOpts = {}): boolean {
  if (opts.blockEmpleado && isRhEmpleadoUiMode()) return false;
  if (opts.blockGestorTeam && isRhGestorTeamUiMode()) return false;
  if (opts.blockDirector && isRhDirectorUiMode()) return false;
  if (hasExplicitModuleGrant(moduleKey)) return true;
  if (isRhOperativoUiMode()) return hasRhModule(moduleKey);
  if (isNonRhRhMode()) return hasRhModule(moduleKey);
  return false;
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
  return canAccessRhAssignedModule("empleados", { blockGestorTeam: true, blockDirector: true });
}

/** Dashboard principal con tarjetas operativas (métricas mock / futura API dedicada). */
export function canAccessRhOperationalDashboard(): boolean {
  return canAccessRhAssignedModule("dashboard", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });
}

/** Página de organigrama empresarial (`#/organigrama`) exclusiva para RH. */
export function canAccessOrganigramaPage(): boolean {
  return canAccessRhAssignedModule("organigrama");
}

/** Registro operativo de comedor (`#/comedor`) exclusiva para RH. */
export function canAccessComedorRhPage(): boolean {
  return canAccessRhAssignedModule("comedor-registro", { blockGestorTeam: true, blockDirector: true });
}

/** Planeación de menú (`#/comedor/planear`). */
export function canAccessComedorPlanearPage(): boolean {
  return canAccessRhAssignedModule("comedor-planear", { blockGestorTeam: true, blockDirector: true });
}

/** Ajustes Comedor (`#/comedor/ajustes`): horario de comida por turno. */
export function canAccessComedorAjustesPage(): boolean {
  return canAccessRhAssignedModule("comedor-ajustes", { blockGestorTeam: true, blockDirector: true });
}

/** Comedor personal para RH en modo empleado. */
export function canAccessComedorPersonalForRh(): boolean {
  return isRhEmpleadoUiMode();
}

/** Tablero analítico «Reporte comedor» (`#/comedor/reporte`): alineado con GET estadisticas/proyecciones. */
export function canAccessComedorReportePage(): boolean {
  if (canAccessRhAssignedModule("reportes")) return true;
  const r = getRolFromAccessToken();
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
  if (canAccessRhAssignedModule("empleados")) return true;
  const r = getRolFromAccessToken();
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
  return canAccessRhAssignedModule("solicitudes", { blockEmpleado: true });
}

/** Analítica de solicitudes e incidencias (`#/metricas`). RH (global), supervisor (equipo directo) y gerente (subárbol). */
export function canAccessMetricasPage(): boolean {
  if (isRhLiderUiMode() || isRhGerenteUiMode()) return true;
  if (canAccessRhAssignedModule("metricas")) return true;
  const r = getRolFromAccessToken();
  return r === "supervisor" || r === "gerente";
}

/** Gestión de solicitudes (`#/solicitudes`): RH, supervisores y gerentes (alcance y filtros según rol). */
export function canAccessSolicitudesGestorPage(): boolean {
  if (isRhEmpleadoUiMode()) return false;
  if (canAccessRhAssignedModule("solicitudes")) return true;
  const r = getRolFromAccessToken();
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
  if (isRhLiderUiMode() || isRhGerenteUiMode()) return true;
  if (canAccessRhAssignedModule("incidencias")) return true;
  const r = getRolFromAccessToken();
  return r === "director" || r === "gerente" || r === "supervisor";
}

/** Página de faltas y retardos (`#/faltas-retardos`). */
export function canAccessFaltasRetardosPage(): boolean {
  if (isRhEmpleadoUiMode() || isRhDirectorUiMode()) return false;
  if (isRhLiderUiMode() || isRhGerenteUiMode()) return true;
  if (canAccessRhAssignedModule("faltas-retardos")) return true;
  const r = getRolFromAccessToken();
  return r === "director" || r === "gerente" || r === "supervisor";
}

/**
 * Página de viajes laborales (`#/viajes-laborales`): exclusiva de RH.
 * Solo la ven el admin RH en Modo RH (operativo) y quien tenga el módulo
 * `viajes-laborales` otorgado desde Permisos RH; supervisor, gerente y
 * director (rol real o ADMIN emulando esos modos) ya no tienen acceso.
 */
export function canAccessViajesLaboralesPage(): boolean {
  return canAccessRhAssignedModule("viajes-laborales", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });
}

/** Aprobar/rechazar viajes: RH operativo o director. */
export function canApproveViajesLaborales(): boolean {
  if (isRhOperativoUiMode()) return true;
  if (isRhDirectorUiMode()) return true;
  const r = getRolFromAccessToken();
  return r === "director" || r === "rh";
}

/** Página de actas (`#/actas`): admin operativo o no-RH con módulo otorgado. */
export function canAccessActasPage(): boolean {
  return canAccessRhAssignedModule("actas", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });
}

/** Ajustes de Nóminas (`#/nominas/ajustes`): admin operativo o no-RH con módulo otorgado. */
export function canAccessNominasAjustesPage(): boolean {
  return canAccessRhAssignedModule("nominas-ajustes", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });
}
