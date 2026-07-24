/**
 * Cliente API del módulo Operaciones (analítica de cobertura y polivalencia).
 * Types sincronizados con app/schemas/operaciones.py — no dupliques fuera de aquí.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/operaciones";

export class OperacionesApiError extends Error {
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
  throw new OperacionesApiError(detail, res.status);
}

export type Semaforo = "verde" | "ambar" | "rojo";
export type Severidad = "ok" | "punto_unico" | "hueco";

export interface AreaResumen {
  area_id: number;
  area_nombre: string;
  pol_area_pct: number;
  resiliencia_pct: number;
  n_criticas: number;
  n_empleados: number;
}

export interface CompetenciaCobertura {
  competencia_id: number;
  competencia_nombre: string;
  tipo_nombre: string;
  requieren: number;
  cubren: number;
  en_entrenamiento: number;
  cobertura_pct: number;
  semaforo: Semaforo;
  severidad: Severidad;
}

export interface PuestoCobertura {
  puesto_perfil_id: number;
  puesto_nombre: string;
  competencias: CompetenciaCobertura[];
}

export interface CandidatoCrossTrain {
  empleado_id: number;
  no_empleado: number | string;
  nombre: string;
  nivel_actual: number;
  nivel_requerido: number;
}

export interface Critica {
  competencia_id: number;
  competencia_nombre: string;
  severidad: Severidad;
  candidatos: CandidatoCrossTrain[];
}

export interface CoberturaArea {
  resumen: AreaResumen;
  competencias: CompetenciaCobertura[];
  puestos: PuestoCobertura[];
  criticas: Critica[];
}

export async function getAreas(): Promise<AreaResumen[]> {
  const res = await fetchWithAuth(`${BASE}/areas`);
  if (!res.ok) return parseError(res, "No se pudieron cargar las áreas");
  return res.json();
}

export async function getCoberturaArea(areaId: number): Promise<CoberturaArea> {
  const res = await fetchWithAuth(`${BASE}/areas/${areaId}/cobertura`);
  if (!res.ok) return parseError(res, "No se pudo cargar la cobertura del área");
  return res.json();
}

/** Descarga el .xlsx de cobertura del área (patrón `descargarCicloExcel` de metas). */
export async function descargarCoberturaAreaExcel(
  areaId: number,
  filenameFallback: string,
): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/areas/${areaId}/export`);
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
