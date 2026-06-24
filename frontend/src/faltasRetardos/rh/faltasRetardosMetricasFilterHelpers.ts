import { areaLabelFromFilterId } from "../../solicitudes/rh/buildRhSolicitudFilterOptions.ts";
import type { RhSolicitudFilterState } from "../../solicitudes/rh/types.ts";
import type { FaltasRetardosEstadisticasParams } from "../../api/faltasRetardos.ts";

/** Criterios de `#/metricas` → estadísticas de faltas y retardos. */
export function faltasRetardosFiltersFromSolicitudesMetricas(
  sol: RhSolicitudFilterState,
): FaltasRetardosEstadisticasParams {
  const areaLabel = areaLabelFromFilterId(sol.area_id.trim()) || sol.area_id.trim();
  return {
    busqueda: sol.no_empleado.trim() || undefined,
    area: areaLabel || undefined,
    fecha_inicio: sol.fecha_inicio.trim() || undefined,
    fecha_fin: sol.fecha_fin.trim() || undefined,
  };
}
