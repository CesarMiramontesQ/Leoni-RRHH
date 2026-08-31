import { getAccessToken, getRefreshToken, updateAccessToken } from "../auth/session.ts";
import { getRhUiModeHeaderValue } from "../auth/rhUiMode.ts";
import { pauseIdleDuring } from "../auth/sessionIdlePause.ts";

/** Renueva el access token con el refresh guardado en sesión (p. ej. al abrir la app). */
export async function refreshAccessTokenSession(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  let res: Response;
  try {
    res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    return false;
  }

  if (!res.ok) return false;

  const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!data?.access_token) return false;

  updateAccessToken(data.access_token);
  return true;
}

/**
 * Cancelación por `AbortSignal`: se distingue del fallo de red para que quien
 * canceló su propia petición no muestre "no se pudo conectar con el servidor".
 */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : (e as { name?: string })?.name === "AbortError";
}

export type FetchWithAuthOptions = {
  /** Pausa el idle hasta que termina (exports / descargas largas). El polling no lo usa. */
  pauseIdle?: boolean;
};

/**
 * fetch con Bearer; ante 401 intenta un refresh y reintenta una vez.
 */
export async function fetchWithAuth(
  url: string,
  init: RequestInit = {},
  opts: FetchWithAuthOptions = {},
): Promise<Response> {
  const run = (): Promise<Response> => fetchWithAuthOnce(url, init);
  if (opts.pauseIdle) return pauseIdleDuring(run);
  return run();
}

async function fetchWithAuthOnce(url: string, init: RequestInit): Promise<Response> {
  const doFetch = (): Promise<Response> => {
    const token = getAccessToken();
    const headers = new Headers(init.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const rhUiMode = getRhUiModeHeaderValue();
    if (rhUiMode) {
      headers.set("X-RH-UI-Mode", rhUiMode);
    }
    return fetch(url, { ...init, headers });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (e: unknown) {
    if (isAbortError(e)) throw e;
    throw new Error(
      "No se pudo conectar con el servidor. Comprueba que el backend esté en ejecución (docker-compose up).",
    );
  }
  if (res.status !== 401) {
    return res;
  }

  const refreshed = await refreshAccessTokenSession();
  if (!refreshed) {
    return res;
  }

  try {
    return await doFetch();
  } catch (e: unknown) {
    if (isAbortError(e)) throw e;
    throw new Error(
      "No se pudo conectar con el servidor. Comprueba que el backend esté en ejecución (docker-compose up).",
    );
  }
}
