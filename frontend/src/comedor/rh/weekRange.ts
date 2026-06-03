import type { ComedorWeekPlannerDayKey } from "./types.ts";
import { WEEK_PLANNER_DAY_KEYS, WEEK_PLANNER_DAY_LABELS } from "./weekPlannerDays.ts";

export type WeekRange = {
  weekStartIso: string;
  weekEndIso: string;
  weekLabelLong: string;
  days: Array<{ key: ComedorWeekPlannerDayKey; fechaIso: string; label: string; fechaDisplay: string }>;
};

function dateToIso(value: Date): string {
  const y = String(value.getFullYear()).padStart(4, "0");
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value);
  out.setDate(out.getDate() + days);
  return out;
}

export function mondayOfDate(value: Date): Date {
  const out = new Date(value);
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function mondayIsoFromDateIso(dateIso: string): string {
  return dateToIso(mondayOfDate(isoToDate(dateIso)));
}

function formatDayMonth(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

/** Rango legible: «Lunes 04/03/2026 al Domingo 10/03/2026». */
export function formatWeekRangeLabel(weekStartIso: string): string {
  const start = isoToDate(weekStartIso);
  const end = addDays(start, 6);
  const startLabel = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(start)
    .replace(/^\w/, (c) => c.toUpperCase());
  const endLabel = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(end)
    .replace(/^\w/, (c) => c.toUpperCase());
  return `${startLabel} al ${endLabel}`;
}

export function buildWeekRangeFromStartIso(weekStartIso: string): WeekRange {
  const start = isoToDate(weekStartIso);
  const end = addDays(start, 6);
  const days = WEEK_PLANNER_DAY_KEYS.map((key, index) => {
    const dt = addDays(start, index);
    return {
      key,
      fechaIso: dateToIso(dt),
      label: WEEK_PLANNER_DAY_LABELS[key],
      fechaDisplay: formatDayMonth(dt),
    };
  });
  return {
    weekStartIso,
    weekEndIso: dateToIso(end),
    weekLabelLong: formatWeekRangeLabel(weekStartIso),
    days,
  };
}

export function buildWeekRangeFromPickerDate(dateIso: string | null): WeekRange | null {
  if (!dateIso?.trim()) return null;
  return buildWeekRangeFromStartIso(mondayIsoFromDateIso(dateIso.trim()));
}

/** Valor para `<input type="week">` a partir del lunes ISO (yyyy-mm-dd). */
export function weekInputFromIso(weekStartIso: string): string {
  const dt = new Date(`${weekStartIso}T00:00:00`);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day + 4);
  const firstThursday = new Date(dt.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 4);
  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / 604800000);
  return `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Lunes ISO (yyyy-mm-dd) a partir del valor de `<input type="week">` (yyyy-Www). */
export function isoFromWeekInput(value: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? "", 10);
  const week = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const mondayWeek1 = new Date(year, 0, 4 - jan4Day);
  mondayWeek1.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  return dateToIso(mondayWeek1);
}

export function buildWeekRangeFromWeekInput(weekInput: string | null): WeekRange | null {
  if (!weekInput?.trim()) return null;
  const weekStartIso = isoFromWeekInput(weekInput.trim());
  if (!weekStartIso) return null;
  return buildWeekRangeFromStartIso(weekStartIso);
}
