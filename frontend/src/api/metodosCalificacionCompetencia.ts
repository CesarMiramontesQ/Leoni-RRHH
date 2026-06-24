import { fetchWithAuth } from "./http.ts";
import type {
  MetodoCalificacionCompetencia,
  MetodoCalificacionCompetenciaCreatePayload,
  MetodoCalificacionCompetenciaFetchError,
  MetodoCalificacionCompetenciaUpdatePayload,
} from "../dashboard/metodosCalificacionCompetencia/types.ts";

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

function mapMetodo(raw: Record<string, unknown>): MetodoCalificacionCompetencia {
  return {
    id: raw.id as number,
    valor: (raw.valor ?? 0) as number,
    nombre: (raw.nombre ?? "") as string,
    orden: (raw.orden ?? 0) as number,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/metodos-calificacion-competencia */
export async function getMetodosCalificacionCompetencia(): Promise<MetodoCalificacionCompetencia[]> {
  const res = await fetchWithAuth("/api/v1/metodos-calificacion-competencia");
  if (!res.ok) {
    throw {
      status: res.status,
      detail: await readErrorDetail(res),
    } as MetodoCalificacionCompetenciaFetchError;
  }
  const data = await res.json();
  const rawItems = (data as { items?: unknown }).items ?? data;
  const items = Array.isArray(rawItems) ? rawItems : [];
  return (items as Record<string, unknown>[]).map(mapMetodo).sort((a, b) => a.orden - b.orden);
}

/** POST /api/v1/metodos-calificacion-competencia */
export async function createMetodoCalificacionCompetencia(
  payload: MetodoCalificacionCompetenciaCreatePayload,
): Promise<MetodoCalificacionCompetencia> {
  const res = await fetchWithAuth("/api/v1/metodos-calificacion-competencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw {
      status: res.status,
      detail: await readErrorDetail(res),
    } as MetodoCalificacionCompetenciaFetchError;
  }
  return mapMetodo(await res.json());
}

/** PATCH /api/v1/metodos-calificacion-competencia/:id */
export async function updateMetodoCalificacionCompetencia(
  id: number,
  payload: MetodoCalificacionCompetenciaUpdatePayload,
): Promise<MetodoCalificacionCompetencia> {
  const res = await fetchWithAuth(`/api/v1/metodos-calificacion-competencia/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw {
      status: res.status,
      detail: await readErrorDetail(res),
    } as MetodoCalificacionCompetenciaFetchError;
  }
  return mapMetodo(await res.json());
}

/** DELETE /api/v1/metodos-calificacion-competencia/:id */
export async function deleteMetodoCalificacionCompetencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/metodos-calificacion-competencia/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw {
      status: res.status,
      detail: await readErrorDetail(res),
    } as MetodoCalificacionCompetenciaFetchError;
  }
}
