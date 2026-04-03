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

export const CAL_NAV_BTN_CLASS =
  "inline-flex size-9 items-center justify-center rounded-lg text-leoni-blue transition-colors hover:bg-leoni-blue/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leoni-blue";

export type CalendarMonthNavOptions = {
  replaceableSelector: string;
  prevButtonId: string;
  nextButtonId: string;
  todayButtonId: string;
  initialYear: number;
  initialMonthIndex: number;
  render: (year: number, monthIndex: number) => string;
};

/**
 * Navegación mes anterior / siguiente / hoy; reemplaza el HTML del nodo indicado.
 */
export function bindCalendarMonthNavigation(
  container: HTMLElement,
  options: CalendarMonthNavOptions,
): void {
  const replaceable = (): HTMLElement | null => container.querySelector(options.replaceableSelector);

  let y = options.initialYear;
  let m = options.initialMonthIndex;

  const paint = (): void => {
    const el = replaceable();
    if (!el) return;
    el.innerHTML = options.render(y, m);
    wire();
  };

  const wire = (): void => {
    container.querySelector(`#${options.prevButtonId}`)?.addEventListener("click", () => {
      [y, m] = addCalendarMonths(y, m, -1);
      paint();
    });
    container.querySelector(`#${options.nextButtonId}`)?.addEventListener("click", () => {
      [y, m] = addCalendarMonths(y, m, 1);
      paint();
    });
    container.querySelector(`#${options.todayButtonId}`)?.addEventListener("click", () => {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth();
      paint();
    });
  };

  wire();
}
