import { fetchWithAuth } from "./http.ts";

export type TareaCatalogo = {
  id: number;
  nombre: string;
  categoria: string | undefined;
  es_complemento: boolean;
  activa: boolean;
  created_at: string;
};

export type TareaCatalogoCreatePayload = {
  nombre: string;
  categoria?: string;
  es_complemento?: boolean;
};

export type TareaCatalogoFetchError = {
  status: number;
  detail: string;
};

export const MSG_TAREA_DUPLICADA =
  "La tarea que intentas crear ya existe. Verifica el nombre e intenta nuevamente.";

export function isTareaCatalogoDuplicada(err: unknown): boolean {
  const fe = err as TareaCatalogoFetchError;
  return fe?.status === 409;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const d = (parsed as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
  } catch {
    /* noop */
  }
  return raw.trim() || res.statusText || "Error";
}

/** GET /api/v1/tareas-catalogo */
export async function getTareasCatalogo(opts?: {
  page_size?: number;
  busqueda?: string;
}): Promise<TareaCatalogo[]> {
  const qs = new URLSearchParams();
  if (opts?.page_size) qs.set("page_size", String(opts.page_size));
  if (opts?.busqueda) qs.set("busqueda", opts.busqueda);
  const url = `/api/v1/tareas-catalogo${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as TareaCatalogoFetchError;
  }
  const data = await res.json();
  const items = data.items ?? data;
  return (items as Record<string, unknown>[]).map((t) => ({
    id: t.id as number,
    nombre: (t.nombre ?? "") as string,
    categoria: (t.categoria ?? undefined) as string | undefined,
    es_complemento: (t.es_complemento ?? false) as boolean,
    activa: (t.activo ?? true) as boolean,
    created_at: (t.created_at ?? "") as string,
  }));
}

/** POST /api/v1/tareas-catalogo */
export async function createTareaCatalogo(
  payload: TareaCatalogoCreatePayload,
): Promise<TareaCatalogo> {
  const body: Record<string, unknown> = {
    nombre: payload.nombre,
  };
  if (payload.categoria) body.categoria = payload.categoria;
  if (payload.es_complemento !== undefined) body.es_complemento = payload.es_complemento;
  const res = await fetchWithAuth("/api/v1/tareas-catalogo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as TareaCatalogoFetchError;
  }
  const t = await res.json();
  return {
    id: t.id,
    nombre: t.nombre ?? "",
    categoria: t.categoria ?? undefined,
    es_complemento: t.es_complemento ?? false,
    activa: t.activo ?? true,
    created_at: t.created_at ?? "",
  };
}
