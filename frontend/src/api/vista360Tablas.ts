import { fetchWithAuth } from "./http.ts";
import type { ActasEmpleadoPageResponse } from "./actas.ts";
import type { ComedorRhProximosRegistrosPageApi } from "./comedor.ts";
import { getComedorRhRegistrosReporte } from "./comedor.ts";
import {
  buildIncidenciasListQuery,
  type IncidenciasFetchError,
  type IncidenciasListPageApi,
} from "./incidencias.ts";
import { emptyRhIncidenciaListFilters } from "../incidencias/rh/types.ts";

export const VISTA360_PAGE_SIZE = 5;

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

export async function fetchEmpleadoIncidenciasPage(
  empleadoId: number,
  page: number,
  signal?: AbortSignal,
): Promise<IncidenciasListPageApi> {
  const filters = { ...emptyRhIncidenciaListFilters(), empleado_id: String(empleadoId) };
  const qs = buildIncidenciasListQuery(filters, page, VISTA360_PAGE_SIZE);
  const res = await fetchWithAuth(`/api/v1/incidencias?${qs}`, { signal });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  return (await res.json()) as IncidenciasListPageApi;
}

export async function fetchEmpleadoActasPage(
  empleadoId: number,
  page: number,
  signal?: AbortSignal,
): Promise<ActasEmpleadoPageResponse> {
  const p = new URLSearchParams();
  p.set("page", String(Math.max(1, page)));
  p.set("page_size", String(VISTA360_PAGE_SIZE));
  const res = await fetchWithAuth(`/api/v1/empleados/${empleadoId}/actas?${p.toString()}`, {
    signal,
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return (await res.json()) as ActasEmpleadoPageResponse;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rango amplio para historial de comedor en Vista 360. */
export function vista360ComedorRangoFechas(): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setFullYear(desde.getFullYear() - 2);
  const hasta = new Date(hoy);
  hasta.setFullYear(hasta.getFullYear() + 1);
  return { desde: isoDate(desde), hasta: isoDate(hasta) };
}

export async function fetchEmpleadoComedorRegistrosPage(
  noEmpleado: string,
  page: number,
): Promise<ComedorRhProximosRegistrosPageApi> {
  const { desde, hasta } = vista360ComedorRangoFechas();
  return getComedorRhRegistrosReporte(desde, hasta, page, VISTA360_PAGE_SIZE, {
    buscar: noEmpleado.trim(),
    filtroEstado: "todos",
  });
}
