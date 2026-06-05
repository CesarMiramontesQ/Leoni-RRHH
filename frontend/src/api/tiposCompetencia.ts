import { fetchWithAuth } from "./http.ts";
import type {
  TipoCompetencia,
  TipoCompetenciaCreatePayload,
  TipoCompetenciaFetchError,
  TipoCompetenciaUpdatePayload,
} from "../dashboard/tiposCompetencia/types.ts";

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

function mapTipo(raw: Record<string, unknown>): TipoCompetencia {
  return {
    id: raw.id as number,
    nombre: (raw.nombre ?? "") as string,
    grupo_competencia_id: raw.grupo_competencia_id as number,
    grupo_nombre: (raw.grupo_nombre ?? "") as string,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/tipos-competencia */
export async function getTiposCompetencia(opts?: {
  page?: number;
  page_size?: number;
  busqueda?: string;
}): Promise<TipoCompetencia[]> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 200));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  const res = await fetchWithAuth(`/api/v1/tipos-competencia?${qs}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as TipoCompetenciaFetchError;
  }
  const data = await res.json();
  const items = (data.items ?? data) as Record<string, unknown>[];
  return items.map(mapTipo);
}

/** POST /api/v1/tipos-competencia */
export async function createTipoCompetencia(
  payload: TipoCompetenciaCreatePayload,
): Promise<TipoCompetencia> {
  const res = await fetchWithAuth("/api/v1/tipos-competencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as TipoCompetenciaFetchError;
  }
  return mapTipo((await res.json()) as Record<string, unknown>);
}

/** PATCH /api/v1/tipos-competencia/:id */
export async function updateTipoCompetencia(
  id: number,
  payload: TipoCompetenciaUpdatePayload,
): Promise<TipoCompetencia> {
  const res = await fetchWithAuth(`/api/v1/tipos-competencia/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as TipoCompetenciaFetchError;
  }
  return mapTipo((await res.json()) as Record<string, unknown>);
}

/** DELETE /api/v1/tipos-competencia/:id */
export async function deleteTipoCompetencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/tipos-competencia/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as TipoCompetenciaFetchError;
  }
}
