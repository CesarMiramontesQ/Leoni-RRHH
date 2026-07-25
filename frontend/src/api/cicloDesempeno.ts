/**
 * Cliente API centralizado del módulo Ciclo de Desempeño (orquestador de
 * Metas + Evaluación 360°, Level Up / Talento). Types sincronizados con
 * `app/schemas/ciclo_desempeno.py` — no dupliques estos tipos fuera de este
 * archivo. Endpoints documentados en `.claude/jobs/f4c1adb5/tmp/cd-task-5-report.md`.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/ciclo-desempeno";

export class CicloDesempenoApiError extends Error {
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
  throw new CicloDesempenoApiError(detail, res.status);
}

// ── Tipos: ciclo ──────────────────────────────────────────────────────────

export type CicloDesempenoEstado = "borrador" | "activo" | "cerrado";
export type CicloDesempenoBanda = "bajo" | "medio" | "alto";

export interface CicloDesempenoCreate {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  meta_ciclo_id?: number | null;
  eval360_campana_id?: number | null;
  peso_metas?: number;
  peso_competencias?: number;
  peso_historial?: number;
  umbral_medio?: number;
  umbral_alto?: number;
  config?: Record<string, unknown> | null;
}

export interface CicloDesempenoUpdate {
  nombre?: string;
  descripcion?: string | null;
  fecha_inicio?: string;
  fecha_fin?: string;
  meta_ciclo_id?: number | null;
  eval360_campana_id?: number | null;
  peso_metas?: number;
  peso_competencias?: number;
  peso_historial?: number;
  umbral_medio?: number;
  umbral_alto?: number;
  config?: Record<string, unknown> | null;
}

export interface CicloDesempenoResponse {
  id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: CicloDesempenoEstado;
  meta_ciclo_id: number | null;
  eval360_campana_id: number | null;
  peso_metas: number;
  peso_competencias: number;
  peso_historial: number;
  umbral_medio: number;
  umbral_alto: number;
  config: Record<string, unknown> | null;
  creado_por_id: number | null;
  created_at: string;
  updated_at: string;
  total_participantes: number | null;
}

// ── Tipos: resultado (snapshot por empleado) ──────────────────────────────

export interface CicloDesempenoResultadoResponse {
  id: number;
  ciclo_id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  /** Área actual del empleado; alimenta la columna y el filtro por área. */
  area_id: number | null;
  area_nombre: string | null;
  cumplimiento_metas: number | null;
  calificacion_360_raw: number | null;
  calificacion_360_norm: number | null;
  escala_min: number | null;
  escala_max: number | null;
  calificacion_desempeno: number | null;
  indice_historial: number | null;
  peso_historial_efectivo: number | null;
  peso_metas_efectivo: number | null;
  peso_competencias_efectivo: number | null;
  potencial: number | null;
  banda_desempeno: CicloDesempenoBanda | null;
  banda_potencial: CicloDesempenoBanda | null;
  segmento_9box: string | null;
  banda_desempeno_ajustada: CicloDesempenoBanda | null;
  banda_desempeno_efectiva: CicloDesempenoBanda | null;
  banda_ajuste_motivo: string | null;
  banda_ajustada_por_id: number | null;
  banda_ajustada_at: string | null;
  potencial_capturado_por_id: number | null;
  potencial_capturado_at: string | null;
  snapshot_at: string | null;
}

// ── Tipos: captura de potencial (batch) ───────────────────────────────────

export interface PotencialUpdateItem {
  empleado_id: number;
  potencial: number;
}

export interface PotencialUpdateRequest {
  items: PotencialUpdateItem[];
}

// ── Tipos: matriz 9-Box ────────────────────────────────────────────────────

export interface NueveBoxEmpleadoItem {
  empleado_id: number;
  empleado_nombre: string | null;
  calificacion_desempeno: number | null;
  potencial: number | null;
}

export interface CeldaResponse {
  banda_desempeno: CicloDesempenoBanda;
  banda_potencial: CicloDesempenoBanda;
  segmento: string;
  empleados: NueveBoxEmpleadoItem[];
}

export interface NueveBoxResponse {
  ciclo_id: number;
  celdas: CeldaResponse[];
  resumen: Record<string, unknown> | null;
}

// ── Tipos: calibración (ajuste directo de banda + distribución) ───────────

export interface BandaAjusteItem {
  empleado_id: number;
  banda_ajustada: CicloDesempenoBanda | null;
  motivo: string | null;
}

export interface DistribucionBanda {
  bajo: number;
  medio: number;
  alto: number;
  total: number;
  pct: Record<string, number>;
}

export interface DistribucionResponse {
  ciclo_id: number;
  actual: DistribucionBanda;
  objetivo: Record<string, number>;
  desviacion: Record<string, number>;
}

