/**
 * Cliente API centralizado del módulo Metas (OKR ligero, Level Up / Talento).
 * Types sincronizados con app/schemas/metas.py — no dupliques estos tipos
 * fuera de este archivo. Endpoints y shapes documentados en
 * .superpowers/sdd/task-3-report.md y .superpowers/sdd/task-4-report.md.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/metas";

export class MetasApiError extends Error {
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
  throw new MetasApiError(detail, res.status);
}

// ── Tipos: ciclo ──────────────────────────────────────────────────────────

export type CicloEstado = "borrador" | "activo" | "cerrado";

export interface MetaCicloCreate {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface MetaCicloUpdate {
  nombre?: string;
  descripcion?: string | null;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface MetaCicloResponse {
  id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: CicloEstado;
  creado_por_id: number | null;
  created_at: string;
  updated_at: string;
}

// ── Tipos: resultado clave ────────────────────────────────────────────────

export type RcTipoMetrica = "numero" | "porcentaje" | "booleano" | "moneda";
export type RcDireccion = "subir" | "bajar";

export interface ResultadoClaveCreate {
  orden?: number;
  titulo: string;
  tipo_metrica: RcTipoMetrica;
  unidad?: string | null;
  direccion: RcDireccion;
  valor_inicial: number;
  valor_objetivo: number;
  valor_actual?: number | null;
}

export interface ResultadoClaveUpdate {
  orden?: number;
  titulo?: string;
  unidad?: string | null;
  valor_objetivo?: number;
}

export interface ResultadoClaveResponse {
  id: number;
  meta_id: number;
  orden: number;
  titulo: string;
  tipo_metrica: RcTipoMetrica;
  unidad: string | null;
  direccion: RcDireccion;
  valor_inicial: number;
  valor_objetivo: number;
  valor_actual: number;
  avance: number;
}

// ── Tipos: check-in ───────────────────────────────────────────────────────

export interface CheckinRequest {
  valor: number;
  nota?: string | null;
}

export interface CheckinResponse {
  id: number;
  resultado_clave_id: number;
  autor_id: number;
  valor_registrado: number;
  nota: string | null;
  es_ajuste_jefe: boolean;
  created_at: string;
  avance_resultante: number;
}

// ── Tipos: meta ───────────────────────────────────────────────────────────

export type MetaNivel = "individual" | "equipo";
export type MetaEstado = "asignada" | "en_progreso" | "cerrada";

export interface MetaCreate {
  ciclo_id: number;
  nivel: MetaNivel;
  empleado_id?: number | null;
  area_id?: number | null;
  lider_id?: number | null;
  titulo: string;
  descripcion?: string | null;
  peso: number;
  meta_padre_id?: number | null;
  resultados_clave?: ResultadoClaveCreate[];
}

export interface MetaUpdate {
  titulo?: string;
  descripcion?: string | null;
  peso?: number;
  meta_padre_id?: number | null;
  empleado_id?: number | null;
  area_id?: number | null;
  lider_id?: number | null;
}

export interface MetaResponse {
  id: number;
  ciclo_id: number;
  nivel: MetaNivel;
  empleado_id: number | null;
  area_id: number | null;
  lider_id: number | null;
  titulo: string;
  descripcion: string | null;
  peso: number;
  estado: MetaEstado;
  meta_padre_id: number | null;
  asignada_por_id: number;
  calificacion_cierre: number | null;
  comentario_cierre: string | null;
  avance: number;
  resultados_clave: ResultadoClaveResponse[];
  created_at: string;
  updated_at: string;
}

export interface CerrarMetaRequest {
  calificacion: number;
  comentario?: string | null;
}

// ── Tipos: cumplimiento / tablero de equipo ───────────────────────────────

export interface CumplimientoResponse {
  ciclo_id: number;
  empleado_id: number;
  cumplimiento: number;
  metas_consideradas: number;
}

export interface EquipoAvanceMiembro {
  empleado_id: number;
  empleado_nombre: string | null;
  metas: MetaResponse[];
  avance_global: number;
}

export interface EquipoAvanceResponse {
  ciclo_id: number;
  miembros: EquipoAvanceMiembro[];
  metas_equipo: MetaResponse[];
}

// ── Gestión — ciclos ───────────────────────────────────────────────────────

export async function listCiclos(estado?: CicloEstado | null): Promise<MetaCicloResponse[]> {
  const sp = new URLSearchParams();
  if (estado) sp.set("estado", estado);
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/ciclos${suffix}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar los ciclos");
  return res.json() as Promise<MetaCicloResponse[]>;
}

export async function createCiclo(data: MetaCicloCreate): Promise<MetaCicloResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo crear el ciclo");
  return res.json() as Promise<MetaCicloResponse>;
}

export async function getCiclo(cicloId: number): Promise<MetaCicloResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar el ciclo");
  return res.json() as Promise<MetaCicloResponse>;
}

export async function updateCiclo(cicloId: number, data: MetaCicloUpdate): Promise<MetaCicloResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar el ciclo");
  return res.json() as Promise<MetaCicloResponse>;
}

export async function activarCiclo(cicloId: number): Promise<MetaCicloResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/activar`, { method: "POST" });
  if (!res.ok) await parseError(res, "No se pudo activar el ciclo");
  return res.json() as Promise<MetaCicloResponse>;
}

export async function cerrarCiclo(cicloId: number): Promise<MetaCicloResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/cerrar`, { method: "POST" });
  if (!res.ok) await parseError(res, "No se pudo cerrar el ciclo");
  return res.json() as Promise<MetaCicloResponse>;
}

/** Descarga el export Excel del ciclo (mismo patrón que encuestas RH). */
export async function descargarCicloExcel(cicloId: number, filenameFallback: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/export/excel`);
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

// ── Gestión — metas (scoping de equipo o global vía middleware/backend) ──

export interface MetaFiltrosParams {
  ciclo_id?: number | null;
  empleado_id?: number | null;
  nivel?: MetaNivel | null;
}

export async function listMetas(filtros: MetaFiltrosParams): Promise<MetaResponse[]> {
  const sp = new URLSearchParams();
  if (filtros.ciclo_id != null) sp.set("ciclo_id", String(filtros.ciclo_id));
  if (filtros.empleado_id != null) sp.set("empleado_id", String(filtros.empleado_id));
  if (filtros.nivel) sp.set("nivel", filtros.nivel);
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/metas${suffix}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar las metas");
  return res.json() as Promise<MetaResponse[]>;
}

export async function createMeta(data: MetaCreate): Promise<MetaResponse> {
  const res = await fetchWithAuth(`${BASE}/metas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo crear la meta");
  return res.json() as Promise<MetaResponse>;
}

