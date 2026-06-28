import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const EMPLEADOS_RETARDOS_TOP = 5;

export type EmpleadoRetardoRankingSource = {
  empleado_id?: number | null;
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

/** Top N empleados por cantidad de eventos (p. ej. retardos o faltas injustificadas). */
export function aggregateEmpleadosRetardosTop(
  empleados: readonly EmpleadoRetardoRankingSource[],
  top = EMPLEADOS_RETARDOS_TOP,
): SolicitudRankingRow[] {
  return empleados
    .filter((e) => e.total > 0)
    .sort((a, b) => {
      const byTotal = b.total - a.total;
      if (byTotal !== 0) return byTotal;
      const byName = empleadoNombreCompleto(a.nombre, a.no_empleado).localeCompare(
        empleadoNombreCompleto(b.nombre, b.no_empleado),
        "es",
      );
      if (byName !== 0) return byName;
      return (a.empleado_id ?? 0) - (b.empleado_id ?? 0);
    })
    .slice(0, top)
    .map((e) => ({
      label: empleadoNombreCompleto(e.nombre, e.no_empleado),
      total: e.total,
    }));
}
