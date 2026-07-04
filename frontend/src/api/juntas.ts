import { fetchWithAuth } from "./http.ts";

export type JuntaEstado = "registrada" | "cancelada" | "cerrada";

export type JuntaAsistente = {
  empleado_id: number;
  no_empleado: number | null;
  nombre: string | null;
  puesto: string | null;
  area: string | null;
};

export type Junta = {
  id: number;
  nombre: string;
  motivo: string | null;
  categoria: string | null;
  estado: JuntaEstado;
  asistentes_count: number;
  created_at: string;
  updated_at: string;
};

export type JuntaDetalle = Junta & {
  asistentes: JuntaAsistente[];
};

export type JuntaListResponse = {
  items: Junta[];
  total: number;
  page: number;
  page_size: number;
};

export type JuntaCreatePayload = {
  nombre: string;
  motivo?: string | null;
  categoria?: string | null;
  asistente_ids: number[];
};

export type JuntaFetchError = {
  status: number;
  detail: string;
};

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

function throwFetchError(res: Response, detail: string): never {
  throw { status: res.status, detail } as JuntaFetchError;
}

/** GET /api/v1/juntas */
export async function getJuntas(opts?: {
  page?: number;
  page_size?: number;
  q?: string;
  categoria?: string;
}): Promise<JuntaListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 50));
  if (opts?.q?.trim()) qs.set("q", opts.q.trim());
  if (opts?.categoria?.trim()) qs.set("categoria", opts.categoria.trim());
  const res = await fetchWithAuth(`/api/v1/juntas?${qs.toString()}`);
  if (!res.ok) throwFetchError(res, await readErrorDetail(res));
  return (await res.json()) as JuntaListResponse;
}

/** GET /api/v1/juntas/{id} */
export async function getJunta(id: number): Promise<JuntaDetalle> {
  const res = await fetchWithAuth(`/api/v1/juntas/${id}`);
  if (!res.ok) throwFetchError(res, await readErrorDetail(res));
  return (await res.json()) as JuntaDetalle;
}

/** POST /api/v1/juntas */
export async function createJunta(payload: JuntaCreatePayload): Promise<JuntaDetalle> {
  const res = await fetchWithAuth("/api/v1/juntas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: payload.nombre,
      motivo: payload.motivo ?? null,
      categoria: payload.categoria ?? null,
      asistente_ids: payload.asistente_ids,
    }),
  });
  if (!res.ok) throwFetchError(res, await readErrorDetail(res));
  return (await res.json()) as JuntaDetalle;
}
