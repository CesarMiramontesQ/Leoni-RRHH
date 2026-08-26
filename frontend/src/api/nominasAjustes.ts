import { fetchWithAuth } from "./http.ts";

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export type HorasExtraAutorizadosFiltro = "todos" | "autorizados" | "no_autorizados";

export type HorasExtraAutorizadoItem = {
  id: number;
  no_empleado: string;
  nombre: string;
  rol: string;
  email: string | null;
  area_descripcion: string | null;
  puesto_descripcion: string | null;
  autorizado: boolean;
  fecha_autorizacion: string | null;
  autorizado_por: string | null;
};

export type HorasExtraAutorizadosStats = {
  total_autorizados: number;
  autorizaciones_activas: number;
  sin_autorizacion: number;
  autorizaciones_recientes: number;
  solicitudes_pendientes: number;
};

export type HorasExtraAutorizadosListResponse = {
  items: HorasExtraAutorizadoItem[];
  total: number;
  page: number;
  page_size: number;
  stats: HorasExtraAutorizadosStats;
};

export type HorasExtraAutorizacionUpdateResponse = {
  actualizados: number;
  stats: HorasExtraAutorizadosStats;
};

export type NominasAjustesFetchError = {
  status: number;
  detail: string;
};

async function throwFetchError(res: Response): Promise<never> {
  const err: NominasAjustesFetchError = {
    status: res.status,
    detail: await readErrorDetail(res),
  };
  throw err;
}

export async function getHorasExtraAutorizados(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  filtro?: HorasExtraAutorizadosFiltro;
}): Promise<HorasExtraAutorizadosListResponse> {
  const sp = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 10),
    filtro: params.filtro ?? "todos",
  });
  if (params.q?.trim()) sp.set("q", params.q.trim());
  const res = await fetchWithAuth(
    `/api/v1/nominas/ajustes/horas-extra/autorizados?${sp.toString()}`,
  );
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAutorizadosListResponse;
}

export async function setHorasExtraAutorizacion(
  empleadoIds: number[],
  autorizado: boolean,
): Promise<HorasExtraAutorizacionUpdateResponse> {
  const res = await fetchWithAuth("/api/v1/nominas/ajustes/horas-extra/autorizados", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empleado_ids: empleadoIds, autorizado }),
  });
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAutorizacionUpdateResponse;
}

// ── Aprobadores de horas extra (gerentes regionales / director) ──

export type HorasExtraAprobadorTipo = "gerente_regional" | "director";

export type HorasExtraAprobadorItem = {
  id: number;
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  email: string | null;
  area_descripcion: string | null;
  puesto_descripcion: string | null;
  tipo: HorasExtraAprobadorTipo;
  activo: boolean;
  created_at: string;
};

export type HorasExtraAprobadoresListResponse = {
  gerentes: HorasExtraAprobadorItem[];
  directores: HorasExtraAprobadorItem[];
};

const APROBADORES_URL = "/api/v1/nominas/ajustes/horas-extra/aprobadores";

export type HorasExtraAprobadorCandidatoItem = {
  id: number;
  no_empleado: string;
  nombre: string;
  email: string | null;
  area_descripcion: string | null;
  puesto_descripcion: string | null;
};

export type HorasExtraAprobadorCandidatosResponse = {
  items: HorasExtraAprobadorCandidatoItem[];
};

export async function getHorasExtraAprobadorCandidatos(params: {
  q?: string;
  limit?: number;
}): Promise<HorasExtraAprobadorCandidatosResponse> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const res = await fetchWithAuth(`${APROBADORES_URL}/candidatos${qs ? `?${qs}` : ""}`);
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAprobadorCandidatosResponse;
}

export async function getHorasExtraAprobadores(): Promise<HorasExtraAprobadoresListResponse> {
  const res = await fetchWithAuth(APROBADORES_URL);
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAprobadoresListResponse;
}

export async function createHorasExtraAprobadores(
  tipo: HorasExtraAprobadorTipo,
  empleadoIds: number[],
): Promise<HorasExtraAprobadoresListResponse> {
  const res = await fetchWithAuth(APROBADORES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, empleado_ids: empleadoIds }),
  });
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAprobadoresListResponse;
}

export async function updateHorasExtraAprobador(
  aprobadorId: number,
  activo: boolean,
): Promise<HorasExtraAprobadoresListResponse> {
  const res = await fetchWithAuth(`${APROBADORES_URL}/${aprobadorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activo }),
  });
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAprobadoresListResponse;
}

export async function deleteHorasExtraAprobador(
  aprobadorId: number,
): Promise<HorasExtraAprobadoresListResponse> {
  const res = await fetchWithAuth(`${APROBADORES_URL}/${aprobadorId}`, {
    method: "DELETE",
  });
  if (!res.ok) await throwFetchError(res);
  return (await res.json()) as HorasExtraAprobadoresListResponse;
}
