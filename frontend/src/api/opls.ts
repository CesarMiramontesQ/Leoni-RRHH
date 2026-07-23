import { fetchWithAuth } from "./http.ts";

// ── Tipos (espejo de app/schemas/level_up.py — OPL*) ─────────────────────────

export type OPLEstado = "borrador" | "revision" | "aprobada";

export interface OPLVersionItem {
  id: number;
  version_num: number;
  archivo_url: string;
  cambios_descripcion: string | null;
  fecha: string;
  creado_por_id: number | null;
  creado_por_nombre: string | null;
}

/** Espejo de `OPLConVersionesResponse` (respuesta de listar/obtener/mutar). */
export interface OPLResponse {
  id: number;
  codigo: string;
  titulo: string;
  proceso: string | null;
  maquina: string | null;
  aprobador_id: number | null;
  aprobador_nombre: string | null;
  estado_aprobacion: string;
  created_at: string;
  versiones: OPLVersionItem[];
  version_actual: OPLVersionItem | null;
  total_versiones: number;
}

export interface OPLCreatePayload {
  codigo: string;
  titulo: string;
  proceso?: string | null;
  maquina?: string | null;
  aprobador_id?: number | null;
}

export interface OPLUpdatePayload {
  titulo?: string;
  proceso?: string | null;
  maquina?: string | null;
  aprobador_id?: number | null;
  estado_aprobacion?: OPLEstado;
}

export interface OPLVersionAgregarPayload {
  archivo_url: string;
  cambios_descripcion?: string | null;
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

const BASE = "/api/v1/level-up/opls";

// ── Funciones ────────────────────────────────────────────────────────────────

export async function listarOpls(params?: {
  codigo?: string;
  estado?: string;
  proceso?: string;
  maquina?: string;
}): Promise<OPLResponse[]> {
  const qs = new URLSearchParams();
  if (params?.codigo?.trim()) qs.set("codigo", params.codigo.trim());
  if (params?.estado?.trim()) qs.set("estado", params.estado.trim());
  if (params?.proceso?.trim()) qs.set("proceso", params.proceso.trim());
  if (params?.maquina?.trim()) qs.set("maquina", params.maquina.trim());
  const query = qs.toString();
  const res = await fetchWithAuth(`${BASE}${query ? `?${query}` : ""}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function crearOpl(payload: OPLCreatePayload): Promise<OPLResponse> {
  const res = await fetchWithAuth(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function obtenerOpl(id: number): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function actualizarOpl(id: number, payload: OPLUpdatePayload): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function eliminarOpl(id: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

export async function agregarVersion(
  id: number,
  payload: OPLVersionAgregarPayload,
): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}/versiones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function enviarARevision(id: number): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/${id}/enviar-a-revision`, {
    method: "POST",
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

// ── Self-service: mis aprobaciones ───────────────────────────────────────────

/** OPLs en revisión que el usuario autenticado debe aprobar. */
export async function getMisAprobaciones(): Promise<OPLResponse[]> {
  const res = await fetchWithAuth(`${BASE}/mis-aprobaciones`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

/** Aprueba la OPL (revisión → aprobada). El aprobador se toma del token. */
export async function aprobarOpl(id: number): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/aprobaciones/${id}/aprobar`, {
    method: "POST",
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

/** Regresa la OPL a borrador (revisión → borrador). */
export async function regresarOpl(id: number): Promise<OPLResponse> {
  const res = await fetchWithAuth(`${BASE}/aprobaciones/${id}/regresar`, {
    method: "POST",
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}
