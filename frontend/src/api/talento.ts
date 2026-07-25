/**
 * Cliente API del Dashboard de Talento (consolidación por área, solo lectura).
 * Types sincronizados con app/schemas/talento.py — no dupliques fuera de aquí.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/talento";

export class TalentoApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* sin cuerpo JSON */
  }
  throw new TalentoApiError(detail, res.status);
}

export type Semaforo = "verde" | "ambar" | "rojo";

export interface CicloInfo {
  id: number;
  nombre: string;
  estado: string;
}

export interface AreaDesempeno {
  area_id: number | null;
  area_nombre: string;
  n_empleados: number;
  calificacion_promedio: number | null;
  cumplimiento_metas_pct: number | null;
  con_resultado_pct: number;
  distribucion: Record<string, number>;
  semaforo: Semaforo | null;
}

export interface OrgDesempeno {
  calificacion_promedio: number | null;
  cumplimiento_metas_pct: number | null;
  con_resultado_pct: number;
  distribucion: Record<string, number>;
  nine_box: Record<string, number>;
  semaforo: Semaforo | null;
  n_empleados: number;
}

export interface BloqueDesempeno {
  disponible: boolean;
  motivo: string | null;
  ciclo: CicloInfo | null;
  org: OrgDesempeno | null;
  areas: AreaDesempeno[];
}

export interface AreaPolivalencia {
  area_id: number;
  area_nombre: string;
  n_empleados: number;
  pol_pct: number | null;
  resiliencia_pct: number | null;
  n_criticas: number;
  semaforo: Semaforo | null;
}

export interface OrgPolivalencia {
  pol_pct: number | null;
  resiliencia_pct: number | null;
  n_criticas: number;
  n_empleados: number;
  semaforo: Semaforo | null;
}

export interface BloquePolivalencia {
  disponible: boolean;
  motivo: string | null;
  org: OrgPolivalencia | null;
  areas: AreaPolivalencia[];
}

export interface AreaCapacitacion {
  area_id: number | null;
  area_nombre: string;
  total_pares: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_obligatorio_pendiente: number;
  semaforo: Semaforo | null;
}

export interface OrgCapacitacion {
  total_pares: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_obligatorio_pendiente: number;
  semaforo: Semaforo | null;
}

export interface BloqueCapacitacion {
  disponible: boolean;
  motivo: string | null;
  org: OrgCapacitacion | null;
  areas: AreaCapacitacion[];
}

export interface AreaPdi {
  area_id: number | null;
  area_nombre: string;
  total: number;
  completados: number;
  cancelados: number;
  cumplimiento_pct: number | null;
  n_vencidos: number;
  n_activos: number;
  semaforo: Semaforo | null;
}

export interface OrgPdi {
  total: number;
  completados: number;
  cancelados: number;
  cumplimiento_pct: number | null;
  n_vencidos: number;
  n_activos: number;
  semaforo: Semaforo | null;
}

export interface BloquePdi {
  disponible: boolean;
  motivo: string | null;
  org: OrgPdi | null;
  areas: AreaPdi[];
}

export interface AreaObjetivo {
  area_id: number | null;
  area_nombre: string;
  n_empleados: number;
  indice_promedio: number | null;
}

export interface BloqueObjetivo {
  disponible: boolean;
  motivo: string | null;
  rango: { desde: string; hasta: string } | null;
  org: { n_empleados: number; indice_promedio: number | null } | null;
  areas: AreaObjetivo[];
}

export interface EmpleadoFoco {
  empleado_id: number;
  no_empleado: number | string | null;
  nombre: string;
  puesto_nombre: string | null;
  senales: string[];
}

export interface DetalleArea {
  area_id: number;
  area_nombre: string;
  desempeno: AreaDesempeno | null;
  polivalencia: AreaPolivalencia | null;
  capacitacion: AreaCapacitacion | null;
  pdi: AreaPdi | null;
  empleados_foco: EmpleadoFoco[];
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await fetchWithAuth(`${BASE}${path}`);
  if (!res.ok) return parseError(res, fallback);
  return res.json();
}

export function getDesempeno(cicloId?: number): Promise<BloqueDesempeno> {
  const q = cicloId ? `?ciclo_id=${cicloId}` : "";
  return getJson(`/desempeno${q}`, "No se pudo cargar el desempeño");
}

export function getPolivalencia(): Promise<BloquePolivalencia> {
  return getJson("/polivalencia", "No se pudo cargar la polivalencia");
}

export function getCapacitacion(): Promise<BloqueCapacitacion> {
  return getJson("/capacitacion", "No se pudo cargar la capacitación");
}

export function getPdi(): Promise<BloquePdi> {
  return getJson("/pdi", "No se pudieron cargar los planes de desarrollo");
}

export function getObjetivo(): Promise<BloqueObjetivo> {
  return getJson("/objetivo", "No se pudo cargar el índice objetivo");
}

export function getDetalleArea(areaId: number, cicloId?: number): Promise<DetalleArea> {
  const q = cicloId ? `?ciclo_id=${cicloId}` : "";
  return getJson(`/areas/${areaId}/detalle${q}`, "No se pudo cargar el detalle del área");
}

/** Descarga el .xlsx del dashboard (mismo patrón que `descargarCoberturaAreaExcel`). */
export async function descargarDashboardExcel(filenameFallback: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/export`);
  if (!res.ok) return false;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename=([^;]+)/.exec(disposition);
  const filename = match?.[1]?.trim().replace(/^"|"$/g, "") || filenameFallback;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
