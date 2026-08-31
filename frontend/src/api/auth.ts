import { fetchWithAuth } from "./http.ts";
import type { AreaResponse, ClasificacionEmpleadoResponse } from "./usuarios.ts";

export type AuthMeResponse = {
  id: number;
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  clasificacion: ClasificacionEmpleadoResponse | null;
  area: AreaResponse | null;
};

export type AuthFetchError = {
  status: number;
  detail: string;
};

export function isAuthFetchError(e: unknown): e is AuthFetchError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    "detail" in e &&
    typeof (e as AuthFetchError).detail === "string"
  );
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export type SessionPolicy = {
  idle_timeout_seconds: number;
};

/** Timeout de inactividad (público; 0 = desactivado). */
export async function getSessionPolicy(): Promise<SessionPolicy> {
  const res = await fetch("/api/v1/auth/session-policy");
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } satisfies AuthFetchError;
  }
  return (await res.json()) as SessionPolicy;
}

/** Invalida el access token actual en el servidor. Falla silencioso si ya no hay sesión. */
export async function logoutSession(): Promise<void> {
  try {
    await fetchWithAuth("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* el cliente limpia igual */
  }
}

/** Perfil del usuario autenticado (incluye clasificación para reglas de solicitudes). */
export async function getAuthMe(): Promise<AuthMeResponse> {
  const res = await fetchWithAuth("/api/v1/auth/me");
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } satisfies AuthFetchError;
  }
  return (await res.json()) as AuthMeResponse;
}
