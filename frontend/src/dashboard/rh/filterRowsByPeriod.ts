import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import type { RhDashboardPeriodDays } from "./analyticsTypes.ts";

export function isoLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rango inclusivo [inicio, fin] en fechas ISO locales. */
export function periodRangeIso(days: RhDashboardPeriodDays | number): {
  fechaInicio: string;
  fechaFin: string;
} {
  const fin = isoLocalToday();
  const endDate = parseIsoLocal(fin);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (Math.max(1, days) - 1));
  return { fechaInicio: formatIsoLocal(startDate), fechaFin: fin };
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseUtcDay(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  return Date.UTC(y, m - 1, d);
}

/** Filtra solicitudes por `fecha_solicitud` dentro del rango (inclusive). */
export function filterSolicitudRowsByPeriod(
  rows: readonly RhSolicitudTablaFila[],
  fechaInicio: string,
  fechaFin: string,
): RhSolicitudTablaFila[] {
  const startUtc = parseUtcDay(fechaInicio);
  const endUtc = parseUtcDay(fechaFin);
  if (startUtc === null || endUtc === null) return [...rows];

  return rows.filter((row) => {
    const dayUtc = parseUtcDay(row.fecha_solicitud);
    if (dayUtc === null) return false;
    return dayUtc >= startUtc && dayUtc <= endUtc;
  });
}

export function countVacacionesUrgentes(
  rows: readonly RhSolicitudTablaFila[],
  todayIso = isoLocalToday(),
): number {
  const todayUtc = parseUtcDay(todayIso);
  if (todayUtc === null) return 0;
  return rows.filter((s) => {
    if (s.tipo !== "vacaciones" || s.estado !== "pending") return false;
    const startUtc = parseUtcDay(s.fecha_inicio);
    if (startUtc === null) return false;
    const diffDays = Math.floor((startUtc - todayUtc) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays < 7;
  }).length;
}

export function readStoredRhDashboardPeriod(): RhDashboardPeriodDays {
  try {
    const raw = sessionStorage.getItem("rh-dashboard-period");
    const n = Number(raw);
    if (n === 30 || n === 60 || n === 90) return n;
  } catch {
    /* ignore */
  }
  return 30;
}

export function storeRhDashboardPeriod(days: RhDashboardPeriodDays): void {
  try {
    sessionStorage.setItem("rh-dashboard-period", String(days));
  } catch {
    /* ignore */
  }
}

export type RhDashboardTendenciaAgrupacion = "dia" | "semana" | "mes";

/** Granularidad del eje X de tendencia de incidencias según filtro del dashboard. */
export function tendenciaAgrupacionForPeriod(days: RhDashboardPeriodDays): RhDashboardTendenciaAgrupacion {
  if (days === 30 || days === 60) return "semana";
  return "mes";
}

/** Granularidad del eje X de tendencia según rango de fechas (p. ej. Métricas). */
export function tendenciaAgrupacionForRango(
  fechaInicio: string,
  fechaFin: string,
): RhDashboardTendenciaAgrupacion {
  const fi = fechaInicio.trim();
  const ff = fechaFin.trim();
  if (!fi || !ff) return "mes";
  const days = listDiasEnRango(fi, ff).length;
  if (days <= 31) return "dia";
  if (days <= 90) return "semana";
  return "mes";
}

/** Días ISO inclusivos [fechaInicio, fechaFin]. */
export function listDiasEnRango(fechaInicio: string, fechaFin: string): string[] {
  const start = parseIsoLocal(fechaInicio);
  const end = parseIsoLocal(fechaFin);
  if (end < start) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(formatIsoLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function mondayOfWeekIso(iso: string): string {
  const d = parseIsoLocal(iso);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return formatIsoLocal(m);
}

/** Lunes de cada semana (YYYY-MM-DD) que intersecta el rango. */
export function listSemanasEnRango(fechaInicio: string, fechaFin: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of listDiasEnRango(fechaInicio, fechaFin)) {
    const mon = mondayOfWeekIso(day);
    if (!seen.has(mon)) {
      seen.add(mon);
      out.push(mon);
    }
  }
  return out;
}

export function listPeriodosEnRango(
  fechaInicio: string,
  fechaFin: string,
  agrupacion: RhDashboardTendenciaAgrupacion,
): string[] {
  if (agrupacion === "dia") return listDiasEnRango(fechaInicio, fechaFin);
  if (agrupacion === "semana") return listSemanasEnRango(fechaInicio, fechaFin);
  return listPeriodosMensualesEnRango(fechaInicio, fechaFin);
}

/** Meses calendario (YYYY-MM) que intersectan el rango inclusivo [fechaInicio, fechaFin]. */
export function listPeriodosMensualesEnRango(fechaInicio: string, fechaFin: string): string[] {
  const start = parseIsoLocal(fechaInicio);
  const end = parseIsoLocal(fechaFin);
  if (end < start) return [];

  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= endMonth) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}
