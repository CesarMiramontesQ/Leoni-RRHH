import type { RhIncidenciaResumenKpi, RhIncidenciaTablaFila } from "./types.ts";

/** KPIs globales sobre el dataset completo (sin filtros de tabla). */
export function computeRhIncidenciaStats(rows: readonly RhIncidenciaTablaFila[]): RhIncidenciaResumenKpi {
  let abiertas = 0;
  let en_investigacion = 0;
  let resueltas = 0;
  let criticas = 0;

  for (const r of rows) {
    if (r.estado === "abierto") abiertas += 1;
    if (r.estado === "en_investigacion") en_investigacion += 1;
    if (r.estado === "cerrado") resueltas += 1;
    if (r.prioridad === "critica") criticas += 1;
  }

  return { abiertas, en_investigacion, resueltas, criticas };
}
