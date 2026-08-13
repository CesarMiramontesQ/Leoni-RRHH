import { calcularDiasSolicitadosInclusive } from "./rhNewRequestDays.ts";
import type { RhSolicitudEmpleadoPersonalStats, RhSolicitudTablaFila } from "./types.ts";

/**
 * KPIs personales a partir del listado propio del colaborador y el saldo de vacaciones (API / mock).
 *
 * `diasVacacionesDisponibles` viaja como `null` cuando el saldo no se pudo leer; se
 * conserva así (no se degrada a 0) para que la tarjeta muestre «—» en vez de un cero
 * que se lee como «no te quedan días».
 */
export function computeEmpleadoPersonalSolicitudStats(
  rows: readonly RhSolicitudTablaFila[],
  diasVacacionesDisponibles: number | null,
): RhSolicitudEmpleadoPersonalStats {
  let diasTomados = 0;
  let solicitudesPendientes = 0;

  for (const r of rows) {
    const d = calcularDiasSolicitadosInclusive(r.fecha_inicio, r.fecha_fin);
    if (r.estado === "pending") solicitudesPendientes += 1;
    if (r.estado === "approved" || r.estado === "overridden") {
      if (r.tipo === "vacaciones") diasTomados += d;
    }
  }

  return {
    dias_disponibles:
      diasVacacionesDisponibles == null ? null : Math.max(0, Math.trunc(diasVacacionesDisponibles)),
    dias_tomados: diasTomados,
    solicitudes_pendientes: solicitudesPendientes,
  };
}
