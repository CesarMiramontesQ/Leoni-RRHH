import { fetchWithAuth } from "./http.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CursoCatSimple {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface CursoCatSimpleListResponse {
  items: CursoCatSimple[];
  total: number;
  page: number;
  page_size: number;
}

export interface InstructorExterno {
  id: number;
  nombre: string;
  especialidad: string | null;
  empresa: string | null;
  contacto: string | null;
  activo: boolean;
  created_at: string;
}

export interface InstructorExternoListResponse {
  items: InstructorExterno[];
  total: number;
  page: number;
  page_size: number;
}

export interface InstructorInterno {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  especialidad: string | null;
  activo: boolean;
  created_at: string;
}

export interface InstructorInternoListResponse {
  items: InstructorInterno[];
  total: number;
  page: number;
  page_size: number;
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  created_at: string;
}

export interface ProveedorListResponse {
  items: Proveedor[];
  total: number;
  page: number;
  page_size: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

type ListParams = { page?: number; page_size?: number; busqueda?: string; solo_activos?: boolean };

function buildQs(params?: ListParams): string {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.busqueda) qs.set("busqueda", params.busqueda);
  if (params?.solo_activos !== undefined) qs.set("solo_activos", String(params.solo_activos));
  return qs.toString();
}

// ── Categorías ────────────────────────────────────────────────────────────────

export async function getCategorias(params?: ListParams): Promise<CursoCatSimpleListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/categorias?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createCategoria(payload: { nombre: string; descripcion?: string }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/categorias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateCategoria(id: number, payload: { nombre?: string; descripcion?: string; activo?: boolean }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/categorias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteCategoria(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/categorias/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export async function getTipos(params?: ListParams): Promise<CursoCatSimpleListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/tipos?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createTipo(payload: { nombre: string; descripcion?: string }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/tipos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateTipo(id: number, payload: { nombre?: string; descripcion?: string; activo?: boolean }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/tipos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteTipo(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/tipos/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

// ── Clasificaciones ───────────────────────────────────────────────────────────

export async function getClasificaciones(params?: ListParams): Promise<CursoCatSimpleListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/clasificaciones?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createClasificacion(payload: { nombre: string; descripcion?: string }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/clasificaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateClasificacion(id: number, payload: { nombre?: string; descripcion?: string; activo?: boolean }): Promise<CursoCatSimple> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/clasificaciones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteClasificacion(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/clasificaciones/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

// ── Instructores Externos ─────────────────────────────────────────────────────

export async function getInstructoresExternos(params?: ListParams): Promise<InstructorExternoListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-externos?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createInstructorExterno(payload: { nombre: string; especialidad?: string; empresa?: string; contacto?: string }): Promise<InstructorExterno> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/instructores-externos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateInstructorExterno(id: number, payload: { nombre?: string; especialidad?: string; empresa?: string; contacto?: string; activo?: boolean }): Promise<InstructorExterno> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-externos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteInstructorExterno(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-externos/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

// ── Instructores Internos ─────────────────────────────────────────────────────

export async function getInstructoresInternos(params?: ListParams): Promise<InstructorInternoListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-internos?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createInstructorInterno(payload: { empleado_id: number; especialidad?: string }): Promise<InstructorInterno> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/instructores-internos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateInstructorInterno(id: number, payload: { especialidad?: string; activo?: boolean }): Promise<InstructorInterno> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-internos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteInstructorInterno(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/instructores-internos/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export async function getProveedores(params?: ListParams): Promise<ProveedorListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/proveedores?${buildQs(params)}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function createProveedor(payload: { nombre: string; contacto?: string; telefono?: string; email?: string; direccion?: string }): Promise<Proveedor> {
  const res = await fetchWithAuth("/api/v1/level-up/catalogos/proveedores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function updateProveedor(id: number, payload: { nombre?: string; contacto?: string; telefono?: string; email?: string; direccion?: string; activo?: boolean }): Promise<Proveedor> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/proveedores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return res.json();
}

export async function deleteProveedor(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/catalogos/proveedores/${id}`, { method: "DELETE" });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
}
