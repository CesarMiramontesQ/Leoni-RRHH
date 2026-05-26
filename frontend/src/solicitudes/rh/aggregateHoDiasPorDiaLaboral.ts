import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila } from "./types.ts";

export const HO_DIAS_LABORALES_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
] as const;

export type HoDiasPorDiaLaboralSerie = {
  labels: readonly string[];
  valores: readonly number[];
  /** Días laborales (lun–vie) sumados al expandir periodos; no equivale al # de solicitudes. */
  total: number;
  solicitudes_ho: number;
  dia_mas_solicitado: string | null;
  dia_mas_solicitado_total: number;
  dia_mas_solicitado_pct: number;
};

const ESTADOS_APROBADOS = new Set<RhSolicitudEstadoCodigo>(["approved", "overridden"]);

function parseLocalDate(iso: string): Date | null {
  const p = iso.trim().split("-");
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** `getDay()`: 0=domingo … 1=lunes … 5=viernes. */
function indiceDiaLaboral(date: Date): number | null {
  const dow = date.getDay();
  if (dow >= 1 && dow <= 5) return dow - 1;
  return null;
}

function filasHomeOfficeParaGrafica(
  rows: readonly RhSolicitudTablaFila[],
  estadoFiltroActivo: string,
): RhSolicitudTablaFila[] {
  const ho = rows.filter((r) => r.tipo === "home_office");
  if (estadoFiltroActivo.trim() !== "") return ho;
  return ho.filter((r) => ESTADOS_APROBADOS.has(r.estado));
}

/**
 * Expande cada solicitud HO por día natural entre inicio y fin;
 * cuenta solo lunes–viernes.
 */
/** Solicitudes HO que alimentan la gráfica (mismo criterio de estado que `aggregateHoDiasPorDiaLaboral`). */
export function countSolicitudesHoParaGrafica(
  rows: readonly RhSolicitudTablaFila[],
  opts: { estadoFiltroActivo?: string } = {},
): number {
  return filasHomeOfficeParaGrafica(rows, opts.estadoFiltroActivo ?? "").length;
}

export function aggregateHoDiasPorDiaLaboral(
  rows: readonly RhSolicitudTablaFila[],
  opts: { estadoFiltroActivo?: string } = {},
): HoDiasPorDiaLaboralSerie {
  const estadoFiltroActivo = opts.estadoFiltroActivo ?? "";
  const counts = [0, 0, 0, 0, 0];
  const filasHo = filasHomeOfficeParaGrafica(rows, estadoFiltroActivo);

  for (const row of filasHo) {
    const start = parseLocalDate(row.fecha_inicio);
    const end = parseLocalDate(row.fecha_fin);
    if (!start || !end || end.getTime() < start.getTime()) continue;

    for (let cur = start; cur.getTime() <= end.getTime(); cur = addDaysLocal(cur, 1)) {
      const idx = indiceDiaLaboral(cur);
      if (idx == null) continue;
      counts[idx] += 1;
    }
  }

  const total = counts.reduce((s, n) => s + n, 0);
  let maxIdx = -1;
  let maxVal = 0;
  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] > maxVal) {
      maxVal = counts[i];
      maxIdx = i;
    }
  }

  const dia_mas_solicitado = maxIdx >= 0 && maxVal > 0 ? HO_DIAS_LABORALES_LABELS[maxIdx] : null;
  /** Concentración: día con más HO / total días HO × 100 */
  const dia_mas_solicitado_pct =
    total > 0 && maxVal > 0 ? Math.round((1000 * maxVal) / total) / 10 : 0;

  return {
    labels: HO_DIAS_LABORALES_LABELS,
    valores: counts,
    total,
    solicitudes_ho: filasHo.length,
    dia_mas_solicitado,
    dia_mas_solicitado_total: maxVal,
    dia_mas_solicitado_pct,
  };
}

export function hoDiasPorDiaLaboralTieneDatos(serie: HoDiasPorDiaLaboralSerie): boolean {
  return serie.total > 0;
}
