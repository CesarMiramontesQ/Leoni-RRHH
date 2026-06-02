import type { ComedorWeekPlannerDayKey } from "./types.ts";

export const WEEK_PLANNER_DAY_KEYS: readonly ComedorWeekPlannerDayKey[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const WEEK_PLANNER_DAY_LABELS: Record<ComedorWeekPlannerDayKey, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

const DAY_KEY_SET = new Set<string>(WEEK_PLANNER_DAY_KEYS);

export function isComedorWeekPlannerDayKey(value: string | null | undefined): value is ComedorWeekPlannerDayKey {
  return value != null && DAY_KEY_SET.has(value);
}

export function normalizePlannerLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const HEADER_DAY_ALIASES: Record<string, ComedorWeekPlannerDayKey> = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miercoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sabado",
  sab: "sabado",
  domingo: "domingo",
  dom: "domingo",
};

export function dayKeyFromTemplateHeader(cell: string): ComedorWeekPlannerDayKey | null {
  const key = normalizePlannerLabel(cell);
  return HEADER_DAY_ALIASES[key] ?? null;
}

export function isWeekendPlannerDay(key: ComedorWeekPlannerDayKey): boolean {
  return key === "sabado" || key === "domingo";
}

export function countIncompletePlannerDays(
  dias: ReadonlyArray<{ key: ComedorWeekPlannerDayKey; menuNormal: string; menuDieta: string }>,
): number {
  return dias.filter((day) => isPlannerDayIncomplete(day)).length;
}

export function isPlannerDayIncomplete(day: {
  key: ComedorWeekPlannerDayKey;
  menuNormal: string;
  menuDieta: string;
}): boolean {
  if (!day.menuNormal.trim()) return true;
  if (isWeekendPlannerDay(day.key)) return false;
  return !day.menuDieta.trim();
}
