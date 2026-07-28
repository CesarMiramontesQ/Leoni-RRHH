import { fetchWithAuth } from "./http.ts";
import type {
  CategoriaTarea,
  CategoriaTareaCreatePayload,
  CategoriaTareaFetchError,
  CategoriaTareaUpdatePayload,
} from "../dashboard/categoriasTarea/types.ts";

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

function mapCategoria(raw: Record<string, unknown>): CategoriaTarea {
  return {
    id: raw.id as number,
    nombre: (raw.nombre ?? "") as string,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/categorias-tarea */
export async function getCategoriasTarea(opts?: {
  busqueda?: string;
}): Promise<CategoriaTarea[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "200" });
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  const res = await fetchWithAuth(`/api/v1/categorias-tarea?${qs}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as CategoriaTareaFetchError;
  }
  const data = await res.json();
  const items = (data.items ?? data) as Record<string, unknown>[];
  return items.map(mapCategoria);
}

/** POST /api/v1/categorias-tarea */
export async function createCategoriaTarea(
  payload: CategoriaTareaCreatePayload,
): Promise<CategoriaTarea> {
  const res = await fetchWithAuth("/api/v1/categorias-tarea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as CategoriaTareaFetchError;
  }
  return mapCategoria((await res.json()) as Record<string, unknown>);
}

/** PATCH /api/v1/categorias-tarea/:id */
export async function updateCategoriaTarea(
  id: number,
  payload: CategoriaTareaUpdatePayload,
): Promise<CategoriaTarea> {
  const res = await fetchWithAuth(`/api/v1/categorias-tarea/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as CategoriaTareaFetchError;
  }
  return mapCategoria((await res.json()) as Record<string, unknown>);
}

/** DELETE /api/v1/categorias-tarea/:id */
export async function deleteCategoriaTarea(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/categorias-tarea/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as CategoriaTareaFetchError;
  }
}
