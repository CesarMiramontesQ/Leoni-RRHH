import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
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
  return getRolFromAccessToken() === "rh";
}

/** Dashboard principal con tarjetas operativas (métricas mock / futura API dedicada). */
export function canAccessRhOperationalDashboard(): boolean {
  return getRolFromAccessToken() === "rh";
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

/** Directorio GET /api/v1/empleados (RH ve plantilla completa; otros solo activos). */
export function canAccessDirectorioEmpleados(): boolean {
  const r = getRolFromAccessToken();
  return r === "rh" || r === "gerente" || r === "director" || r === "supervisor";
}

/** Pantalla #/empleados (misma API de directorio para todos los roles anteriores). */
export function canAccessEmpleadosPage(): boolean {
  return canAccessDirectorioEmpleados();
}
