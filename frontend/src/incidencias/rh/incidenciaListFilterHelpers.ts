import type { RhSolicitudFilterState } from "../../solicitudes/rh/types.ts";
import { emptyRhIncidenciaListFilters, type RhIncidenciaListFilters } from "./types.ts";

export const RH_INCIDENCIA_FILTER_FIELDS: (keyof RhIncidenciaListFilters)[] = [
  "tipo",
  "no_empleado",
  "nombre",
  "fecha_inicio",
  "fecha_fin",
  "area",
  "subarea",
  "estatus_id",
];

export function cloneRhIncidenciaListFilters(f: RhIncidenciaListFilters): RhIncidenciaListFilters {
  return { ...f };
}

/** Solo los criterios expuestos en la UI de filtros (resto en blanco para la petición). */
export function filtrosVisiblesAplicados(d: RhIncidenciaListFilters): RhIncidenciaListFilters {
  return {
    ...emptyRhIncidenciaListFilters(),
    tipo: d.tipo,
    no_empleado: d.no_empleado,
    nombre: d.nombre,
    fecha_inicio: d.fecha_inicio,
    fecha_fin: d.fecha_fin,
    area: d.area,
    subarea: d.subarea,
    estatus_id: d.estatus_id,
  };
}

/** Lee valores actuales del DOM (el date picker suele disparar `change`, no `input`). */
export function readRhIncidenciaFiltersFromDom(
  root: ParentNode,
  base: RhIncidenciaListFilters,
): RhIncidenciaListFilters {
  const next = { ...base };
  for (const field of RH_INCIDENCIA_FILTER_FIELDS) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-rh-inc-filter-field="${field}"]`,
    );
    if (el) next[field] = el.value;
  }
  return next;
}

/** Criterios de `#/metricas` (filtros globales de solicitudes → estadísticas de incidencias). */
export function incidenciasFiltersFromSolicitudesMetricas(
  sol: RhSolicitudFilterState,
): RhIncidenciaListFilters {
  return {
    ...emptyRhIncidenciaListFilters(),
    tipo: sol.tipo,
    area: sol.area_id.trim(),
    empleado_id: sol.empleado_id.trim(),
    nombre: sol.empleado_busqueda.trim(),
  };
}

export function fechasRangoIncidenciasListo(f: RhIncidenciaListFilters): boolean {
  const fi = f.fecha_inicio.trim();
  const ff = f.fecha_fin.trim();
  if (!fi || !ff) return false;
  return fi <= ff;
}
