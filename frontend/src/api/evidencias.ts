import { fetchWithAuth } from "./http.ts";

// ── Tipos (espejo de app/schemas/level_up.py — Evidencia*) ───────────────────

export type EvidenciaTipo = "foto" | "documento" | "video" | "firma";
export type EvidenciaEstado = "pendiente" | "validada" | "devuelta";
export type FirmaEstado = "pendiente" | "firmada" | "rechazada";

/** Espejo de `EvidenciaFirmaItem`. */
export interface FirmaItem {
  id: number;
  firmante_id: number;
  firmante_nombre: string | null;
  rol_firma: string;
  estado: FirmaEstado;
  fecha_firma: string | null;
  comentario: string | null;
}

/** Espejo de `EvidenciaConFirmasResponse`. */
export interface EvidenciaResponse {
  id: number;
  tipo: EvidenciaTipo;
  archivo_url: string;
  capacitacion_id: number | null;
  capacitacion_nombre: string | null;
  empleado_id: number;
  empleado_nombre: string | null;
  estado: EvidenciaEstado;
  fecha_subida: string;
  notas: string | null;
  firmas: FirmaItem[];
  firmas_total: number;
  firmas_firmadas: number;
}

/** Espejo de `FirmanteAsignar`. */
export interface FirmanteAsignarPayload {
  firmante_id: number;
  rol_firma: string;
}

/** Espejo de `EvidenciaCrearRequest`. */
export interface EvidenciaCrearPayload {
  tipo: EvidenciaTipo;
  archivo_url: string;
  capacitacion_id?: number | null;
  empleado_id: number;
  notas?: string | null;
  firmantes?: FirmanteAsignarPayload[];
}

/**
 * Espejo de `EvidenciaCapacitacionUpdate`. El estado es DERIVADO de las firmas
 * (el service lo descarta), por eso RH solo edita `archivo_url` y `notas`.
 */
export interface EvidenciaUpdatePayload {
  archivo_url?: string;
  notas?: string | null;
}

// ── Helper de error (mismo patrón que el resto de api clients) ───────────────

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

const BASE = "/api/v1/level-up/evidencias";

// ── Funciones ────────────────────────────────────────────────────────────────

export async function listarEvidencias(params?: {
  empleado_id?: number | null;
  capacitacion_id?: number | null;
  estado?: string | null;
}): Promise<EvidenciaResponse[]> {
  const qs = new URLSearchParams();
  if (params?.empleado_id != null) qs.set("empleado_id", String(params.empleado_id));
  if (params?.capacitacion_id != null) qs.set("capacitacion_id", String(params.capacitacion_id));
  if (params?.estado) qs.set("estado", params.estado);
  const query = qs.toString();
  const res = await fetchWithAuth(`${BASE}${query ? `?${query}` : ""}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function crearEvidencia(payload: EvidenciaCrearPayload): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function obtenerEvidencia(id: number): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function actualizarEvidencia(
  id: number,
  payload: EvidenciaUpdatePayload,
): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function eliminarEvidencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

export async function agregarFirmante(
  id: number,
  payload: FirmanteAsignarPayload,
): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}/firmantes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function quitarFirmante(firmaId: number): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/firmantes/${firmaId}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

// ── Self-service (firmante en sesión) ────────────────────────────────────────

/** Espejo de `FirmarRequest`. El id se toma del token; solo firma/rechaza. */
export interface FirmarPayload {
  estado: Extract<FirmaEstado, "firmada" | "rechazada">;
  comentario?: string | null;
}

/** Evidencias que el usuario en sesión debe firmar (su fila `firmas[]` está pendiente). */
export async function getMisFirmas(): Promise<EvidenciaResponse[]> {
  const res = await fetchWithAuth(`${BASE}/mis-firmas`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

/** Firma o rechaza la fila de firma propia (`firmaId`); devuelve la evidencia actualizada. */
export async function firmar(firmaId: number, payload: FirmarPayload): Promise<EvidenciaResponse> {
  const res = await fetchWithAuth(`${BASE}/firmas/${firmaId}/firmar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}
