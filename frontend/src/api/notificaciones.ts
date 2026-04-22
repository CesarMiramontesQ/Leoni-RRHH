import { fetchWithAuth } from "./http.ts";

export type NotificacionApiItem = {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  target_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type NotificacionesPage = {
  items: NotificacionApiItem[];
  next_cursor: number | null;
  total: number;
};

export type NotificacionesFetchError = {
  status: number;
  detail: string;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const json = JSON.parse(raw) as { detail?: unknown };
    if (typeof json.detail === "string" && json.detail.trim()) return json.detail.trim();
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

function throwIfNotOk(res: Response, detail: string): never {
  throw { status: res.status, detail } as NotificacionesFetchError;
}

export async function getNotificacionesRecientes(): Promise<NotificacionApiItem[]> {
  const res = await fetchWithAuth("/api/v1/notificaciones/recientes");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as NotificacionApiItem[];
}

export async function getNotificacionesPage(
  cursor: number | null,
  limit: number,
): Promise<NotificacionesPage> {
  const sp = new URLSearchParams();
  sp.set("limit", String(limit));
  if (cursor != null) sp.set("cursor", String(cursor));
  const res = await fetchWithAuth(`/api/v1/notificaciones?${sp.toString()}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as NotificacionesPage;
}

export async function getNoLeidasCount(): Promise<number> {
  const res = await fetchWithAuth("/api/v1/notificaciones/no-leidas/count");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = (await res.json()) as { no_leidas?: unknown };
  return typeof data.no_leidas === "number" ? data.no_leidas : 0;
}

export async function marcarNotificacionLeida(id: number): Promise<NotificacionApiItem> {
  const res = await fetchWithAuth(`/api/v1/notificaciones/${id}/leer`, { method: "PUT" });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as NotificacionApiItem;
}

export async function marcarTodasLeidas(): Promise<number> {
  const res = await fetchWithAuth("/api/v1/notificaciones/leer-todas", { method: "PUT" });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = (await res.json()) as { marcadas?: unknown };
  return typeof data.marcadas === "number" ? data.marcadas : 0;
}
