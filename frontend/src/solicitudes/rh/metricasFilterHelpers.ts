import { fechasOrdenValidas } from "./rhNewRequestDays.ts";
import type { RhSolicitudFilterState } from "./types.ts";

export const METRICAS_FILTER_DOM_FIELDS = [
  "no_empleado",
  "area_id",
  "fecha_inicio",
  "fecha_fin",
] as const;

/** Valida rango cuando ambas fechas están definidas. */
export function fechasRangoMetricasValido(fechaInicio: string, fechaFin: string): boolean {
  const fi = fechaInicio.trim();
  const ff = fechaFin.trim();
  if (!fi || !ff) return true;
  return fechasOrdenValidas(fi, ff);
}

export function readMetricasFiltersFromDom(
  root: ParentNode,
  base: RhSolicitudFilterState,
): RhSolicitudFilterState {
  const next = { ...base };
  for (const field of METRICAS_FILTER_DOM_FIELDS) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-rh-metricas-filter-field="${field}"]`,
    );
    if (el) next[field] = el.value;
  }
  return next;
}

/** Criterios visibles en `#/metricas` (sin supervisor, estado ni tipo). */
export function metricasFiltrosAplicados(f: RhSolicitudFilterState): RhSolicitudFilterState {
  return {
    ...f,
    tipo: "",
    estado: "",
    supervisor_id: "",
    empleado_id: "",
    empleado_busqueda: "",
    no_empleado: f.no_empleado.trim(),
    area_id: f.area_id.trim(),
    fecha_inicio: f.fecha_inicio.trim(),
    fecha_fin: f.fecha_fin.trim(),
  };
}

export function metricasFiltrosActivos(f: RhSolicitudFilterState): boolean {
  return (
    f.no_empleado.trim().length > 0 ||
    f.area_id.trim().length > 0 ||
    f.fecha_inicio.trim().length > 0 ||
    f.fecha_fin.trim().length > 0
  );
}
