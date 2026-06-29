import { fetchWithAuth } from "./http.ts";
import type {
  CursosDashboardEmpleadoHistorial,
  CursosDashboardRegistrosParams,
  CursosDashboardRegistrosResponse,
  CursosDashboardResumen,
  EstadoCursoEmpleado,
} from "../dashboard/cursos/seguimientoTypes.ts";

const BASE = "/api/v1/level-up/cursos/dashboard";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function getCursosDashboardResumen(): Promise<CursosDashboardResumen> {
  const res = await fetchWithAuth(`${BASE}/resumen`);
  if (!res.ok) throw new Error("No se pudo cargar el resumen de seguimiento");
  return res.json() as Promise<CursosDashboardResumen>;
}

export async function getCursosDashboardRegistros(
  params: CursosDashboardRegistrosParams = {},
): Promise<CursosDashboardRegistrosResponse> {
  const res = await fetchWithAuth(
    `${BASE}/registros${buildQuery({
      page: params.page,
      page_size: params.page_size,
      empleado_id: params.empleado_id,
      curso_id: params.curso_id,
      area_id: params.area_id,
      puesto_id: params.puesto_id,
      estado_curso: params.estado_curso,
      estado_sesion: params.estado_sesion,
      fecha_desde: params.fecha_desde,
      fecha_hasta: params.fecha_hasta,
      q: params.q,
    })}`,
  );
  if (!res.ok) throw new Error("No se pudieron cargar los registros");
  return res.json() as Promise<CursosDashboardRegistrosResponse>;
}

export async function getCursosDashboardHistorialEmpleado(
  empleadoId: number,
  estadoCurso?: EstadoCursoEmpleado,
): Promise<CursosDashboardEmpleadoHistorial> {
  const qs = estadoCurso ? `?estado_curso=${encodeURIComponent(estadoCurso)}` : "";
  const res = await fetchWithAuth(`${BASE}/empleados/${empleadoId}/historial${qs}`);
  if (!res.ok) throw new Error("No se pudo cargar el historial del empleado");
  return res.json() as Promise<CursosDashboardEmpleadoHistorial>;
}
