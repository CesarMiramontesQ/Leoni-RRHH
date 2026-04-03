/**
 * Grilla mensual Lunes→Domingo (42 celdas) para el calendario RH.
 */

export type RhCalendarGridCell = {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha local YYYY-MM-DD (calendario RH, comparar “hoy”). */
export function rhIsoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function rhIsoFromYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Lunes = 0 … Domingo = 6 */
export function rhMondayWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * 6 filas × 7 columnas, empezando el lunes anterior o igual al día 1 del mes.
 */
export function buildRhCalendarMonthGrid(year: number, monthIndex: number): RhCalendarGridCell[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = rhMondayWeekday(first);
  const startDay = 1 - startOffset;

  const cells: RhCalendarGridCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = new Date(year, monthIndex, startDay + i);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const d = dt.getDate();
    cells.push({
      isoDate: rhIsoFromYmd(y, m, d),
      dayNumber: d,
      inCurrentMonth: m === monthIndex,
    });
  }
  return cells;
}
