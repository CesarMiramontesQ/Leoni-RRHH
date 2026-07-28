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
    global_grade_id: (raw.global_grade_id ?? null) as number | null,
    global_grade_codigo: (raw.global_grade_codigo ?? null) as string | null,
    global_grade_orden: (raw.global_grade_orden ?? null) as number | null,
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
  // Se agrupa por career path y dentro de cada uno se ordena por la posición que
  // da el global grade. Los que no tienen equivalencia van al final.
  return items.map(mapGrado).sort((a, b) => {
    const porPath = (a.career_path_codigo ?? "").localeCompare(
      b.career_path_codigo ?? "",
    );
    if (porPath !== 0) return porPath;
    const oa = a.global_grade_orden;
    const ob = b.global_grade_orden;
    if (oa == null && ob == null) return a.codigo.localeCompare(b.codigo);
    if (oa == null) return 1;
    if (ob == null) return -1;
    return oa - ob;
  });
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
