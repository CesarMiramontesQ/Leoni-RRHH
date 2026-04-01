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

/** Panel administrativo /api/v1/usuarios (lista completa, inactivos, KPIs plantilla). */
export function canAccessUsuariosAdmin(): boolean {
  return getRolFromAccessToken() === "rh";
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
