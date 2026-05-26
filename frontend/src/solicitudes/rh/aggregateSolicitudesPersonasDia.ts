import {
  emptyConteoPorTipo,
  labelSolicitudTipo,
  RH_SOLICITUD_TIPOS_ORDEN,
} from "./solicitudTipoDisplay.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./types.ts";

export type SolicitudPersonasDiaSerieTipo = {
  codigo: RhSolicitudTipoCodigo;
  label: string;
  values: readonly number[];
};

/** Contadores de personas-día por tipo (una solicitud suma 1 por día en su periodo). */
export type SolicitudPersonasDiaBucket = Record<RhSolicitudTipoCodigo, number>;

export type SolicitudPersonasDiaSerie = {
  /** Etiquetas ISO `YYYY-MM-DD` ordenadas. */
  labels: readonly string[];
  /** Una serie por tipo de solicitud. */
  series: readonly SolicitudPersonasDiaSerieTipo[];
  /** Suma de todas las series por día. */
  totales: readonly number[];
};

/** Solo solicitudes ya aprobadas (incluye override como aprobación). */
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

function isoFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Primer y último día del mes calendario (local). */
export function getCalendarMonthRange(year: number, monthIndex: number): { startIso: string; endIso: string } {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { startIso: isoFromLocalDate(start), endIso: isoFromLocalDate(end) };
}

export function getCurrentCalendarMonthRange(now = new Date()): { startIso: string; endIso: string } {
  return getCalendarMonthRange(now.getFullYear(), now.getMonth());
}

function emptyBucket(): SolicitudPersonasDiaBucket {
  return emptyConteoPorTipo();
}

function bumpBucket(bucket: SolicitudPersonasDiaBucket, tipo: RhSolicitudTipoCodigo): void {
  bucket[tipo] += 1;
}

function listIsoDaysInclusive(startIso: string, endIso: string): string[] {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  if (!start || !end || end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  for (let cur = start; cur.getTime() <= end.getTime(); cur = addDaysLocal(cur, 1)) {
    out.push(isoFromLocalDate(cur));
  }
  return out;
}

function emptySerie(dayLabels: string[]): SolicitudPersonasDiaSerie {
  const zeros = dayLabels.map(() => 0);
  return {
    labels: dayLabels,
    series: RH_SOLICITUD_TIPOS_ORDEN.map((codigo) => ({
      codigo,
      label: labelSolicitudTipo(codigo),
      values: zeros,
    })),
    totales: zeros,
  };
}

/**
 * Expande periodos de solicitud a personas-día por fecha (días naturales inclusivos).
 * Solo estados `approved` y `overridden`.
 */
export function aggregateSolicitudesPersonasDia(
  rows: readonly RhSolicitudTablaFila[],
  rangeStartIso: string,
  rangeEndIso: string,
): SolicitudPersonasDiaSerie {
  const dayLabels = listIsoDaysInclusive(rangeStartIso, rangeEndIso);
  const byDay = new Map<string, SolicitudPersonasDiaBucket>();
  for (const iso of dayLabels) {
    byDay.set(iso, emptyBucket());
  }

  const rangeStart = parseLocalDate(rangeStartIso);
  const rangeEnd = parseLocalDate(rangeEndIso);
  if (!rangeStart || !rangeEnd) {
    return emptySerie(dayLabels);
  }

  for (const row of rows) {
    if (!ESTADOS_APROBADOS.has(row.estado)) continue;

    const rowStart = parseLocalDate(row.fecha_inicio);
    const rowEnd = parseLocalDate(row.fecha_fin);
    if (!rowStart || !rowEnd || rowEnd.getTime() < rowStart.getTime()) continue;

    const clipStart = rowStart.getTime() < rangeStart.getTime() ? rangeStart : rowStart;
    const clipEnd = rowEnd.getTime() > rangeEnd.getTime() ? rangeEnd : rowEnd;
    if (clipEnd.getTime() < clipStart.getTime()) continue;

    for (let cur = clipStart; cur.getTime() <= clipEnd.getTime(); cur = addDaysLocal(cur, 1)) {
      const iso = isoFromLocalDate(cur);
      const bucket = byDay.get(iso);
      if (!bucket) continue;
      bumpBucket(bucket, row.tipo);
    }
  }

  const seriesValues = Object.fromEntries(
    RH_SOLICITUD_TIPOS_ORDEN.map((t) => [t, [] as number[]]),
  ) as Record<RhSolicitudTipoCodigo, number[]>;
  const totales: number[] = [];

  for (const iso of dayLabels) {
    const b = byDay.get(iso) ?? emptyBucket();
    let dayTotal = 0;
    for (const t of RH_SOLICITUD_TIPOS_ORDEN) {
      const n = b[t];
      seriesValues[t].push(n);
      dayTotal += n;
    }
    totales.push(dayTotal);
  }

  return {
    labels: dayLabels,
    series: RH_SOLICITUD_TIPOS_ORDEN.map((codigo) => ({
      codigo,
      label: labelSolicitudTipo(codigo),
      values: seriesValues[codigo],
    })),
    totales,
  };
}

/** Etiqueta corta para eje X (`5 may`). */
export function formatPersonasDiaChartLabel(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  const raw = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(d);
  return raw.replace(/\./g, "").replace(/ de /g, " ");
}

/** Título del periodo del gráfico (`Mayo 2026`). */
export function formatPersonasDiaChartPeriodTitle(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
