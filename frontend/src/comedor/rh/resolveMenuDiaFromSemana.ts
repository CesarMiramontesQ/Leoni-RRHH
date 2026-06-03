import type { MenuSemanalApiItem } from "../../api/comedor.ts";
import type { ComedorMenuDiaDetalle } from "./menuDayDetalle.ts";
import { createEmptyMenuDiaDetalle, parseMenuDiaDetalleFromApi } from "./menuDayDetalle.ts";
import type { ComedorWeekPlannerDayKey } from "./types.ts";
import { buildWeekRangeFromStartIso, mondayIsoFromDateIso } from "./weekRange.ts";
import { isWeekendPlannerDay } from "./weekPlannerDays.ts";

export type ComedorMenuDelDia = {
  fechaIso: string;
  dayKey: ComedorWeekPlannerDayKey;
  dayLabel: string;
  fechaDisplay: string;
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
};

function normalizePlannerToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function parseDetalleFromApi(value: unknown): ComedorMenuDiaDetalle | null {
  const detalle = parseMenuDiaDetalleFromApi(value);
  const hasAny = Object.values(detalle).some((items) => items.length > 0);
  return hasAny ? detalle : null;
}

export function menuDelDiaHasContent(menu: ComedorMenuDelDia): boolean {
  if (menu.menuNormal.trim() || menu.menuDieta.trim()) return true;
  return Object.values(menu.detalle).some((items) => items.length > 0);
}

/** Resuelve el menú de un día concreto a partir de filas de `GET /api/v1/comedor/menu`. */
export function resolveMenuDiaFromSemanaApi(
  items: readonly MenuSemanalApiItem[],
  fechaIso: string,
): ComedorMenuDelDia | null {
  const weekStartIso = mondayIsoFromDateIso(fechaIso);
  const week = buildWeekRangeFromStartIso(weekStartIso);
  const dayMeta = week.days.find((day) => day.fechaIso === fechaIso);
  if (!dayMeta) return null;

  const rowsForDay = items.filter((row) => normalizePlannerToken(row.dia) === dayMeta.key);
  if (rowsForDay.length === 0) return null;

  const normal = rowsForDay.find((row) => normalizePlannerToken(row.tipo) === "normal");
  const dieta = rowsForDay.find((row) => normalizePlannerToken(row.tipo) === "dieta");
  const detalleFromNormal = parseDetalleFromApi(normal?.detalle);
  const detalleFromAny =
    detalleFromNormal ??
    rowsForDay.map((row) => parseDetalleFromApi(row.detalle)).find((parsed) => parsed != null) ??
    createEmptyMenuDiaDetalle();

  return {
    fechaIso,
    dayKey: dayMeta.key,
    dayLabel: dayMeta.label,
    fechaDisplay: dayMeta.fechaDisplay,
    menuNormal: normal?.descripcion?.trim() ?? "",
    menuDieta: isWeekendPlannerDay(dayMeta.key) ? "" : (dieta?.descripcion?.trim() ?? ""),
    detalle: detalleFromNormal ?? detalleFromAny,
  };
}