export async function getMeta(metaId: number): Promise<MetaResponse> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la meta");
  return res.json() as Promise<MetaResponse>;
}

export async function updateMeta(metaId: number, data: MetaUpdate): Promise<MetaResponse> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar la meta");
  return res.json() as Promise<MetaResponse>;
}

export async function deleteMeta(metaId: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await parseError(res, "No se pudo eliminar la meta");
}

export async function cerrarMeta(metaId: number, data: CerrarMetaRequest): Promise<MetaResponse> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}/cerrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo cerrar/calificar la meta");
  return res.json() as Promise<MetaResponse>;
}

// ── Gestión — resultados clave (mismo scoping que la meta dueña) ─────────

export async function addResultado(metaId: number, data: ResultadoClaveCreate): Promise<ResultadoClaveResponse> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}/resultados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo agregar el resultado clave");
  return res.json() as Promise<ResultadoClaveResponse>;
}

export async function updateResultado(
  metaId: number,
  rcId: number,
  data: ResultadoClaveUpdate,
): Promise<ResultadoClaveResponse> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}/resultados/${rcId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar el resultado clave");
  return res.json() as Promise<ResultadoClaveResponse>;
}

export async function deleteResultado(metaId: number, rcId: number): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/metas/${metaId}/resultados/${rcId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await parseError(res, "No se pudo eliminar el resultado clave");
}

/** Ajuste del jefe/RH (`es_ajuste_jefe=true` en el backend) sobre un RC de un empleado en su scope. */
export async function ajusteCheckin(rcId: number, data: CheckinRequest): Promise<CheckinResponse> {
  const res = await fetchWithAuth(`${BASE}/resultados/${rcId}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo registrar el ajuste de avance");
  return res.json() as Promise<CheckinResponse>;
}

// ── Gestión — tablero de equipo / cumplimiento ────────────────────────────

export async function getEquipoAvance(cicloId: number): Promise<EquipoAvanceResponse> {
  const res = await fetchWithAuth(`${BASE}/equipo/avance?ciclo_id=${cicloId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar el tablero de equipo");
  return res.json() as Promise<EquipoAvanceResponse>;
}

export async function getCumplimientoEmpleado(empleadoId: number, cicloId: number): Promise<CumplimientoResponse> {
  const res = await fetchWithAuth(`${BASE}/empleados/${empleadoId}/cumplimiento?ciclo_id=${cicloId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar el cumplimiento");
  return res.json() as Promise<CumplimientoResponse>;
}

// ── Self-service — mis metas ───────────────────────────────────────────────

export async function getMisMetas(cicloId?: number | null): Promise<MetaResponse[]> {
  const sp = new URLSearchParams();
  if (cicloId != null) sp.set("ciclo_id", String(cicloId));
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/mis-metas${suffix}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar tus metas");
  return res.json() as Promise<MetaResponse[]>;
}

export async function getMiMeta(metaId: number): Promise<MetaResponse> {
  const res = await fetchWithAuth(`${BASE}/mis-metas/${metaId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la meta");
  return res.json() as Promise<MetaResponse>;
}

/** El empleado siempre hace check-in sobre sus propios RC (`empleado_id` lo resuelve el backend del token). */
export async function miCheckin(rcId: number, data: CheckinRequest): Promise<CheckinResponse> {
  const res = await fetchWithAuth(`${BASE}/mis-metas/resultados/${rcId}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo registrar tu check-in");
  return res.json() as Promise<CheckinResponse>;
}
