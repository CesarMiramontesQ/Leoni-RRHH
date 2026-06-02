import type { ComedorWeekPlanner, ComedorWeekPlannerDay } from "./types.ts";

import { createEmptyMenuDiaDetalle } from "./menuDayDetalle.ts";
import {
  WEEK_PLANNER_DAY_KEYS,
  WEEK_PLANNER_DAY_LABELS,
} from "./weekPlannerDays.ts";

const WEEK_STORE = new Map<string, ComedorWeekPlanner>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toIso(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function mondayOf(date: Date): Date {
  const out = new Date(date);
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function formatShort(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatWeekLabel(start: Date, end: Date): string {
  const startLabel = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(start)
    .replace(".", "");
  const endLabel = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(end)
    .replace(".", "");
  return `${startLabel} - ${endLabel}`;
}

function cloneWeek(week: ComedorWeekPlanner): ComedorWeekPlanner {
  return {
    ...week,
    dias: week.dias.map((day) => ({ ...day })),
  };
}

function buildBlankWeek(weekStartIso: string): ComedorWeekPlanner {
  const start = fromIso(weekStartIso);
  const end = addDays(start, 6);
  const dias: ComedorWeekPlannerDay[] = WEEK_PLANNER_DAY_KEYS.map((key, index) => {
    const dt = addDays(start, index);
    return {
      key,
      label: WEEK_PLANNER_DAY_LABELS[key],
      fechaIso: toIso(dt),
      fechaCorta: formatShort(dt),
      menuNormal: "",
      menuDieta: "",
      detalle: createEmptyMenuDiaDetalle(),
      visibleEmpleados: false,
    };
  });
  return {
    weekStartIso,
    weekEndIso: toIso(end),
    weekLabel: formatWeekLabel(start, end),
    status: "borrador",
    dias,
  };
}

function seedPreviousWeek(): void {
  const currentMonday = mondayOf(new Date());
  const previousMonday = addDays(currentMonday, -7);
  const key = toIso(previousMonday);
  if (WEEK_STORE.has(key)) return;
  const seeded = buildBlankWeek(key);
  seeded.status = "publicado";
  seeded.dias = seeded.dias.map((day, idx) => ({
    ...day,
    menuNormal: ["Tinga de pollo", "Milanesa de res", "Enchiladas rojas", "Pollo al horno", "Carne guisada"][
      idx
    ]!,
    menuDieta: ["Ensalada con atún", "Pescado al vapor", "Pollo a la plancha", "Bowl de quinoa", "Wrap integral"][
      idx
    ]!,
    visibleEmpleados: true,
  }));
  WEEK_STORE.set(key, seeded);
}

seedPreviousWeek();

export function getCurrentWeekStartIso(): string {
  return toIso(mondayOf(new Date()));
}

export function shiftWeekStartIso(weekStartIso: string, deltaWeeks: number): string {
  const start = fromIso(weekStartIso);
  return toIso(addDays(start, deltaWeeks * 7));
}

export function createBlankWeekByStartIso(weekStartIso: string): ComedorWeekPlanner {
  return buildBlankWeek(weekStartIso);
}

export async function loadWeekPlannerMock(weekStartIso: string): Promise<ComedorWeekPlanner | null> {
  await delay(180);
  const week = WEEK_STORE.get(weekStartIso);
  return week ? cloneWeek(week) : null;
}

export async function duplicatePreviousWeekMock(
  weekStartIso: string,
): Promise<ComedorWeekPlanner | null> {
  await delay(220);
  const previousStartIso = shiftWeekStartIso(weekStartIso, -1);
  const prev = WEEK_STORE.get(previousStartIso);
  if (!prev) return null;
  const duplicated = buildBlankWeek(weekStartIso);
  duplicated.dias = duplicated.dias.map((day, index) => ({
    ...day,
    menuNormal: prev.dias[index]?.menuNormal ?? "",
    menuDieta: prev.dias[index]?.menuDieta ?? "",
    visibleEmpleados: prev.dias[index]?.visibleEmpleados ?? false,
  }));
  duplicated.status = "borrador";
  WEEK_STORE.set(weekStartIso, duplicated);
  return cloneWeek(duplicated);
}

export async function saveWeekPlannerDraftMock(
  week: ComedorWeekPlanner,
): Promise<ComedorWeekPlanner> {
  await delay(260);
  const next = cloneWeek(week);
  next.status = "borrador";
  WEEK_STORE.set(next.weekStartIso, next);
  return cloneWeek(next);
}

export async function publishWeekPlannerMock(
  week: ComedorWeekPlanner,
): Promise<ComedorWeekPlanner> {
  await delay(300);
  const next = cloneWeek(week);
  next.status = "publicado";
  WEEK_STORE.set(next.weekStartIso, next);
  return cloneWeek(next);
}

export async function clearWeekPlannerMock(weekStartIso: string): Promise<ComedorWeekPlanner> {
  await delay(160);
  const blank = buildBlankWeek(weekStartIso);
  WEEK_STORE.delete(weekStartIso);
  return blank;
}
