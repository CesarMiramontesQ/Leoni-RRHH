import { fetchWithAuth } from "./http.ts";
import type {
  GradoPuesto,
  GradoPuestoCreatePayload,
  GradoPuestoFetchError,
  GradoPuestoUpdatePayload,
} from "../dashboard/gradosPuesto/types.ts";

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

function mapGrado(raw: Record<string, unknown>): GradoPuesto {
  return {
    id: raw.id as number,
    career_path_id: (raw.career_path_id ?? 0) as number,
    career_path_codigo: (raw.career_path_codigo ?? null) as string | null,
    career_path_nombre: (raw.career_path_nombre ?? null) as string | null,
    codigo: (raw.codigo ?? "") as string,
    nombre: (raw.nombre ?? "") as string,
    orden: (raw.orden ?? 0) as number,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/career-levels */
export async function getGradosPuesto(opts?: {
  page?: number;
  page_size?: number;
  busqueda?: string;
  career_path_id?: number;
}): Promise<GradoPuesto[]> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 200));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  if (opts?.career_path_id) qs.set("career_path_id", String(opts.career_path_id));
  const res = await fetchWithAuth(`/api/v1/career-levels?${qs}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GradoPuestoFetchError;
  }
  const data = await res.json();
  const items = (data.items ?? data) as Record<string, unknown>[];
  // Los niveles solo son comparables dentro de su career path: primero se agrupa
  // por path y dentro de cada uno se ordena por `orden`.
  return items
    .map(mapGrado)
    .sort(
      (a, b) =>
        (a.career_path_codigo ?? "").localeCompare(b.career_path_codigo ?? "") ||
        a.orden - b.orden,
    );
}

/** POST /api/v1/career-levels */
export async function createGradoPuesto(payload: GradoPuestoCreatePayload): Promise<GradoPuesto> {
  const res = await fetchWithAuth("/api/v1/career-levels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GradoPuestoFetchError;
  }
  return mapGrado(await res.json());
}

/** PATCH /api/v1/career-levels/:id */
export async function updateGradoPuesto(
  id: number,
  payload: GradoPuestoUpdatePayload,
): Promise<GradoPuesto> {
  const res = await fetchWithAuth(`/api/v1/career-levels/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GradoPuestoFetchError;
  }
  return mapGrado(await res.json());
}

/** DELETE /api/v1/career-levels/:id */
export async function deleteGradoPuesto(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/career-levels/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as GradoPuestoFetchError;
  }
}
