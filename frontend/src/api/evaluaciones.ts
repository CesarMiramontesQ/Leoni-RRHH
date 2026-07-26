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
  estado: string;
  comentario_devolucion: string | null;
  fecha_evaluacion: string;
  created_at: string;
  updated_at: string;
}

export interface TransicionResponse {
  id: number;
  estado: string;
  mensaje: string;
}

export interface HistorialEvento {
  actor_nombre: string | null;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  comentario: string | null;
  timestamp: string;
}

export interface HistorialResponse {
  evaluacion_id: number;
  estado_actual: string;
  eventos: HistorialEvento[];
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
  estado?: string;
}): Promise<EvaluacionListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.empleado_id) qs.set("empleado_id", String(params.empleado_id));
  if (params.competencia_id) qs.set("competencia_id", String(params.competencia_id));
  if (params.area_id) qs.set("area_id", String(params.area_id));
  if (params.estado) qs.set("estado", params.estado);

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
  niveles_por_grado: Record<string, number>;
  gap: number;
  brecha_pct: number;
  severidad: Severidad;
  accion_recomendada: string | null;
  accion_color: string | null;
}

export interface GradoNivelInfo {
  grado_id: number;
  grado_nombre: string;
  orden: number;
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
  grados: GradoNivelInfo[];
  grado_actual_id: number | null;
}

export async function getEmpleadoResumen(empleadoId: number): Promise<EmpleadoResumen | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/empleado/${empleadoId}/resumen`);
  if (!res.ok) return null;
  return res.json();
}

export interface EmpleadoConPerfil {
  empleado_id: number;
  empleado_nombre: string;
  no_empleado: number | null;
  puesto_perfil_id: number;
  puesto_nombre: string | null;
  puesto_codigo: string | null;
  nivel_puesto: string | null;
  grado_id: number | null;
  grado_nombre: string | null;
  departamento: string | null;
  area_nombre: string | null;
  readiness_score: number;
  brechas_identificadas: number;
  severidad_promedio: string;
  competencias_alineadas: number;
  total_competencias: number;
  competencias_evaluadas: number;
}

export async function getEmpleadosConPerfil(): Promise<EmpleadoConPerfil[]> {
  const res = await fetchWithAuth("/api/v1/evaluaciones/empleados-con-perfil");
  if (!res.ok) {
    const raw = await res.text();
    let detail = raw.trim() || res.statusText || "Error al cargar empleados";
    try {
      const parsed = JSON.parse(raw) as { detail?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail.trim()) {
        detail = parsed.detail.trim();
      }
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
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
  prioridad: string;
  recursos: string | null;
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
  prioridad?: "baja" | "media" | "alta";
  recursos?: string;
}

export interface PDIUpdatePayload {
  accion?: string;
  tipo?: string;
  duracion_horas?: number | null;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable?: string;
  estado?: EstadoPDI;
  prioridad?: "baja" | "media" | "alta";
  recursos?: string;
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
  prioridad: string;
  recursos: string | null;
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
  puesto_perfil_id?: number;
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
  if (params.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
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

export interface PDIFilterOption {
  id: string;
  label: string;
}

export interface PDIFilterOptionsResponse {
  puestos_perfil: PDIFilterOption[];
}

export async function getPDIFilterOptions(params?: {
  area_id?: number;
}): Promise<PDIFilterOptionsResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/filter-options${suffix}`);
  if (!res.ok) return { puestos_perfil: [] };
  return res.json();
}

export async function getPDIResumen(): Promise<PDIResumenResponse> {
  const res = await fetchWithAuth("/api/v1/evaluaciones/pdi/resumen");
  if (!res.ok)
    return { total_acciones: 0, completadas: 0, en_proceso: 0, pendientes: 0, vencidas: 0 };
  return res.json();
}

// ── PDI Estado PATCH ─────────────────────────────────────────────────────────

export async function patchPDIEstado(
  pdiId: number,
  estado: string,
): Promise<PDIGestionItem | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/${pdiId}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── PDI Progreso Equipo ──────────────────────────────────────────────────────

export interface PDIProgresoEmpleadoItem {
  empleado_id: number;
  empleado_nombre: string;
  area_nombre: string | null;
  total: number;
  completadas: number;
  en_proceso: number;
  pendientes: number;
  vencidas: number;
  progreso_pct: number;
}

export interface PDIProgresoEquipoResponse {
  items: PDIProgresoEmpleadoItem[];
  total: number;
}

