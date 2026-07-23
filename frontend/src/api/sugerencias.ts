import { fetchWithAuth } from "./http.ts";

// ── Tipos (espejo de app/schemas/level_up.py) ───────────────────────────────

export type SugerenciaEstado = "activa" | "aprobada" | "pospuesta" | "descartada";

export interface SugerenciaResponse {
  id: number;
  titulo: string;
  justificacion: string | null;
  brecha_pct: number | null;
  adopcion_sector_pct: number | null;
  capacidades_afectadas: string[] | null;
  areas_afectadas: string[] | null;
  personas_alcanzables: number | null;
  duracion_sugerida: string | null;
  inversion_estimada: number | null;
  proveedor_sugerido: string | null;
  curso_id: number | null;
  curso_nombre: string | null;
  prioridad: number;
  estado: SugerenciaEstado;
  created_at: string;
  updated_at: string;
}

export interface SugerenciaCreatePayload {
  titulo: string;
  justificacion?: string | null;
  brecha_pct?: number | null;
  adopcion_sector_pct?: number | null;
  capacidades_afectadas?: string[] | null;
  areas_afectadas?: string[] | null;
  personas_alcanzables?: number | null;
  duracion_sugerida?: string | null;
  inversion_estimada?: number | null;
  proveedor_sugerido?: string | null;
  curso_id?: number | null;
  prioridad?: number;
}

export interface SugerenciaUpdatePayload {
  titulo?: string;
  justificacion?: string | null;
  curso_id?: number | null;
  prioridad?: number;
  estado?: SugerenciaEstado;
  brecha_pct?: number | null;
  adopcion_sector_pct?: number | null;
  capacidades_afectadas?: string[] | null;
  areas_afectadas?: string[] | null;
  personas_alcanzables?: number | null;
  duracion_sugerida?: string | null;
  inversion_estimada?: number | null;
  proveedor_sugerido?: string | null;
}

// ── Helper de error (mismo patron que el resto de api clients) ───────────────

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

const BASE = "/api/v1/level-up/sugerencias";

// ── Funciones ────────────────────────────────────────────────────────────────

export async function listarSugerencias(params?: {
  estado?: string;
  prioridad?: number;
}): Promise<SugerenciaResponse[]> {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.prioridad != null) qs.set("prioridad", String(params.prioridad));
  const query = qs.toString();
  const res = await fetchWithAuth(`${BASE}${query ? `?${query}` : ""}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function crearSugerencia(
  payload: SugerenciaCreatePayload,
): Promise<SugerenciaResponse> {
  const res = await fetchWithAuth(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function actualizarSugerencia(
  id: number,
  payload: SugerenciaUpdatePayload,
): Promise<SugerenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function eliminarSugerencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

export async function generarSugerenciasDesdeBrechas(params: {
  area_id: number;
  umbral_brecha: number;
}): Promise<SugerenciaResponse[]> {
  const res = await fetchWithAuth(`${BASE}/generar-desde-brechas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}
