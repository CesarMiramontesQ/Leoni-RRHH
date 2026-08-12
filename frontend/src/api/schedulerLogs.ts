import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/scheduler-logs";

export type SchedulerLogResultado = "en_curso" | "ok" | "advertencia" | "error";

export type SchedulerLogItem = {
  id: number;
  job_id: string;
  inicio_at: string;
  fin_at: string | null;
  duracion_ms: number | null;
  resultado: SchedulerLogResultado;
  resumen: string | null;
  error: string | null;
};

export type SchedulerLogLinea = {
  ts: string;
  nivel: string;
  mensaje: string;
};

export type SchedulerLogDetalle = SchedulerLogItem & {
  lineas: SchedulerLogLinea[];
  lineas_descartadas: number;
};

export type SchedulerLogPage = {
  items: SchedulerLogItem[];
  total: number;
  page: number;
  page_size: number;
};

export type SchedulerLogFiltros = {
  job_id?: string;
  resultado?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  page_size?: number;
};

async function readErrorDetail(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { detail?: string } | null;
  return err?.detail ?? `HTTP ${res.status}`;
}

export async function fetchSchedulerLogs(
  filtros: SchedulerLogFiltros = {},
  signal?: AbortSignal,
): Promise<SchedulerLogPage> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "") params.set(clave, String(valor));
  }
  const query = params.toString();
  const res = await fetchWithAuth(query ? `${BASE}?${query}` : BASE, { signal });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return (await res.json()) as SchedulerLogPage;
}

export async function fetchSchedulerLogDetalle(
  id: number,
  signal?: AbortSignal,
): Promise<SchedulerLogDetalle> {
  const res = await fetchWithAuth(`${BASE}/${id}`, { signal });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return (await res.json()) as SchedulerLogDetalle;
}

export async function fetchSchedulerJobIds(signal?: AbortSignal): Promise<string[]> {
  const res = await fetchWithAuth(`${BASE}/jobs`, { signal });
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return ((await res.json()) as { items: string[] }).items;
}
