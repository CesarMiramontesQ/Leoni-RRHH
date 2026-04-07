import { calcularDiasSolicitadosInclusive } from "./rhNewRequestDays.ts";
import type { RhSolicitudEmpleadoPersonalStats, RhSolicitudTablaFila } from "./types.ts";

/**
 * KPIs personales a partir del listado propio del colaborador y el saldo de vacaciones (API / mock).
 */
export function computeEmpleadoPersonalSolicitudStats(
  rows: readonly RhSolicitudTablaFila[],
  diasVacacionesDisponibles: number,
): RhSolicitudEmpleadoPersonalStats {
  let diasTomados = 0;
  let diasHomeOfficeTomados = 0;
  let solicitudesPendientes = 0;

  for (const r of rows) {
    const d = calcularDiasSolicitadosInclusive(r.fecha_inicio, r.fecha_fin);
    if (r.estado === "pending") solicitudesPendientes += 1;
    if (r.estado === "approved" || r.estado === "overridden") {
      if (r.tipo === "vacaciones") diasTomados += d;
      if (r.tipo === "home_office") diasHomeOfficeTomados += d;
    }
  }

  return {
    dias_disponibles: Math.max(0, Math.trunc(diasVacacionesDisponibles)),
    dias_tomados: diasTomados,
    dias_home_office_tomados: diasHomeOfficeTomados,
    solicitudes_pendientes: solicitudesPendientes,
  };
}
