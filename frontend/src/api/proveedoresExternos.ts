import { fetchWithAuth } from "./http.ts";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type EstadoVencimiento = "vigente" | "por_vencer" | "vencido" | "sin_vencimiento";

export type Proveedor = {
  id: number;
  nombre: string;
  rfc: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  personas_count: number;
  created_at: string;
  updated_at: string;
};

export type Persona = {
  id: number;
  proveedor_id: number;
  nombre: string;
  identificacion: string | null;
  puesto: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ProveedorDetalle = Proveedor & { personas: Persona[] };

export type CursoExterno = {
  id: number;
  nombre: string;
  descripcion: string | null;
  vigencia_meses: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type RegistroVencimiento = {
  id: number;
  persona_id: number;
  curso_externo_id: number;
  fecha_realizado: string;
  fecha_vencimiento: string | null;
  observaciones: string | null;
  estado: EstadoVencimiento;
  dias_restantes: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  persona_nombre: string | null;
  curso_nombre: string | null;
  created_at: string;
  updated_at: string;
};

export type ProveedorListResponse = {
  items: Proveedor[];
  total: number;
  page: number;
  page_size: number;
};

export type CursoExternoListResponse = {
  items: CursoExterno[];
  total: number;
  page: number;
  page_size: number;
};

export type VencimientoListResponse = {
  items: RegistroVencimiento[];
  total: number;
  page: number;
  page_size: number;
};

export type ProveedorExternoFetchError = {
  status: number;
  detail: string;
};

const BASE = "/api/v1/proveedores-externos";

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

function throwFetchError(res: Response, detail: string): never {
  throw { status: res.status, detail } as ProveedorExternoFetchError;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throwFetchError(res, await readErrorDetail(res));
  return (await res.json()) as T;
}

async function okOrThrow(res: Response): Promise<void> {
  if (!res.ok) throwFetchError(res, await readErrorDetail(res));
}

function postJson(path: string, body: unknown): Promise<Response> {
  return fetchWithAuth(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putJson(path: string, body: unknown): Promise<Response> {
  return fetchWithAuth(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Proveedores ───────────────────────────────────────────────────────────────
export async function getProveedores(opts?: {
  page?: number;
  page_size?: number;
  q?: string;
}): Promise<ProveedorListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 100));
  if (opts?.q?.trim()) qs.set("q", opts.q.trim());
  return jsonOrThrow(await fetchWithAuth(`${BASE}/proveedores?${qs.toString()}`));
}

export async function getProveedor(id: number): Promise<ProveedorDetalle> {
  return jsonOrThrow(await fetchWithAuth(`${BASE}/proveedores/${id}`));
}

export type ProveedorPayload = {
  nombre: string;
  rfc?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export async function createProveedor(payload: ProveedorPayload): Promise<ProveedorDetalle> {
  return jsonOrThrow(await postJson(`${BASE}/proveedores`, payload));
}

export async function updateProveedor(
  id: number,
  payload: Partial<ProveedorPayload> & { activo?: boolean },
): Promise<ProveedorDetalle> {
  return jsonOrThrow(await putJson(`${BASE}/proveedores/${id}`, payload));
}

export async function deleteProveedor(id: number): Promise<void> {
  await okOrThrow(await fetchWithAuth(`${BASE}/proveedores/${id}`, { method: "DELETE" }));
}

// ── Personas ──────────────────────────────────────────────────────────────────
export type PersonaPayload = {
  nombre: string;
  identificacion?: string | null;
  puesto?: string | null;
};

export async function getPersonasDeProveedor(proveedorId: number): Promise<Persona[]> {
  return jsonOrThrow(await fetchWithAuth(`${BASE}/proveedores/${proveedorId}/personas`));
}

export async function createPersona(
  proveedorId: number,
  payload: PersonaPayload,
): Promise<Persona> {
  return jsonOrThrow(await postJson(`${BASE}/proveedores/${proveedorId}/personas`, payload));
}

export async function updatePersona(
  personaId: number,
  payload: Partial<PersonaPayload> & { activo?: boolean },
): Promise<Persona> {
  return jsonOrThrow(await putJson(`${BASE}/personas/${personaId}`, payload));
}

export async function deletePersona(personaId: number): Promise<void> {
  await okOrThrow(await fetchWithAuth(`${BASE}/personas/${personaId}`, { method: "DELETE" }));
}

// ── Cursos externos ─────────────────────────────────────────────────────────
export async function getCursosExternos(opts?: {
  page?: number;
  page_size?: number;
  q?: string;
}): Promise<CursoExternoListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 100));
  if (opts?.q?.trim()) qs.set("q", opts.q.trim());
  return jsonOrThrow(await fetchWithAuth(`${BASE}/cursos-externos?${qs.toString()}`));
}

export type CursoExternoPayload = {
  nombre: string;
  descripcion?: string | null;
  vigencia_meses?: number | null;
};

export async function createCursoExterno(payload: CursoExternoPayload): Promise<CursoExterno> {
  return jsonOrThrow(await postJson(`${BASE}/cursos-externos`, payload));
}

export async function updateCursoExterno(
  id: number,
  payload: Partial<CursoExternoPayload> & { activo?: boolean },
): Promise<CursoExterno> {
  return jsonOrThrow(await putJson(`${BASE}/cursos-externos/${id}`, payload));
}

export async function deleteCursoExterno(id: number): Promise<void> {
  await okOrThrow(await fetchWithAuth(`${BASE}/cursos-externos/${id}`, { method: "DELETE" }));
}

// ── Registros / Vencimientos ──────────────────────────────────────────────────
export async function getVencimientos(opts?: {
  page?: number;
  page_size?: number;
  estado?: EstadoVencimiento | "";
  proveedor_id?: number | null;
  curso_externo_id?: number | null;
  incluir_historico?: boolean;
}): Promise<VencimientoListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("page_size", String(opts?.page_size ?? 100));
  if (opts?.estado) qs.set("estado", opts.estado);
  if (opts?.proveedor_id != null) qs.set("proveedor_id", String(opts.proveedor_id));
  if (opts?.curso_externo_id != null) qs.set("curso_externo_id", String(opts.curso_externo_id));
  if (opts?.incluir_historico) qs.set("incluir_historico", "true");
  return jsonOrThrow(await fetchWithAuth(`${BASE}/vencimientos?${qs.toString()}`));
}

export type RegistroPayload = {
  persona_id: number;
  curso_externo_id: number;
  fecha_realizado: string;
  observaciones?: string | null;
};

export async function createRegistro(payload: RegistroPayload): Promise<RegistroVencimiento> {
  return jsonOrThrow(await postJson(`${BASE}/registros`, payload));
}

export async function updateRegistro(
  id: number,
  payload: { fecha_realizado?: string; observaciones?: string | null },
): Promise<RegistroVencimiento> {
  return jsonOrThrow(await putJson(`${BASE}/registros/${id}`, payload));
}

export async function deleteRegistro(id: number): Promise<void> {
  await okOrThrow(await fetchWithAuth(`${BASE}/registros/${id}`, { method: "DELETE" }));
}