// ── Tipos: self-service (empleado) ────────────────────────────────────────

export interface MisResultadoResponse {
  ciclo_id: number;
  ciclo_nombre: string | null;
  calificacion_desempeno: number | null;
  cumplimiento_metas: number | null;
  calificacion_360_norm: number | null;
  banda_desempeno: CicloDesempenoBanda | null;
}

// ── Gestión — ciclos ───────────────────────────────────────────────────────

export async function listCiclosDesempeno(estado?: CicloDesempenoEstado | null): Promise<CicloDesempenoResponse[]> {
  const sp = new URLSearchParams();
  if (estado) sp.set("estado", estado);
  const suffix = sp.toString() ? `?${sp}` : "";
  const res = await fetchWithAuth(`${BASE}/ciclos${suffix}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar los ciclos");
  return res.json() as Promise<CicloDesempenoResponse[]>;
}

export async function createCicloDesempeno(data: CicloDesempenoCreate): Promise<CicloDesempenoResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo crear el ciclo");
  return res.json() as Promise<CicloDesempenoResponse>;
}

export async function getCicloDesempeno(cicloId: number): Promise<CicloDesempenoResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar el ciclo");
  return res.json() as Promise<CicloDesempenoResponse>;
}

export async function updateCicloDesempeno(cicloId: number, data: CicloDesempenoUpdate): Promise<CicloDesempenoResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, "No se pudo actualizar el ciclo");
  return res.json() as Promise<CicloDesempenoResponse>;
}

export async function activarCicloDesempeno(cicloId: number): Promise<CicloDesempenoResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/activar`, { method: "POST" });
  if (!res.ok) await parseError(res, "No se pudo activar el ciclo");
  return res.json() as Promise<CicloDesempenoResponse>;
}

export async function cerrarCicloDesempeno(cicloId: number, forzar = false): Promise<CicloDesempenoResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/cerrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forzar }),
  });
  if (!res.ok) await parseError(res, "No se pudo cerrar el ciclo");
  return res.json() as Promise<CicloDesempenoResponse>;
}

/** Descarga el export Excel del ciclo (mismo patrón que `descargarCicloExcel` de Metas). */
export async function descargarCicloDesempenoExcel(
  cicloId: number,
  filenameFallback: string,
  areaId?: number,
): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/export/excel${qArea(areaId)}`);
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

// ── Gestión — resultados / 9-Box / potencial (scoping de equipo vía backend) ──

/** `?area_id=` recorta al área; el backend nunca amplía con esto el scope del jefe. */
function qArea(areaId?: number): string {
  return areaId ? `?area_id=${areaId}` : "";
}

export async function getResultadosCiclo(
  cicloId: number,
  areaId?: number,
): Promise<CicloDesempenoResultadoResponse[]> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/resultados${qArea(areaId)}`);
  if (!res.ok) await parseError(res, "No se pudieron cargar los resultados");
  return res.json() as Promise<CicloDesempenoResultadoResponse[]>;
}

export async function get9BoxCiclo(cicloId: number, areaId?: number): Promise<NueveBoxResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/9box${qArea(areaId)}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la matriz 9-Box");
  return res.json() as Promise<NueveBoxResponse>;
}

export async function setPotencialCiclo(
  cicloId: number,
  items: PotencialUpdateItem[],
): Promise<CicloDesempenoResultadoResponse[]> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/potencial`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items } satisfies PotencialUpdateRequest),
  });
  if (!res.ok) await parseError(res, "No se pudo guardar el potencial");
  return res.json() as Promise<CicloDesempenoResultadoResponse[]>;
}

// ── Calibración — ajuste de banda + distribución (solo RH global) ─────────

export async function calibrarCiclo(
  cicloId: number,
  items: BandaAjusteItem[],
): Promise<CicloDesempenoResultadoResponse[]> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/calibracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) await parseError(res, "No se pudo guardar la calibración");
  return res.json() as Promise<CicloDesempenoResultadoResponse[]>;
}

export async function getDistribucionCiclo(
  cicloId: number,
  areaId?: number,
): Promise<DistribucionResponse> {
  const res = await fetchWithAuth(`${BASE}/ciclos/${cicloId}/distribucion${qArea(areaId)}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la distribución");
  return res.json() as Promise<DistribucionResponse>;
}

// ── Self-service — mis resultados ─────────────────────────────────────────

export async function getMisResultadosDesempeno(): Promise<MisResultadoResponse[]> {
  const res = await fetchWithAuth(`${BASE}/mis-resultados`);
  if (!res.ok) await parseError(res, "No se pudieron cargar tus resultados");
  return res.json() as Promise<MisResultadoResponse[]>;
}
