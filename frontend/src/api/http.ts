import { getAccessToken, getRefreshToken, updateAccessToken } from "../auth/session.ts";

async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) return false;

  const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!data?.access_token) return false;

  updateAccessToken(data.access_token);
  return true;
}

/**
 * fetch con Bearer; ante 401 intenta un refresh y reintenta una vez.
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (): Promise<Response> => {
    const token = getAccessToken();
    const headers = new Headers(init.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status !== 401) {
    return res;
  }

  const refreshed = await tryRefreshAccessToken();
  if (!refreshed) {
    return res;
  }

  return doFetch();
}
