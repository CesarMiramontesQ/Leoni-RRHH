import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const EMPLEADOS_RETARDOS_TOP = 5;

export type EmpleadoRetardoRankingSource = {
  nombre: string | null | undefined;
  no_empleado: string | null | undefined;
  total: number;
};

function empleadoNombreCompleto(
  nombre: string | null | undefined,
  noEmpleado: string | null | undefined,
): string {
  const nom = (nombre ?? "").trim();
  if (nom) return nom;
  const no = (noEmpleado ?? "").trim();
  return no || "Sin nombre";
}

/** Top N empleados con más retardos (estadísticas filtradas por tipo retardo). */
export function aggregateEmpleadosRetardosTop(
  empleados: readonly EmpleadoRetardoRankingSource[],
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