export async function getPDIProgresoEquipo(params?: {
  area_id?: number;
  puesto_perfil_id?: number;
}): Promise<PDIProgresoEquipoResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/progreso-equipo${suffix}`);
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

// ── Equipo Resumen ───────────────────────────────────────────────────────────

export interface EquipoResumenBrechaItem {
  competencia_id: number;
  competencia_nombre: string;
  gap: number;
}

export interface EquipoResumenEmpleadoItem {
  empleado_id: number;
  nombre: string;
  no_empleado: number;
  puesto_nombre: string | null;
  area_nombre: string | null;
  estatus_pdi: string;
  brechas_criticas: EquipoResumenBrechaItem[];
  ultima_actualizacion: string | null;
  score_competencias: string;
  evaluacion_general_prom: number;
  pdi_total: number;
  pdi_completadas: number;
  progreso_pct: number;
}

export interface EquipoResumenResponse {
  items: EquipoResumenEmpleadoItem[];
  total: number;
}

export async function getPDIEquipoResumen(params?: {
  area_id?: number;
  puesto_perfil_id?: number;
}): Promise<EquipoResumenResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/equipo-resumen${suffix}`);
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

export interface HeatmapCompetencia {
  competencia_id: number;
  competencia_nombre: string;
  categoria: string;
}

export interface HeatmapEmpleado {
  empleado_id: number;
  nombre: string;
  no_empleado: number;
}

export interface HeatmapCell {
  nivel_requerido: number;
  nivel_actual: number;
  gap: number;
}

export interface HeatmapResponse {
  competencias: HeatmapCompetencia[];
  empleados: HeatmapEmpleado[];
  matriz: Record<string, Record<string, HeatmapCell>>;
}

export async function getPDIHeatmap(params?: {
  area_id?: number;
  puesto_perfil_id?: number;
}): Promise<HeatmapResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/heatmap${suffix}`);
  if (!res.ok) return { competencias: [], empleados: [], matriz: {} };
  return res.json();
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  competencia_nombre: string;
  accion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  vencida: boolean;
  dias_restantes: number | null;
}

export interface TimelineResponse {
  eventos: TimelineEvent[];
  total: number;
}

export async function getPDITimeline(params?: {
  area_id?: number;
  puesto_perfil_id?: number;
}): Promise<TimelineResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/timeline${suffix}`);
  if (!res.ok) return { eventos: [], total: 0 };
  return res.json();
}

// ── Workflow API ───────────────────────────────────────────────────────────────

export async function enviarEvaluacion(id: number): Promise<TransicionResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/enviar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function revisarEvaluacion(id: number): Promise<TransicionResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/revisar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function aprobarEvaluacion(id: number): Promise<TransicionResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/aprobar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function cerrarEvaluacion(id: number): Promise<TransicionResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/cerrar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function devolverEvaluacion(id: number, comentario: string): Promise<TransicionResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/devolver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comentario }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getHistorialEvaluacion(id: number): Promise<HistorialResponse | null> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/${id}/historial`);
  if (!res.ok) return null;
  return res.json();
}

// ── Fase 4: KPIs Avanzados, Recomendaciones, Export, Notificar ──────────

export interface PDIKpisAvanzadosResponse {
  cumplimiento_plan_pct: number;
  horas_training_promedio: number;
  promedio_skill_gap: number;
  inversion_horas_total: number;
}

export interface PDIRecomendacionItem {
  accion: string;
  tipo: string;
  justificacion: string;
  prioridad: string;
}

export interface PDIRecomendacionesResponse {
  empleado_id: number;
  recomendaciones: PDIRecomendacionItem[];
}

export async function getPDIKpisAvanzados(params?: {
  area_id?: number;
  puesto_perfil_id?: number;
}): Promise<PDIKpisAvanzadosResponse> {
  const qs = new URLSearchParams();
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/kpis-avanzados${suffix}`);
  if (!res.ok) return { cumplimiento_plan_pct: 0, horas_training_promedio: 0, promedio_skill_gap: 0, inversion_horas_total: 0 };
  return res.json();
}

export async function getPDIRecomendaciones(empleadoId: number): Promise<PDIRecomendacionesResponse> {
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/empleado/${empleadoId}/recomendaciones`);
  if (!res.ok) return { empleado_id: empleadoId, recomendaciones: [] };
  return res.json();
}

export async function exportPDI(
  format: "pdf" | "excel",
  params?: { area_id?: number; puesto_perfil_id?: number },
): Promise<void> {
  const qs = new URLSearchParams({ format });
  if (params?.area_id) qs.set("area_id", String(params.area_id));
  if (params?.puesto_perfil_id) qs.set("puesto_perfil_id", String(params.puesto_perfil_id));
  const res = await fetchWithAuth(`/api/v1/evaluaciones/pdi/export?${qs.toString()}`);
  if (!res.ok) return;
  const blob = await res.blob();
  const ext = format === "excel" ? "xlsx" : "pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pdi_reporte.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function notificarEquipoPDI(): Promise<{ notificaciones_creadas: number; empleados_notificados: number }> {
  const res = await fetchWithAuth("/api/v1/evaluaciones/pdi/notificar-equipo", { method: "POST" });
  if (!res.ok) return { notificaciones_creadas: 0, empleados_notificados: 0 };
  return res.json();
}
