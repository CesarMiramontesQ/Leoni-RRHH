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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export type CalendarVisibleRange = {
  startIso: string;
  endIso: string;
};

/** Rango exacto visible en la grilla mensual (6 x 7, Lunes a Domingo). */
export function getCalendarMonthVisibleRange(year: number, monthIndex: number): CalendarVisibleRange {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
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
      visibleRange: getCalendarMonthVisibleRange(y, m),
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
