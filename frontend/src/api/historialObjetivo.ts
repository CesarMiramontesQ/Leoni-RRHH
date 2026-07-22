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
