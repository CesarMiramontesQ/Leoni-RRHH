// frontend/src/api/evaluacion360.ts
// Cliente HTTP del modulo Evaluacion 360 (Level Up).
// Tipos *Api alineados con app/schemas/evaluacion360.py. Todas las funciones usan
// fetchWithAuth y devuelven fallbacks vacios ante error para no romper la UI.

import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/evaluacion-360";

// ── Tipos crudos del backend ──────────────────────────────────────────────────
export type TipoEvaluadorApi =
  | "autoevaluacion"
  | "jefe"
  | "par"
  | "subordinado"
  | "cliente_interno"
  | "cliente_externo";

export type CampanaEstadoApi =
  | "borrador"
  | "activa"
  | "en_progreso"
  | "finalizada"
  | "cerrada"
  | "cancelada";

export type EvaluacionEstadoApi = "pendiente" | "en_progreso" | "completada" | "vencida";

export interface EscalaApi {
  id: number;
  nombre: string;
  valor_min: number;
  valor_max: number;
  etiquetas: Record<string, string> | null;
  activo: boolean;
}

export interface ConfigApi {
  id: number;
  escala_id: number | null;
  comentarios_obligatorios: boolean;
  autoevaluacion_habilitada: boolean;
  guardar_borradores: boolean;
  evaluacion_anonima: boolean;
  nivel_minimo_esperado: number;
  pesos_evaluadores: Record<string, number> | null;
  frecuencia_sugerida: string;
  recordatorios: Record<string, unknown> | null;
}

export interface PreguntaApi {
  id: number;
  competencia_id: number;
  texto: string;
  orden: number | null;
  activo: boolean;
}

export interface CampanaCompetenciaApi {
  competencia_id: number;
  competencia_nombre: string | null;
  peso: number;
  num_preguntas: number | null;
  nivel_esperado: number;
  obligatoria: boolean;
  orden: number | null;
}

export interface CampanaEvaluadorTipoApi {
  tipo: TipoEvaluadorApi;
  peso: number;
  activo: boolean;
}

export interface CampanaApi {
  id: number;
  nombre: string;
  descripcion: string | null;
  objetivo: string | null;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  estado: CampanaEstadoApi;
  tipo: string;
  escala_id: number | null;
  config: Record<string, unknown> | null;
  participantes: number;
  evaluadores: number;
  evaluaciones_total: number;
  evaluaciones_completadas: number;
  avance: number;
  created_at: string;
  updated_at: string;
}

export interface CampanaDetalleApi extends CampanaApi {
  competencias: CampanaCompetenciaApi[];
  evaluador_tipos: CampanaEvaluadorTipoApi[];
}

export interface CampanaListApi {
  items: CampanaApi[];
  total: number;
  page: number;
  page_size: number;
}

export interface ParticipanteApi {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  puesto: string | null;
  area: string | null;
  estado: string;
  evaluaciones_total: number;
  evaluaciones_completadas: number;
  avance: number;
}

export interface MiEvaluacionApi {
  id: number;
  campana_id: number;
  campana_nombre: string | null;
  evaluado_nombre: string | null;
  tipo_evaluador: TipoEvaluadorApi;
  estado: EvaluacionEstadoApi;
  fecha_asignacion: string;
  fecha_limite: string | null;
  avance: number;
}

export interface PreguntaEvaluacionApi {
  pregunta_id: number;
  texto: string;
  valor: number | null;
}

export interface CompetenciaEvaluacionApi {
  competencia_id: number;
  competencia_nombre: string;
  nivel_esperado: number;
  preguntas: PreguntaEvaluacionApi[];
  comentario: string | null;
}

export interface EvaluacionDetalleApi {
  id: number;
  campana_id: number;
  campana_nombre: string | null;
  evaluado_nombre: string | null;
  tipo_evaluador: TipoEvaluadorApi;
  estado: EvaluacionEstadoApi;
  es_anonima: boolean;
  escala: EscalaApi | null;
  comentarios_obligatorios: boolean;
  fecha_limite: string | null;
  competencias: CompetenciaEvaluacionApi[];
}

export interface ResultadoCompetenciaApi {
  competencia_id: number | null;
  competencia_nombre: string | null;
  promedio_general: number | null;
  promedio_por_tipo: Record<string, number> | null;
  autoevaluacion: number | null;
  nivel_esperado: number | null;
  brecha: number | null;
  estado_brecha: string | null;
}

export interface ResultadoParticipanteApi {
  participante_id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  puesto: string | null;
  calificacion_general: number | null;
  competencias: ResultadoCompetenciaApi[];
  fortalezas: string[];
  oportunidades: string[];
}

export interface DashboardApi {
  kpis: {
    campanas_activas: number;
    campanas_finalizadas: number;
    evaluaciones_pendientes: number;
    evaluaciones_respondidas: number;
    participantes: number;
    promedio_general: number | null;
    competencia_menor: string | null;
    competencia_menor_promedio: number | null;
    competencia_mayor: string | null;
    competencia_mayor_promedio: number | null;
  };
  estado_evaluaciones: { label: string; valor: number }[];
  competencias_mejor: { label: string; valor: number }[];
  competencias_oportunidad: { label: string; valor: number }[];
  avance_por_campana: { campana_id: number; nombre: string; avance: number }[];
  distribucion_calificaciones: { label: string; valor: number }[];
}

