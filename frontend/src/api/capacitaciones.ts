import { fetchWithAuth } from "./http.ts";
import type {
  Capacitacion,
  CapacitacionListResponse,
  CapacitacionCreatePayload,
  CapacitacionUpdatePayload,
  Inscripcion,
  InscripcionListResponse,
} from "../dashboard/capacitaciones/types.ts";

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

// ── Capacitaciones CRUD ─────────────────────────────────────────────────────

export async function getCapacitaciones(params?: {
  page?: number;
  page_size?: number;
  area_id?: number;
  modalidad?: string;
  estado?: string;
  busqueda?: string;
}): Promise<CapacitacionListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.modalidad) qs.set("modalidad", params.modalidad);
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.busqueda) qs.set("busqueda", params.busqueda);

  const res = await fetchWithAuth(`/api/v1/capacitaciones?${qs.toString()}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getCapacitacionById(id: number): Promise<Capacitacion> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/${id}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function createCapacitacion(data: CapacitacionCreatePayload): Promise<Capacitacion> {
  const res = await fetchWithAuth("/api/v1/capacitaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function updateCapacitacion(id: number, data: CapacitacionUpdatePayload): Promise<Capacitacion> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function deleteCapacitacion(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

// ── Inscripciones ───────────────────────────────────────────────────────────

export async function inscribirse(capacitacionId: number, empleadoId: number): Promise<Inscripcion> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/${capacitacionId}/inscripciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capacitacion_id: capacitacionId, empleado_id: empleadoId }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getInscripciones(capacitacionId: number, params?: {
  page?: number;
  page_size?: number;
}): Promise<InscripcionListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const res = await fetchWithAuth(`/api/v1/capacitaciones/${capacitacionId}/inscripciones?${qs.toString()}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getMisInscripciones(params?: {
  page?: number;
  page_size?: number;
}): Promise<InscripcionListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const res = await fetchWithAuth(`/api/v1/capacitaciones/mis-inscripciones?${qs.toString()}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function updateInscripcion(inscripcionId: number, data: {
  estado?: string;
  calificacion?: number;
}): Promise<Inscripcion> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/inscripciones/${inscripcionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function cancelarInscripcion(inscripcionId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/capacitaciones/inscripciones/${inscripcionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}
