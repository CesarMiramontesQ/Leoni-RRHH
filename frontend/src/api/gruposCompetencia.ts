import { fetchWithAuth } from "./http.ts";
import type {
  GrupoCompetencia,
  GrupoCompetenciaCreatePayload,
  GrupoCompetenciaFetchError,
  GrupoCompetenciaUpdatePayload,
} from "../dashboard/gruposCompetencia/types.ts";

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

function mapGrupo(raw: Record<string, unknown>): GrupoCompetencia {
  return {
    id: raw.id as number,
    nombre: (raw.nombre ?? "") as string,
    categoria: (raw.categoria ?? "blanda") as GrupoCompetencia["categoria"],
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/grupos-competencia */
export async function getGruposCompetencia(opts?: {
  page?: number;
  page_size?: number;
  busqueda?: string;
}): Promise<GrupoCompetencia[]> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 200));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  const res = await fetchWithAuth(`/api/v1/grupos-competencia?${qs}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GrupoCompetenciaFetchError;
  }
  const data = await res.json();
  const items = (data.items ?? data) as Record<string, unknown>[];
  return items.map(mapGrupo);
}

/** POST /api/v1/grupos-competencia */
export async function createGrupoCompetencia(
  payload: GrupoCompetenciaCreatePayload,
): Promise<GrupoCompetencia> {
  const res = await fetchWithAuth("/api/v1/grupos-competencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GrupoCompetenciaFetchError;
  }
  return mapGrupo((await res.json()) as Record<string, unknown>);
}

/** PATCH /api/v1/grupos-competencia/:id */
export async function updateGrupoCompetencia(
  id: number,
  payload: GrupoCompetenciaUpdatePayload,
): Promise<GrupoCompetencia> {
  const res = await fetchWithAuth(`/api/v1/grupos-competencia/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GrupoCompetenciaFetchError;
  }
  return mapGrupo((await res.json()) as Record<string, unknown>);
}

/** DELETE /api/v1/grupos-competencia/:id */
export async function deleteGrupoCompetencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/grupos-competencia/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GrupoCompetenciaFetchError;
  }
}
