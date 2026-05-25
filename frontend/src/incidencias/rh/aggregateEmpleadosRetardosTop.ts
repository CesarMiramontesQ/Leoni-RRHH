import type { RhIncidenciasEstadisticasData } from "./types.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const EMPLEADOS_RETARDOS_TOP = 5;

function empleadoNombreCompleto(
  nombre: string | null | undefined,
  noEmpleado: string | null | undefined,
): string {
  const nom = (nombre ?? "").trim();
  if (nom) return nom;
  const no = (noEmpleado ?? "").trim();
  return no || "Sin nombre";
}

/** Top N empleados con más incidencias de retardo (respuesta de estadísticas filtrada por tipo). */
export function aggregateEmpleadosRetardosTop(
  empleados: RhIncidenciasEstadisticasData["empleados_con_mas_incidencias"],
  top = EMPLEADOS_RETARDOS_TOP,
): SolicitudRankingRow[] {
  return empleados
    .filter((e) => e.total > 0)
    .map((e) => ({
      label: empleadoNombreCompleto(e.nombre, e.no_empleado),
      total: e.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}
