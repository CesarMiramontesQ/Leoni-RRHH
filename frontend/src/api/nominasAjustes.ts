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
  area_descripcion: string | null;
  puesto_descripcion: string | null;
  autorizado: boolean;
};

export type HorasExtraAutorizadosListResponse = {
  items: HorasExtraAutorizadoItem[];
  total: number;
  page: number;
  page_size: number;
  total_autorizados: number;
};

export type HorasExtraAutorizacionUpdateResponse = {
  actualizados: number;
  total_autorizados: number;
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
