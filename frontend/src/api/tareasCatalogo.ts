import { fetchWithAuth } from "./http.ts";

export type TareaCatalogo = {
  id: number;
  nombre: string;
  descripcion: string | undefined;
  categoria: string | undefined;
  es_complemento: boolean;
  activa: boolean;
  created_at: string;
};

export type TareaCatalogoCreatePayload = {
  nombre: string;
  descripcion?: string;
  categoria?: string;
  es_complemento?: boolean;
};

export type TareaCatalogoUpdatePayload = {
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
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

function mapTareaCatalogo(t: Record<string, unknown>): TareaCatalogo {
  return {
    id: t.id as number,
    nombre: (t.nombre ?? "") as string,
    descripcion: (t.descripcion ?? undefined) as string | undefined,
    categoria: (t.categoria ?? undefined) as string | undefined,
    es_complemento: (t.es_complemento ?? false) as boolean,
    activa: (t.activo ?? true) as boolean,
    created_at: (t.created_at ?? "") as string,
  };
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
  page?: number;
  page_size?: number;
  busqueda?: string;
  categoria?: string;
  signal?: AbortSignal;
}): Promise<TareaCatalogo[]> {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set("page", String(opts.page));
  if (opts?.page_size) qs.set("page_size", String(opts.page_size));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  if (opts?.categoria?.trim()) qs.set("categoria", opts.categoria.trim());
  const url = `/api/v1/tareas-catalogo${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url, { signal: opts?.signal });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as TareaCatalogoFetchError;
  }
  const data = await res.json();
  const items = data.items ?? data;
  return (items as Record<string, unknown>[]).map(mapTareaCatalogo);
}

/** Extrae categorías distintas de ítems del catálogo (para filtros/datalist). */
export function extractCategoriasFromCatalogo(items: TareaCatalogo[]): string[] {
  const seen = new Map<string, string>();
  for (const t of items) {
    const label = t.categoria?.trim();
    if (label) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** POST /api/v1/tareas-catalogo */
export async function createTareaCatalogo(
  payload: TareaCatalogoCreatePayload,
): Promise<TareaCatalogo> {
  const body: Record<string, unknown> = {
    nombre: payload.nombre,
  };
  if (payload.descripcion?.trim()) body.descripcion = payload.descripcion.trim();
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
  return mapTareaCatalogo(await res.json());
}

/** PATCH /api/v1/tareas-catalogo/:id */
export async function updateTareaCatalogo(
  id: number,
  payload: TareaCatalogoUpdatePayload,
): Promise<TareaCatalogo> {
  const res = await fetchWithAuth(`/api/v1/tareas-catalogo/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as TareaCatalogoFetchError;
  }
  return mapTareaCatalogo(await res.json());
}
