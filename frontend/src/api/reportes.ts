import { getAccessToken } from "../auth/session.ts";
import { fetchWithAuth } from "./http.ts";

export type KpiResponse = {
  fecha: string;
  empleados_activos: number;
  solicitudes_por_estado: Record<string, number>;
  incidencias_abiertas: number;
  actas_pendientes_firma: number;
};

export type KpiFetchError = {
  status: number;
  detail: string;
};

function parseDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
      return String((d[0] as { msg: string }).msg);
    }
  }
  return "Error al cargar los indicadores";
}

export async function getDashboardKpis(): Promise<KpiResponse> {
  if (!getAccessToken()) {
    const err: KpiFetchError = { status: 401, detail: "No hay sesión activa" };
    throw err;
  }

  const res = await fetchWithAuth("/api/v1/reportes/dashboard/kpis");

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err: KpiFetchError = { status: res.status, detail: parseDetail(data) };
    throw err;
  }

  return data as KpiResponse;
}
