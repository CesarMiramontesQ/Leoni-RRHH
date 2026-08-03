import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/vistas-rol";

export type VistaRolCatalogItem = {
  key: string;
  label: string;
  descripcion: string;
  grupo: string;
  ruta: string;
  activa: boolean;
  nav_item_ids: string[];
  roles: string[];
};

export type VistaRolMeResponse = {
  rol: string;
  configurable: boolean;
  vistas: Record<string, boolean>;
};

export type VistaRolConfigResponse = {
  roles: string[];
  config: Record<string, Record<string, boolean>>;
};

export type VistaRolCambio = {
  rol: string;
  vista_key: string;
  habilitado: boolean;
};

async function detalleDeError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { detail?: string } | null;
  return err?.detail ?? `HTTP ${res.status}`;
}

/** `null` en 401: se llama durante el arranque, antes de saber si hay sesión válida. */
export async function fetchVistasRolMe(): Promise<VistaRolMeResponse | null> {
  const res = await fetchWithAuth(`${BASE}/me`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`vistas-rol/me: ${res.status}`);
  return (await res.json()) as VistaRolMeResponse;
}

export async function fetchVistasRolCatalogo(): Promise<VistaRolCatalogItem[]> {
  const res = await fetchWithAuth(`${BASE}/catalogo`);
  if (!res.ok) {
    throw new Error(`No se pudo cargar el catálogo de vistas (${await detalleDeError(res)}).`);
  }
  return (await res.json()) as VistaRolCatalogItem[];
}

export async function fetchVistasRolConfig(): Promise<VistaRolConfigResponse> {
  const res = await fetchWithAuth(`${BASE}/config`);
  if (!res.ok) {
    throw new Error(`No se pudo cargar la configuración (${await detalleDeError(res)}).`);
  }
  return (await res.json()) as VistaRolConfigResponse;
}

export async function updateVistasRolConfig(
  cambios: VistaRolCambio[],
): Promise<VistaRolConfigResponse> {
  const res = await fetchWithAuth(`${BASE}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cambios }),
  });
  if (!res.ok) throw new Error(await detalleDeError(res));
  return (await res.json()) as VistaRolConfigResponse;
}

export async function restaurarVistasRolConfig(): Promise<VistaRolConfigResponse> {
  const res = await fetchWithAuth(`${BASE}/config/restaurar`, { method: "POST" });
  if (!res.ok) throw new Error(await detalleDeError(res));
  return (await res.json()) as VistaRolConfigResponse;
}
