// frontend/src/api/historialObjetivo.ts
// Cliente HTTP del módulo Historial Objetivo (índice 0-100 + semáforo,
// combinando actas, faltas/retardos e incidencias). Tipos *Api alineados con
// `app/schemas/historial_objetivo.py`. Mismo patrón que `api/evaluacion360.ts`:
// todas las funciones usan `fetchWithAuth` y devuelven `null` ante error para
// no romper la UI (la pestaña lazy de la ficha decide qué mostrar).

import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/historial-objetivo";

// ── Tipos crudos del backend (ver `HistorialObjetivoEmpleadoOut` y afines) ───

export interface DesglosePorTipoApi {
  tipo: string;
  conteo: number;
  peso: number;
  penalizacion: number;
}

export interface DesgloseFuenteApi {
  fuente: string;
  penalizacion: number;
  tipos: DesglosePorTipoApi[];
}

export interface ResultadoIndiceApi {
  indice: number;
  semaforo: string;
  penalizacion_total: number;
  desglose: DesgloseFuenteApi[];
}

export interface HistorialObjetivoEmpleadoApi {
  empleado_id: number;
  resultado: ResultadoIndiceApi;
  bono_disponible: boolean;
}

export interface HistorialObjetivoRangoParams {
  fecha_inicio?: string;
  fecha_fin?: string;
}

function rangoQueryString(params?: HistorialObjetivoRangoParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.fecha_inicio) qs.set("fecha_inicio", params.fecha_inicio);
  if (params.fecha_fin) qs.set("fecha_fin", params.fecha_fin);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** `GET /empleados/{empleado_id}` — índice + desglose de un empleado (gestión, scoped). */
export async function getHistorialEmpleado(
  empleadoId: number,
  params?: HistorialObjetivoRangoParams,
): Promise<HistorialObjetivoEmpleadoApi | null> {
  const res = await fetchWithAuth(`${BASE}/empleados/${empleadoId}${rangoQueryString(params)}`);
  if (!res.ok) return null;
  return res.json();
}

/** `GET /mi-historial` — self-service, `empleado_id` siempre del token. */
export async function getMiHistorial(
  params?: HistorialObjetivoRangoParams,
): Promise<HistorialObjetivoEmpleadoApi | null> {
  const res = await fetchWithAuth(`${BASE}/mi-historial${rangoQueryString(params)}`);
  if (!res.ok) return null;
  return res.json();
}

export interface HistorialObjetivoEquipoItemApi {
  empleado_id: number;
  no_empleado: string | null;
  nombre: string | null;
  resultado: ResultadoIndiceApi;
}

export interface HistorialObjetivoEquipoApi {
  items: HistorialObjetivoEquipoItemApi[];
  bono_disponible: boolean;
}

/**
 * `GET /equipo` — ranking del equipo (peor índice primero). El jefe ve su
 * equipo; RH/director con el módulo otorgado ve el universo acotado
 * ("top offenders", ver Tarea 4). El backend exige rango cuando el scope
 * efectivo es universo, pero el router completa el default de últimos 12
 * meses — el llamante no necesita mandar fechas para evitar un 422.
 */
export async function getHistorialEquipo(
  params?: HistorialObjetivoRangoParams,
): Promise<HistorialObjetivoEquipoApi | null> {
  const res = await fetchWithAuth(`${BASE}/equipo${rangoQueryString(params)}`);
  if (!res.ok) return null;
  return res.json();
}

/** Descarga el export Excel del ranking de equipo (mismo patrón que `descargarCicloExcel` de Metas). */
export async function descargarHistorialEquipoExcel(
  params: HistorialObjetivoRangoParams,
  filenameFallback = "historial_objetivo_equipo.xlsx",
): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/equipo/export${rangoQueryString(params)}`);
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
