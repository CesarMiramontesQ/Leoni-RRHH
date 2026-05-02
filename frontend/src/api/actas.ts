import { fetchWithAuth } from "./http.ts";

export type ActaCreatePayload = {
  empleado_id: number;
  numero_empleado: string;
  area_departamento: string;
  supervisor_directo: string;
  tipo_falta: string;
  fundamento_legal: "Ley Federal del Trabajo" | "Reglamento Interior de Trabajo";
  articulo_inciso?: string | null;
  fecha_evento: string;
  lugar_incidente: string;
  descripcion_hechos: string;
  personas_involucradas?: string | null;
  testigos?: string | null;
  responsable_rh: string;
  evidencia?: string | null;
};

export type ActaCreateResponse = {
  id: number;
  empleado_id: number;
  area_departamento: string | null;
  supervisor_directo: string | null;
  tipo_falta: string | null;
  fecha_evento: string | null;
};

export type ActaListItem = {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  numero_empleado: string | null;
  area_departamento: string | null;
  supervisor_directo: string | null;
  tipo_falta: string | null;
  fecha_evento: string | null;
  estado: "draft" | "pending_sign" | "signed" | "archived";
  created_at: string;
};

export type ActaDetailResponse = {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  numero_empleado: string | null;
  area_departamento: string | null;
  supervisor_directo: string | null;
  tipo_falta: string | null;
  fundamento_legal: "Ley Federal del Trabajo" | "Reglamento Interior de Trabajo" | null;
  articulo_inciso: string | null;
  fecha_evento: string | null;
  lugar_incidente: string | null;
  descripcion_hechos: string | null;
  personas_involucradas: string | null;
  testigos: string | null;
  responsable_rh: string | null;
  evidencia: string | null;
  estado: "draft" | "pending_sign" | "signed" | "archived";
  created_at: string;
};

export type ActaPageResponse = {
  items: ActaListItem[];
  next_cursor: number | null;
  total: number;
};

export type ActaImproveWithIaResponse = {
  texto_mejorado: string;
};

export type ActasFetchError = {
  status: number;
  detail: string;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

function throwIfNotOk(res: Response, detail: string): never {
  const err: ActasFetchError = { status: res.status, detail };
  throw err;
}

export async function createActaAdministrativa(payload: ActaCreatePayload): Promise<ActaCreateResponse> {
  const res = await fetchWithAuth("/api/v1/actas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as ActaCreateResponse;
}

export async function getActasPage(params: {
  cursor?: number | null;
  limit?: number;
} = {}): Promise<ActaPageResponse> {
  const sp = new URLSearchParams();
  if (params.cursor != null) sp.set("cursor", String(params.cursor));
  sp.set("limit", String(params.limit ?? 100));
  const res = await fetchWithAuth(`/api/v1/actas?${sp.toString()}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as ActaPageResponse;
}

export async function getActaById(
  id: number,
  signal?: AbortSignal,
): Promise<ActaDetailResponse> {
  const res = await fetchWithAuth(`/api/v1/actas/${id}`, { signal });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as ActaDetailResponse;
}

export async function improveActaWithIa(
  id: number,
  signal?: AbortSignal,
): Promise<ActaImproveWithIaResponse> {
  const res = await fetchWithAuth(`/api/v1/actas/${id}/mejorar-ia`, {
    method: "POST",
    signal,
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as ActaImproveWithIaResponse;
}
