import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./types.ts";

/** Contadores de personas-día por categoría (una solicitud suma 1 por día en su periodo). */
export type SolicitudPersonasDiaBucket = {
  vacaciones: number;
  home_office: number;
  con_goce: number;
  sin_goce: number;
};

export type SolicitudPersonasDiaSerie = {
  /** Etiquetas ISO `YYYY-MM-DD` ordenadas. */
  labels: readonly string[];
  vacaciones: readonly number[];
  home_office: readonly number[];
  con_goce: readonly number[];
  sin_goce: readonly number[];
  /** Suma de las cuatro series por día. */
  totales: readonly number[];
};

const TIPOS_GOCE = new Set<RhSolicitudTipoCodigo>([
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
]);

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
  return { vacaciones: 0, home_office: 0, con_goce: 0, sin_goce: 0 };
}

function bumpBucket(bucket: SolicitudPersonasDiaBucket, tipo: RhSolicitudTipoCodigo): void {
  if (tipo === "vacaciones") {
    bucket.vacaciones += 1;
    return;
  }
  if (tipo === "home_office") {
    bucket.home_office += 1;
    return;
  }
  if (tipo === "permiso_sin_goce_sueldo") {
    bucket.sin_goce += 1;
    return;
  }
  if (TIPOS_GOCE.has(tipo)) {
    bucket.con_goce += 1;
  }
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
    return {
      labels: dayLabels,
      vacaciones: dayLabels.map(() => 0),
      home_office: dayLabels.map(() => 0),
      con_goce: dayLabels.map(() => 0),
      sin_goce: dayLabels.map(() => 0),
      totales: dayLabels.map(() => 0),
    };
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

  const vacaciones: number[] = [];
  const home_office: number[] = [];
  const con_goce: number[] = [];
  const sin_goce: number[] = [];
  const totales: number[] = [];

  for (const iso of dayLabels) {
    const b = byDay.get(iso) ?? emptyBucket();
    vacaciones.push(b.vacaciones);
    home_office.push(b.home_office);
    con_goce.push(b.con_goce);
    sin_goce.push(b.sin_goce);
    totales.push(b.vacaciones + b.home_office + b.con_goce + b.sin_goce);
  }

  return { labels: dayLabels, vacaciones, home_office, con_goce, sin_goce, totales };
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
