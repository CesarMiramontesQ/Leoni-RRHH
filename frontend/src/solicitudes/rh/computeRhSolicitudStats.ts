import type { RhSolicitudRequestStats, RhSolicitudTablaFila } from "./types.ts";

function isoHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcula KPIs globales a partir del conjunto de filas (mock o respuesta completa de API).
 */
export function computeRhSolicitudStats(rows: readonly RhSolicitudTablaFila[]): RhSolicitudRequestStats {
  const hoy = isoHoyLocal();
  let pendientes = 0;
  let vacaciones = 0;
  let aprobadas_hoy = 0;

  for (const r of rows) {
    if (r.estado === "pending") pendientes += 1;
    if (r.tipo === "vacaciones") vacaciones += 1;
    if (
      (r.estado === "approved" || r.estado === "overridden") &&
      r.fecha_aprobacion === hoy
    ) {
      aprobadas_hoy += 1;
    }
  }

  return { pendientes, vacaciones, aprobadas_hoy };
}
