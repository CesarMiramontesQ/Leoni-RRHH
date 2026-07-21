/**
 * Cliente API centralizado del módulo Encuestas RH (Level Up / Talento).
 * Types sincronizados con app/schemas/encuestas_rh.py — no dupliques estos
 * tipos fuera de este archivo.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/encuestas-rh";

export class EncuestasRhApiError extends Error {
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
  throw new EncuestasRhApiError(detail, res.status);
}

// ── Tipos: opciones / preguntas ──────────────────────────────────────────────

export type PreguntaTipo = "likert" | "opcion_multiple" | "texto";
export type EncuestaTipo = "clima" | "pulso" | "otra";
export type EncuestaEstado = "borrador" | "publicada" | "cerrada";
export type ParticipanteEstado = "pendiente" | "respondida";

export interface OpcionCreate {
  texto: string;
  orden?: number | null;
}

export interface OpcionResponse {
  id: number;
  texto: string;
  orden: number | null;
}

export interface PreguntaCreate {
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  requerida: boolean;
  seleccion_multiple: boolean;
  opciones: OpcionCreate[];
}

export interface PreguntaUpdate {
  orden?: number;
  tipo?: PreguntaTipo;
  texto?: string;
  requerida?: boolean;
  seleccion_multiple?: boolean;
  opciones?: OpcionCreate[];
}

export interface PreguntaResponse {
  id: number;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  requerida: boolean;
  seleccion_multiple: boolean;
  opciones: OpcionResponse[];
}

// ── Tipos: encuesta ───────────────────────────────────────────────────────────

export interface EncuestaCreate {
  titulo: string;
  descripcion?: string | null;
  tipo: EncuestaTipo;
  es_anonima: boolean;
  umbral_minimo_respuestas?: number;
  recordatorio_cada_dias?: number;
  preguntas?: PreguntaCreate[];
}

export interface EncuestaUpdate {
  titulo?: string;
  descripcion?: string | null;
  tipo?: EncuestaTipo;
  es_anonima?: boolean;
  umbral_minimo_respuestas?: number;
  recordatorio_cada_dias?: number;
  fecha_cierre_programada?: string | null;
}

export interface EncuestaResponse {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: EncuestaTipo;
  es_anonima: boolean;
  umbral_minimo_respuestas: number;
  estado: EncuestaEstado;
  fecha_publicacion: string | null;
  fecha_cierre_programada: string | null;
  fecha_cierre_real: string | null;
  audiencia_criterios: Record<string, unknown> | null;
  recordatorio_cada_dias: number;
  creado_por_id: number | null;
  created_at: string;
  preguntas: PreguntaResponse[];
}

// ── Tipos: audiencia ──────────────────────────────────────────────────────────

export interface AudienciaFiltros {
  areas: number[];
  turnos: string[];
  roles: string[];
}

export interface AudienciaAreaConteo {
  area_id: number | null;
  area_nombre: string | null;
  total: number;
}

export interface AudienciaTurnoConteo {
  turno: string | null;
  total: number;
}

export interface AudienciaPreview {
  total: number;
  por_area: AudienciaAreaConteo[];
  por_turno: AudienciaTurnoConteo[];
}

export interface PublicarRequest {
  filtros: AudienciaFiltros;
  fecha_cierre_programada: string;
}

// ── Tipos: responder ──────────────────────────────────────────────────────────

export interface ResponderItem {
  pregunta_id: number;
  valor_likert?: number | null;
  texto?: string | null;
  opcion_ids?: number[] | null;
}

export interface ResponderRequest {
  respuestas: ResponderItem[];
}

// ── Tipos: mis encuestas / participantes ──────────────────────────────────────

export interface MiEncuestaItem {
  encuesta_id: number;
  titulo: string;
  tipo: EncuestaTipo;
  estado: EncuestaEstado;
  participante_estado: ParticipanteEstado;
  fecha_respuesta: string | null;
  fecha_cierre_programada: string | null;
  es_anonima: boolean;
}

export interface ParticipanteItem {
  empleado_id: number;
  empleado_nombre: string | null;
  estado: ParticipanteEstado;
  fecha_respuesta: string | null;
}

// ── Tipos: plantillas ─────────────────────────────────────────────────────────

export interface PlantillaResponse {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo: EncuestaTipo | null;
  es_predefinida: boolean;
  definicion: Record<string, unknown>[];
}

// ── Tipos: recordatorios ──────────────────────────────────────────────────────

export interface ForzarRecordatoriosResponse {
  recordatorios_enviados: number;
}

// ── Tipos: resultados / analítica ─────────────────────────────────────────────

export interface DistribucionLikert {
  valor: number;
  conteo: number;
}

export interface OpcionConteo {
  opcion_id: number;
  texto: string;
  conteo: number;
}

export interface ResultadoPregunta {
  pregunta_id: number;
  tipo: PreguntaTipo;
  texto: string;
  n: number;
  promedio: number | null;
  distribucion: DistribucionLikert[];
  opciones: OpcionConteo[];
}

export interface ResultadosGlobal {
  encuesta_id: number;
  titulo: string;
  es_anonima: boolean;
  estado: EncuestaEstado;
  umbral_minimo_respuestas: number;
  n: number;
  total_participantes: number;
  tasa_respuesta: number;
  oculto_global: boolean;
  preguntas: ResultadoPregunta[];
}

export type SegmentoDimension = "area" | "turno" | "clasificacion";

export interface SegmentoCelda {
  segmento: string;
  n: number;
  oculto: boolean;
  preguntas: ResultadoPregunta[];
}

export interface ResultadosSegmentos {
  encuesta_id: number;
  dimension: SegmentoDimension;
  umbral_minimo_respuestas: number;
  celdas: SegmentoCelda[];
}

export interface TextosResponse {
  encuesta_id: number;
  pregunta_id: number;
  n: number;
  umbral_minimo_respuestas: number;
  oculto: boolean;
  textos: string[];
}

// ── Helpers de query string ───────────────────────────────────────────────────

function appendRepeated(sp: URLSearchParams, key: string, values: readonly (string | number)[]): void {
  for (const v of values) sp.append(key, String(v));
}

// ── Gestión — encuestas (CRUD) ────────────────────────────────────────────────

export async function listEncuestas(estado?: EncuestaEstado | null): Promise<EncuestaResponse[]> {
  const sp = new URLSearchParams();
  if (estado) sp.set("estado", estado);
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/encuestas${suffix}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar las encuestas");
  return res.json() as Promise<EncuestaResponse[]>;
}

export async function createEncuesta(data: EncuestaCreate): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo crear la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function getEncuesta(encuestaId: number): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function updateEncuesta(encuestaId: number, data: EncuestaUpdate): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function deleteEncuesta(encuestaId: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await parseError(res, "No se pudo eliminar la encuesta");
}

// ── Gestión — preguntas (solo borrador) ───────────────────────────────────────

export async function addPregunta(encuestaId: number, data: PreguntaCreate): Promise<PreguntaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/preguntas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo agregar la pregunta");
  return res.json() as Promise<PreguntaResponse>;
}

export async function reordenarPreguntas(
  encuestaId: number,
  preguntaIds: number[],
): Promise<PreguntaResponse[]> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/preguntas/reordenar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pregunta_ids: preguntaIds }),
  });
  if (!res.ok) await parseError(res, "No se pudo reordenar las preguntas");
  return res.json() as Promise<PreguntaResponse[]>;
}

export async function updatePregunta(
  encuestaId: number,
  preguntaId: number,
  data: PreguntaUpdate,
): Promise<PreguntaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/preguntas/${preguntaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar la pregunta");
  return res.json() as Promise<PreguntaResponse>;
}

export async function deletePregunta(encuestaId: number, preguntaId: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/preguntas/${preguntaId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) await parseError(res, "No se pudo eliminar la pregunta");
}

// ── Gestión — audiencia / ciclo de vida ───────────────────────────────────────

export async function previewAudiencia(filtros: {
  areas?: readonly number[];
  turnos?: readonly string[];
  roles?: readonly string[];
}): Promise<AudienciaPreview> {
  const sp = new URLSearchParams();
  appendRepeated(sp, "areas", filtros.areas ?? []);
  appendRepeated(sp, "turnos", filtros.turnos ?? []);
  appendRepeated(sp, "roles", filtros.roles ?? []);
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/audiencia/preview${suffix}`);
  if (!res.ok) await parseError(res, "No se pudo calcular la audiencia");
  return res.json() as Promise<AudienciaPreview>;
}

export async function publicarEncuesta(encuestaId: number, data: PublicarRequest): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/publicar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo publicar la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function cerrarEncuesta(encuestaId: number): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/cerrar`, { method: "POST" });
  if (!res.ok) await parseError(res, "No se pudo cerrar la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function listParticipantes(encuestaId: number): Promise<ParticipanteItem[]> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/participantes`);
  if (!res.ok) await parseError(res, "No se pudo cargar la lista de participantes");
  return res.json() as Promise<ParticipanteItem[]>;
}

export async function forzarRecordatorios(encuestaId: number): Promise<ForzarRecordatoriosResponse> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/recordatorios`, { method: "POST" });
  if (!res.ok) await parseError(res, "No se pudieron enviar los recordatorios");
  return res.json() as Promise<ForzarRecordatoriosResponse>;
}

// ── Gestión — plantillas ──────────────────────────────────────────────────────

export async function listPlantillas(): Promise<PlantillaResponse[]> {
  const res = await fetchWithAuth(`${BASE}/plantillas`);
  if (!res.ok) await parseError(res, "No se pudieron cargar las plantillas");
  return res.json() as Promise<PlantillaResponse[]>;
}

export async function crearEncuestaDesdePlantilla(
  plantillaId: number,
  esAnonima: boolean,
): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/plantillas/${plantillaId}/crear-encuesta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ es_anonima: esAnonima }),
  });
  if (!res.ok) await parseError(res, "No se pudo crear la encuesta desde la plantilla");
  return res.json() as Promise<EncuestaResponse>;
}

// ── Gestión — resultados / analítica ──────────────────────────────────────────

export async function getResultadosGlobales(encuestaId: number): Promise<ResultadosGlobal> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/resultados`);
  if (!res.ok) await parseError(res, "No se pudieron cargar los resultados");
  return res.json() as Promise<ResultadosGlobal>;
}

export async function getResultadosSegmentos(
  encuestaId: number,
  dimension: SegmentoDimension,
): Promise<ResultadosSegmentos> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/resultados/segmentos?dimension=${dimension}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar los resultados por segmento");
  return res.json() as Promise<ResultadosSegmentos>;
}

export async function getResultadosTextos(encuestaId: number, preguntaId: number): Promise<TextosResponse> {
  const res = await fetchWithAuth(
    `${BASE}/encuestas/${encuestaId}/resultados/textos?pregunta_id=${preguntaId}`,
  );
  if (!res.ok) await parseError(res, "No se pudieron cargar las respuestas de texto");
  return res.json() as Promise<TextosResponse>;
}

/** Descarga el export Excel autenticado disparando el guardado del archivo. */
export async function descargarResultadosExcel(encuestaId: number, filenameFallback: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/export/excel`);
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

// ── Self-service — mis encuestas ──────────────────────────────────────────────

export async function getMisEncuestas(): Promise<MiEncuestaItem[]> {
  const res = await fetchWithAuth(`${BASE}/mis-encuestas`);
  if (!res.ok) await parseError(res, "No se pudieron cargar tus encuestas");
  return res.json() as Promise<MiEncuestaItem[]>;
}

export async function getMiEncuesta(encuestaId: number): Promise<EncuestaResponse> {
  const res = await fetchWithAuth(`${BASE}/mis-encuestas/${encuestaId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la encuesta");
  return res.json() as Promise<EncuestaResponse>;
}

export async function responderEncuesta(encuestaId: number, data: ResponderRequest): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/mis-encuestas/${encuestaId}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok && res.status !== 204) await parseError(res, "No se pudo registrar tu respuesta");
}
