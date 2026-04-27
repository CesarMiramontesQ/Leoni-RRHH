/** Utilidades compartidas entre Calendario RH y calendario personal (empleado). */

export function formatCalendarMonthTitle(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function addCalendarMonths(year: number, monthIndex: number, delta: number): [number, number] {
  const dt = new Date(year, monthIndex + delta, 1);
  return [dt.getFullYear(), dt.getMonth()];
}

export type CalendarViewMode = "month" | "week";
export type CalendarWeekStart = 0 | 1;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoLocalDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yy, mm, dd] = iso.split("-").map(Number);
  const dt = new Date(yy!, (mm ?? 1) - 1, dd ?? 1);
  if (Number.isNaN(dt.getTime())) return null;
  if (isoLocalDate(dt) !== iso) return null;
  return dt;
}

export function resolveCalendarWeekStart(): CalendarWeekStart {
  const attr = document.documentElement.getAttribute("data-calendar-week-start");
  if (attr === "0" || attr === "sunday" || attr === "domingo") return 0;
  if (attr === "1" || attr === "monday" || attr === "lunes") return 1;
  return 1;
}

function weekdayByStart(d: Date, weekStartsOn: CalendarWeekStart): number {
  if (weekStartsOn === 0) return d.getDay();
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(date: Date, weekStartsOn: CalendarWeekStart): Date {
  const offset = weekdayByStart(date, weekStartsOn);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - offset);
  return start;
}

export function addCalendarWeeks(date: Date, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + delta * 7);
  return next;
}

export function getCalendarWeekVisibleRange(
  anchorDate: Date,
  weekStartsOn: CalendarWeekStart,
): CalendarVisibleRange {
  const start = startOfWeek(anchorDate, weekStartsOn);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startIso: isoLocalDate(start), endIso: isoLocalDate(end) };
}

export function getCalendarWeekDates(anchorDate: Date, weekStartsOn: CalendarWeekStart): Date[] {
  const start = startOfWeek(anchorDate, weekStartsOn);
  const out: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

export function getCalendarWeekdayLabels(weekStartsOn: CalendarWeekStart): string[] {
  const base = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  if (weekStartsOn === 0) return base;
  return [...base.slice(1), base[0]];
}

export function formatCalendarWeekTitle(anchorDate: Date, weekStartsOn: CalendarWeekStart): string {
  const days = getCalendarWeekDates(anchorDate, weekStartsOn);
  const first = days[0]!;
  const last = days[6]!;
  const firstMonth = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(first);
  const lastMonth = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(last);
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    const monthLabel = firstMonth.charAt(0).toUpperCase() + firstMonth.slice(1);
    return `${first.getDate()}-${last.getDate()} ${monthLabel} ${first.getFullYear()}`;
  }
  const firstLabel = `${first.getDate()} ${firstMonth}`;
  const lastLabel = `${last.getDate()} ${lastMonth}`;
  return `${firstLabel} - ${lastLabel} ${last.getFullYear()}`;
}

export type CalendarVisibleRange = {
  startIso: string;
  endIso: string;
};

/** Rango exacto visible en la grilla mensual (6 x 7, Lunes a Domingo). */
export function getCalendarMonthVisibleRange(
  year: number,
  monthIndex: number,
  weekStartsOn: CalendarWeekStart = 1,
): CalendarVisibleRange {
  const first = new Date(year, monthIndex, 1);
  const startOffset = weekdayByStart(first, weekStartsOn);
  const start = new Date(year, monthIndex, 1 - startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return {
    startIso: isoLocalDate(start),
    endIso: isoLocalDate(end),
  };
}

export const CAL_NAV_BTN_CLASS =
  "inline-flex size-9 items-center justify-center rounded-lg text-leoni-blue transition-colors hover:bg-leoni-blue/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leoni-blue";

export type CalendarMonthNavReason = "prev" | "next" | "today";

export type CalendarMonthNavChangeContext = {
  year: number;
  monthIndex: number;
  visibleRange: CalendarVisibleRange;
  reason: CalendarMonthNavReason;
  isCurrent: () => boolean;
  refresh: () => void;
};

export type CalendarMonthNavOptions = {
  replaceableSelector: string;
  prevButtonId: string;
  nextButtonId: string;
  todayButtonId: string;
  initialYear: number;
  initialMonthIndex: number;
  weekStartsOn?: CalendarWeekStart;
  render: (year: number, monthIndex: number) => string;
  onMonthChange?: (ctx: CalendarMonthNavChangeContext) => void | Promise<void>;
};

/**
 * Navegación mes anterior / siguiente / hoy; reemplaza el HTML del nodo indicado.
 */
export function bindCalendarMonthNavigation(
  container: HTMLElement,
  options: CalendarMonthNavOptions,
): void {
  const replaceable = (): HTMLElement | null => container.querySelector(options.replaceableSelector);
  let navigationVersion = 0;

  let y = options.initialYear;
  let m = options.initialMonthIndex;

  const paint = (): void => {
    const el = replaceable();
    if (!el) return;
    el.innerHTML = options.render(y, m);
    wire();
  };

  const notifyMonthChange = (reason: CalendarMonthNavReason): void => {
    if (!options.onMonthChange) return;
    const currentVersion = ++navigationVersion;
    const isCurrent = (): boolean => currentVersion === navigationVersion;
    const ctx: CalendarMonthNavChangeContext = {
      year: y,
      monthIndex: m,
      visibleRange: getCalendarMonthVisibleRange(y, m, options.weekStartsOn ?? resolveCalendarWeekStart()),
      reason,
      isCurrent,
      refresh: () => {
        if (!isCurrent()) return;
        paint();
      },
    };
    void options.onMonthChange(ctx);
  };

  const navigate = (delta: number, reason: CalendarMonthNavReason): void => {
    [y, m] = addCalendarMonths(y, m, delta);
    paint();
    notifyMonthChange(reason);
  };

  const wire = (): void => {
    container.querySelector(`#${options.prevButtonId}`)?.addEventListener("click", () => {
      navigate(-1, "prev");
    });
    container.querySelector(`#${options.nextButtonId}`)?.addEventListener("click", () => {
      navigate(1, "next");
    });
    container.querySelector(`#${options.todayButtonId}`)?.addEventListener("click", () => {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth();
      paint();
      notifyMonthChange("today");
    });
  };

  wire();
}