// ── Payloads de creacion ──────────────────────────────────────────────────────
export interface CampanaCompetenciaIn {
  competencia_id: number;
  peso: number;
  num_preguntas?: number | null;
  nivel_esperado: number;
  obligatoria: boolean;
  orden?: number | null;
}

export interface CampanaEvaluadorTipoIn {
  tipo: TipoEvaluadorApi;
  peso: number;
  activo: boolean;
}

export interface CampanaCreatePayload {
  nombre: string;
  descripcion?: string | null;
  objetivo?: string | null;
  fecha_inicio?: string | null;
  fecha_cierre?: string | null;
  escala_id?: number | null;
  competencias: CampanaCompetenciaIn[];
  evaluador_tipos: CampanaEvaluadorTipoIn[];
  empleado_ids: number[];
  config?: Record<string, unknown> | null;
}

export interface RespuestaIn {
  pregunta_id: number;
  valor: number;
}

export interface ComentarioIn {
  competencia_id?: number | null;
  texto: string;
  tipo?: "fortaleza" | "oportunidad" | "general";
}

export interface EvaluacionRespuestasPayload {
  respuestas: RespuestaIn[];
  comentarios?: ComentarioIn[];
}

// ── Dashboard / config ────────────────────────────────────────────────────────
export async function fetchEval360Dashboard(): Promise<DashboardApi | null> {
  const res = await fetchWithAuth(`${BASE}/dashboard`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchEval360Config(): Promise<ConfigApi | null> {
  const res = await fetchWithAuth(`${BASE}/config`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateEval360Config(
  payload: Partial<ConfigApi>,
): Promise<ConfigApi | null> {
  const res = await fetchWithAuth(`${BASE}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchEval360Escalas(): Promise<EscalaApi[]> {
  const res = await fetchWithAuth(`${BASE}/escalas`);
  if (!res.ok) return [];
  return res.json();
}

// ── Preguntas ─────────────────────────────────────────────────────────────────
export async function fetchEval360Preguntas(competenciaId?: number): Promise<PreguntaApi[]> {
  const qs = competenciaId != null ? `?competencia_id=${competenciaId}` : "";
  const res = await fetchWithAuth(`${BASE}/preguntas${qs}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createEval360Pregunta(payload: {
  competencia_id: number;
  texto: string;
  orden?: number | null;
}): Promise<PreguntaApi | null> {
  const res = await fetchWithAuth(`${BASE}/preguntas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Campanas ──────────────────────────────────────────────────────────────────
export async function fetchEval360Campanas(params: {
  page?: number;
  page_size?: number;
  estado?: string;
  search?: string;
} = {}): Promise<CampanaListApi> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  if (params.estado) qs.set("estado", params.estado);
  if (params.search) qs.set("search", params.search);
  const res = await fetchWithAuth(`${BASE}/campanas?${qs.toString()}`);
  if (!res.ok) return { items: [], total: 0, page: 1, page_size: 20 };
  return res.json();
}

export async function fetchEval360Campana(id: number): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createEval360Campana(
  payload: CampanaCreatePayload,
): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function activarEval360Campana(id: number): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas/${id}/activar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function duplicarEval360Campana(id: number): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas/${id}/duplicar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function cerrarEval360Campana(id: number): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas/${id}/cerrar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function cancelarEval360Campana(id: number): Promise<CampanaDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/campanas/${id}/cancelar`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchEval360Participantes(campanaId: number): Promise<ParticipanteApi[]> {
  const res = await fetchWithAuth(`${BASE}/campanas/${campanaId}/participantes`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEval360Resultados(
  campanaId: number,
): Promise<ResultadoParticipanteApi[]> {
  const res = await fetchWithAuth(`${BASE}/campanas/${campanaId}/resultados`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEval360ResultadoParticipante(
  participanteId: number,
): Promise<ResultadoParticipanteApi | null> {
  const res = await fetchWithAuth(`${BASE}/participantes/${participanteId}/resultado`);
  if (!res.ok) return null;
  return res.json();
}

// ── Mis Evaluaciones (self-service) ───────────────────────────────────────────
export async function fetchMisEvaluaciones(estado?: string): Promise<MiEvaluacionApi[]> {
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : "";
  const res = await fetchWithAuth(`${BASE}/mis-evaluaciones${qs}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEvaluacionDetalle(id: number): Promise<EvaluacionDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/evaluaciones/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function guardarBorradorEvaluacion(
  id: number,
  payload: EvaluacionRespuestasPayload,
): Promise<EvaluacionDetalleApi | null> {
  const res = await fetchWithAuth(`${BASE}/evaluaciones/${id}/borrador`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function enviarEvaluacion(
  id: number,
  payload: EvaluacionRespuestasPayload,
): Promise<{ ok: boolean; status: number; data: EvaluacionDetalleApi | null }> {
  const res = await fetchWithAuth(`${BASE}/evaluaciones/${id}/enviar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = res.ok ? await res.json() : null;
  return { ok: res.ok, status: res.status, data };
}
