import { fetchWithAuth } from "./http.ts";

export interface Evaluacion {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  competencia_id: number;
  competencia_nombre: string | null;
  nivel_actual: number;
  evaluador_id: number | null;
  evaluador_nombre: string | null;
  observaciones: string | null;
  fecha_evaluacion: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluacionListResponse {
  items: Evaluacion[];
  total: number;
  page: number;
  page_size: number;
}

export interface EvaluacionPayload {
  empleado_id: number;
  competencia_id: number;
  nivel_actual: number;
  observaciones?: string;
}

export async function getEvaluaciones(params: {
  page?: number;
  page_size?: number;
  empleado_id?: number;
  competencia_id?: number;
  area_id?: number;
}): Promise<EvaluacionListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.empleado_id) qs.set("empleado_id", String(params.empleado_id));
  if (params.competencia_id) qs.set("competencia_id", String(params.competencia_id));
  if (params.area_id) qs.set("area_id", String(params.area_id));

  const res = await fetchWithAuth(`/api/v1/evaluaciones?${qs.toString()}`);
  if (!res.ok) return { items: [], total: 0, page: 1, page_size: 10 };
  return res.json();
}

export async function getEvaluacionesPorEmpleado(empleadoId: number): Promise<Evaluacion[]> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createEvaluacion(payload: EvaluacionPayload): Promise<Evaluacion | null> {
  const res = await fetchWithAuth("/api/v1/evaluaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateEvaluacion(
  id: number,
  payload: { nivel_actual?: number; observaciones?: string }
): Promise<Evaluacion | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteEvaluacion(id: number): Promise<boolean> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}`, {
    method: "DELETE",
  });
  return res.status === 204;
}

export async function bulkCreateEvaluaciones(
  evaluaciones: EvaluacionPayload[]
): Promise<{ creadas: number; errores: string[] }> {
  const res = await fetchWithAuth("/api/v1/evaluaciones/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluaciones }),
  });
  if (!res.ok) return { creadas: 0, errores: ["Error de servidor"] };
  return res.json();
}

export type Severidad = "alineado" | "media" | "alta" | "critica";

export interface CompetenciaResumenItem {
  competencia_id: number;
  competencia_nombre: string;
  categoria: string;
  nivel_requerido: number;
  nivel_actual: number;
  gap: number;
  brecha_pct: number;
  severidad: Severidad;
  accion_recomendada: string | null;
  accion_color: string | null;
}

export interface EmpleadoResumen {
  empleado_id: number;
  empleado_nombre: string;
  area_nombre: string | null;
  puesto_nombre: string | null;
  nivel_puesto: string | null;
  departamento: string | null;
  evaluador_nombre: string | null;
  competencias_alineadas: number;
  brechas_identificadas: number;
  brecha_promedio: number;
  severidad_promedio: string;
  readiness_score: number;
  competencias: CompetenciaResumenItem[];
  cumplimiento_pct: number;
  total_competencias: number;
  evaluadas: number;
  con_gap: number;
}

export async function getEmpleadoResumen(empleadoId: number): Promise<EmpleadoResumen | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/resumen`);
  if (!res.ok) return null;
  return res.json();
}

import { buildNivelMetodoLabelsMap } from "../ui/metodosCalificacionCompetencia.ts";

export function getNivelLabels(): Record<number, string> {
  return buildNivelMetodoLabelsMap(true);
}

/** @deprecated Usar getNivelLabels() tras cargar el catálogo. */
export const NIVEL_LABELS: Record<number, string> = {
  0: "N/A",
  1: "Planeado",
  2: "En entrenamiento",
  3: "Certificado",
  4: "Experto",
};

export const NIVEL_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-600",
  1: "bg-red-100 text-red-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-blue-100 text-blue-700",
  4: "bg-green-100 text-green-700",
};

// ── PDI (Plan de Desarrollo Individual) ──────────────────────────────────────

export type EstadoPDI = "pendiente" | "en_proceso" | "completado" | "cancelado";

export interface PDIAccion {
  id: number;
  empleado_id: number;
  competencia_id: number;
  competencia_nombre: string;
  accion: string;
  tipo: string;
  duracion_horas: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  responsable: string;
  estado: EstadoPDI;
  creado_por: number | null;
  creado_por_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface PDIListResponse {
  items: PDIAccion[];
  total: number;
}

export interface PDICreatePayload {
  competencia_id: number;
  accion: string;
  tipo: string;
  duracion_horas?: number;
  fecha_inicio: string;
  fecha_fin: string;
  responsable: string;
}

export interface PDIUpdatePayload {
  accion?: string;
  tipo?: string;
  duracion_horas?: number | null;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable?: string;
  estado?: EstadoPDI;
}

export async function getPDI(
  empleadoId: number,
  params?: { estado?: string; competencia_id?: number },
): Promise<PDIListResponse> {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.competencia_id) qs.set("competencia_id", String(params.competencia_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/pdi${suffix}`);
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

export async function createPDI(empleadoId: number, payload: PDICreatePayload): Promise<PDIAccion | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/pdi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updatePDI(empleadoId: number, pdiId: number, payload: PDIUpdatePayload): Promise<PDIAccion | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/pdi/${pdiId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deletePDI(empleadoId: number, pdiId: number): Promise<boolean> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/pdi/${pdiId}`, {
    method: "DELETE",
  });
  return res.status === 204;
}

// ── PDI Gestion Consolidada ─────────────────────────────────────────────────

export interface PDIGestionItem {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  area_nombre: string | null;
  puesto_nombre: string | null;
  competencia_id: number;
  competencia_nombre: string;
  accion: string;
  tipo: string;
  duracion_horas: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  responsable: string;
  estado: string;
  vencida: boolean;
  created_at: string;
  updated_at: string;
}

export interface PDIGestionListResponse {
  items: PDIGestionItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PDIResumenResponse {
  total_acciones: number;
  completadas: number;
  en_proceso: number;
  pendientes: number;
  vencidas: number;
}

export async function getPDIGestion(params: {
  page?: number;
  page_size?: number;
  area_id?: number;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  search?: string;
  solo_vencidas?: boolean;
}): Promise<PDIGestionListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.area_id) qs.set("area_id", String(params.area_id));
  if (params.estado) qs.set("estado", params.estado);
  if (params.fecha_inicio) qs.set("fecha_inicio", params.fecha_inicio);
  if (params.fecha_fin) qs.set("fecha_fin", params.fecha_fin);
  if (params.search) qs.set("search", params.search);
  if (params.solo_vencidas) qs.set("solo_vencidas", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi${suffix}`);
  if (!res.ok) return { items: [], total: 0, page: 1, page_size: 10 };
  return res.json();
}

export async function getPDIResumen(): Promise<PDIResumenResponse> {
  const res = await fetchWithAuth("/api/v1/evaluaciones/pdi/resumen");
  if (!res.ok)
    return { total_acciones: 0, completadas: 0, en_proceso: 0, pendientes: 0, vencidas: 0 };
  return res.json();
}
