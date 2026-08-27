/**
 * Date picker con popover propio.
 * Con `blockWeekends`, sábados y domingos se muestran desvanecidos y no se pueden elegir.
 */

import {
  addCalendarMonths,
  formatCalendarMonthTitle,
  getCalendarWeekdayLabels,
  isoLocalDate,
  parseIsoLocalDate,
} from "../components/dashboard/calendarShared.ts";
import { buildRhCalendarMonthGrid } from "../dashboard/rh/calendarMonthGrid.ts";
import { escapeHtml } from "./uiUtils.ts";

const TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-left text-sm shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25 disabled:cursor-not-allowed disabled:bg-slate-50/90 disabled:text-slate-400";

const TRIGGER_INVALID = "border-red-400/90 focus:border-red-500 focus:ring-red-500/20";

const PANEL_BASE =
  "absolute z-40 mt-1.5 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200/90 bg-white p-3 shadow-lg shadow-slate-900/12";

const PANEL_ALIGN_START = `${PANEL_BASE} left-0`;
const PANEL_ALIGN_END = `${PANEL_BASE} right-0`;

const NAV_BTN =
  "inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40";

export function bindAbortableEvent(
  target: EventTarget,
  type: string,
  listener: EventListener,
  signal: AbortSignal,
): void {
  target.addEventListener(type, listener, { signal });
}

function formatDisplay(iso: string): string {
  const d = parseIsoLocalDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isWeekendIso(iso: string): boolean {
  const d = parseIsoLocalDate(iso);
  if (!d) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function monthFromValue(value: string): [number, number] {
  const d = parseIsoLocalDate(value) ?? new Date();
  return [d.getFullYear(), d.getMonth()];
}

export type WorkdayDatePickerHtmlOpts = {
  inputId: string;
  /** `name` del input oculto (p. ej. para FormData). */
  inputName?: string;
  value: string;
  disabled?: boolean;
  blockWeekends?: boolean;
  invalid?: boolean;
  placeholder?: string;
  describedBy?: string;
  /** Ancla el popover al inicio (izq) o al final (der) del campo. */
  align?: "start" | "end";
};

export function buildWorkdayDatePickerHtml(opts: WorkdayDatePickerHtmlOpts): string {
  const display = formatDisplay(opts.value);
  const placeholder = opts.placeholder ?? "Seleccionar fecha";
  const triggerCls = `${TRIGGER} ${opts.invalid ? TRIGGER_INVALID : ""}`.trim();
  const panelCls = opts.align === "end" ? PANEL_ALIGN_END : PANEL_ALIGN_START;
  const nameAttr = opts.inputName ? ` name="${escapeHtml(opts.inputName)}"` : "";
  const triggerId = `${opts.inputId}-trigger`;
  const panelId = `${opts.inputId}-panel`;
  return `
    <div
      class="relative"
      data-workday-date-picker
      data-block-weekends="${opts.blockWeekends === true ? "true" : "false"}"
    >
      <input type="hidden" id="${escapeHtml(opts.inputId)}"${nameAttr} value="${escapeHtml(opts.value)}" />
      <button
        type="button"
        id="${escapeHtml(triggerId)}"
        data-wd-trigger
        class="${triggerCls}"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls="${escapeHtml(panelId)}"
        aria-invalid="${opts.invalid ? "true" : "false"}"
        ${opts.describedBy ? `aria-describedby="${escapeHtml(opts.describedBy)}"` : ""}
        ${opts.disabled ? "disabled" : ""}
      >
        <span data-wd-label class="${display ? "font-medium text-slate-900" : "text-slate-400/80"}">${
          display ? escapeHtml(display) : escapeHtml(placeholder)
        }</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 text-slate-400" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18h-10.5A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clip-rule="evenodd"/>
        </svg>
      </button>
      <div id="${escapeHtml(panelId)}" data-wd-panel class="${panelCls} hidden" role="dialog" aria-label="Calendario" hidden></div>
    </div>
  `;
}

/** Actualiza la etiqueta visible a partir del valor del input oculto. */
export function syncWorkdayDatePickerDisplay(root: HTMLElement): void {
  const hidden = root.querySelector("input[type='hidden']") as HTMLInputElement | null;
  const labelEl = root.querySelector("[data-wd-label]") as HTMLElement | null;
  if (!hidden || !labelEl) return;
  const display = formatDisplay(hidden.value);
  if (display) {
    labelEl.textContent = display;
    labelEl.className = "font-medium text-slate-900";
  } else {
    labelEl.textContent = "Seleccionar fecha";
    labelEl.className = "text-slate-400/80";
  }
}

/** Marca visualmente el trigger como inválido (bordes rojos + aria). */
export function setWorkdayDatePickerInvalid(root: HTMLElement, invalid: boolean): void {
  const trigger = root.querySelector("[data-wd-trigger]") as HTMLButtonElement | null;
  if (!trigger) return;
  trigger.setAttribute("aria-invalid", invalid ? "true" : "false");
  const base = TRIGGER.trim();
  trigger.className = invalid ? `${base} ${TRIGGER_INVALID}` : base;
}

export type WorkdayDatePickerMonthHtmlOpts = {
  year: number;
  monthIndex: number;
  selected: string;
  blockWeekends: boolean;
  blockedDates?: ReadonlySet<string>;
  loadedMonths?: ReadonlySet<string>;
  /** ISO yyyy-mm-dd: los días anteriores quedan no disponibles. */
  minDate?: string | null;
  /** ISO → descripción. Festivos de la planta: no seleccionables, con color propio. */
  festivos?: ReadonlyMap<string, string>;
};

export function buildWorkdayDatePickerMonthHtml(
  opts: WorkdayDatePickerMonthHtmlOpts,
): string {
  const { year, monthIndex, selected, blockWeekends } = opts;
  const blockedDates = opts.blockedDates ?? new Set<string>();
  const festivos = opts.festivos ?? new Map<string, string>();
  const loadedMonths = opts.loadedMonths;
  const minDate = opts.minDate || null;
  const labels = getCalendarWeekdayLabels(1);
  const cells = buildRhCalendarMonthGrid(year, monthIndex, 1);
  const today = isoLocalDate(new Date());
  const title = formatCalendarMonthTitle(year, monthIndex);

  const head = labels
    .map((l) => {
      const weekendLabel = l === "Sáb" || l === "Dom";
      const faded = blockWeekends && weekendLabel;
      return `<span class="text-center text-[10px] font-semibold uppercase tracking-wide ${
        faded ? "text-slate-300" : "text-slate-400"
      }">${escapeHtml(l)}</span>`;
    })
    .join("");

  const days = cells
    .map((cell) => {
      const weekend = isWeekendIso(cell.isoDate);
      const festivo = festivos.get(cell.isoDate) ?? null;
      const descanso = festivo == null && blockedDates.has(cell.isoDate);
      const pending = loadedMonths != null && !loadedMonths.has(cell.isoDate.slice(0, 7));
      const beforeMin = minDate != null && cell.isoDate < minDate;
      const blocked =
        pending || festivo != null || descanso || beforeMin || (blockWeekends && weekend);
      const selectedDay = cell.isoDate === selected;
      const isToday = cell.isoDate === today;
      const muted = !cell.inCurrentMonth;

      let cls =
        "flex size-8 items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40";
      if (pending) {
        cls += " cursor-not-allowed text-slate-300/70 opacity-45";
      } else if (festivo != null) {
        cls +=
          " cursor-not-allowed bg-rose-100 font-medium text-rose-900 ring-1 ring-inset ring-rose-200/90 line-through decoration-rose-500/70";
      } else if (descanso) {
        cls +=
          " cursor-not-allowed bg-amber-100 font-medium text-amber-900 ring-1 ring-inset ring-amber-200/90 line-through decoration-amber-500/70";
      } else if (beforeMin || (blockWeekends && weekend)) {
        cls += " cursor-not-allowed text-slate-300/70 opacity-45";
      } else if (selectedDay) {
        cls += " bg-leoni-blue font-semibold text-white shadow-sm";
      } else if (isToday) {
        cls += " font-semibold text-leoni-blue ring-1 ring-leoni-blue/30 hover:bg-leoni-blue/10";
      } else if (muted) {
        cls += " text-slate-300 hover:bg-slate-50 hover:text-slate-500";
      } else {
        cls += " text-slate-700 hover:bg-slate-100";
      }

      return `
        <button
          type="button"
          data-wd-day="${escapeHtml(cell.isoDate)}"
          class="${cls}"
          ${
            blocked
              ? `disabled aria-disabled="true" tabindex="-1" aria-label="${escapeHtml(
                  `${cell.isoDate} — ${
                    pending
                      ? "Consultando descansos"
                      : festivo != null
                        ? `Festivo: ${festivo}`
                        : descanso
                          ? "Descanso"
                          : "No disponible"
                  }`,
                )}"${
                  pending
                    ? ' title="Consultando descansos"'
                    : festivo != null
                      ? ` title="${escapeHtml(`Festivo: ${festivo}`)}"`
                      : descanso
                        ? ' title="Descanso"'
                        : ""
                }`
              : `aria-label="${escapeHtml(cell.isoDate)}"`
          }
          ${selectedDay ? 'aria-current="date"' : ""}
        >${cell.dayNumber}</button>`;
    })
    .join("");

  const showDescansoLegend = blockedDates.size > 0 || loadedMonths != null;
  const showFestivoLegend = festivos.size > 0;

  return `
    <div class="flex items-center justify-between gap-2 pb-2">
      <button type="button" data-wd-prev class="${NAV_BTN}" aria-label="Mes anterior">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/></svg>
      </button>
      <p data-wd-title class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</p>
      <button type="button" data-wd-next class="${NAV_BTN}" aria-label="Mes siguiente">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <div class="grid grid-cols-7 gap-0.5 pb-1">${head}</div>
    <div class="grid grid-cols-7 gap-0.5">${days}</div>
    ${
      showDescansoLegend
        ? `<p class="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-amber-900/80"><span class="mr-1.5 inline-block size-2.5 rounded-sm bg-amber-200 ring-1 ring-amber-300/80 align-middle" aria-hidden="true"></span>Días en ámbar = descanso del empleado (no seleccionables).</p>`
        : ""
    }
    ${
      showFestivoLegend
        ? `<p class="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-rose-900/80"><span class="mr-1.5 inline-block size-2.5 rounded-sm bg-rose-200 ring-1 ring-rose-300/80 align-middle" aria-hidden="true"></span>Días en rosa = festivo de la planta (no seleccionables; no descuentan vacaciones).</p>`
        : ""
    }
    ${
      blockWeekends
        ? `<p class="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">Sábados y domingos no disponibles para personal administrativo.</p>`
        : ""
    }
  `;
}

export type BindWorkdayDatePickerOpts = {
  onChange: (iso: string) => void;
  blockedDates?: Iterable<string>;
  loadedMonths?: Iterable<string>;
  /** ISO yyyy-mm-dd: los días anteriores no se pueden elegir. */
  minDate?: string | null;
  festivos?: ReadonlyMap<string, string>;
  onMonthChange?: (year: number, monthIndex: number) => void | Promise<void>;
  signal?: AbortSignal;
};

export type WorkdayDatePickerHandle = {
  close: () => void;
  destroy: () => void;
  setBlockedDates: (dates: Iterable<string>) => void;
  /** `null` quita la restricción: vuelven a ser elegibles los meses sin cargar. */
  setLoadedMonths: (months: Iterable<string> | null) => void;
  setFestivos: (festivos: ReadonlyMap<string, string>) => void;
  repaint: () => void;
};

/**
 * Enlaza un picker ya presente en el DOM (`[data-workday-date-picker]`).
 * Devuelve función para cerrar el panel (p. ej. al destruir el modal).
 */
export function bindWorkdayDatePicker(
  root: HTMLElement,
  opts: BindWorkdayDatePickerOpts,
): WorkdayDatePickerHandle {
  const trigger = root.querySelector("[data-wd-trigger]") as HTMLButtonElement | null;
  const panel = root.querySelector("[data-wd-panel]") as HTMLElement | null;
  const hidden = root.querySelector("input[type='hidden']") as HTMLInputElement | null;
  const labelEl = root.querySelector("[data-wd-label]") as HTMLElement | null;
  if (!trigger || !panel || !hidden) {
    return {
      close: () => {},
      destroy: () => {},
      setBlockedDates: () => {},
      setLoadedMonths: () => {},
      setFestivos: () => {},
      repaint: () => {},
    };
  }

  let open = false;
  const ownAbort = opts.signal == null ? new AbortController() : null;
  const bindingSignal = opts.signal ?? ownAbort!.signal;
  let [viewY, viewM] = monthFromValue(hidden.value);
  let blockedDates = new Set(opts.blockedDates ?? []);
  let loadedMonths = opts.loadedMonths == null ? undefined : new Set(opts.loadedMonths);
  let festivos: ReadonlyMap<string, string> = opts.festivos ?? new Map();
  const minDate = opts.minDate || null;

  const blockWeekends = () => root.getAttribute("data-block-weekends") === "true";

  function syncLabel(): void {
    if (!labelEl) return;
    const display = formatDisplay(hidden!.value);
    if (display) {
      labelEl.textContent = display;
      labelEl.className = "font-medium text-slate-900";
    } else {
      labelEl.textContent = "Seleccionar fecha";
      labelEl.className = "text-slate-400/80";
    }
  }

  function paintPanel(): void {
    panel!.innerHTML = buildWorkdayDatePickerMonthHtml({
      year: viewY,
      monthIndex: viewM,
      selected: hidden!.value,
      blockWeekends: blockWeekends(),
      blockedDates,
      loadedMonths,
      minDate,
      festivos,
    });
  }

  function notifyMonthChange(): void {
    void opts.onMonthChange?.(viewY, viewM);
  }

  function setOpen(next: boolean): void {
    open = next;
    panel!.classList.toggle("hidden", !next);
    panel!.hidden = !next;
    trigger!.setAttribute("aria-expanded", next ? "true" : "false");
    if (next) {
      [viewY, viewM] = monthFromValue(hidden!.value);
      paintPanel();
      notifyMonthChange();
    }
  }

  function close(): void {
    if (open) setOpen(false);
  }

  trigger.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      if (trigger.disabled) return;
      setOpen(!open);
    },
    { signal: bindingSignal },
  );

  panel.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-wd-prev]")) {
        e.preventDefault();
        [viewY, viewM] = addCalendarMonths(viewY, viewM, -1);
        paintPanel();
        notifyMonthChange();
        return;
      }
      if (t.closest("[data-wd-next]")) {
        e.preventDefault();
        [viewY, viewM] = addCalendarMonths(viewY, viewM, 1);
        paintPanel();
        notifyMonthChange();
        return;
      }
      const dayBtn = t.closest("[data-wd-day]") as HTMLElement | null;
      if (!dayBtn) return;
      e.preventDefault();
      if (dayBtn.getAttribute("aria-disabled") === "true") return;
      const iso = dayBtn.getAttribute("data-wd-day") ?? "";
      if (!iso) return;
      if (blockWeekends() && isWeekendIso(iso)) return;
      if (minDate != null && iso < minDate) return;
      hidden!.value = iso;
      syncLabel();
      setOpen(false);
      opts.onChange(iso);
    },
    { signal: bindingSignal },
  );

  bindAbortableEvent(
    document,
    "mousedown",
    ((e: MouseEvent) => {
      if (!open) return;
      if (root.contains(e.target as Node)) return;
      close();
    }) as EventListener,
    bindingSignal,
  );

  bindAbortableEvent(
    document,
    "keydown",
    ((e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }) as EventListener,
    bindingSignal,
  );

  return {
    close,
    destroy: () => {
      close();
      ownAbort?.abort();
    },
    setBlockedDates: (dates) => {
      blockedDates = new Set(dates);
      if (open) paintPanel();
    },
    setLoadedMonths: (months) => {
      loadedMonths = months == null ? undefined : new Set(months);
      if (open) paintPanel();
    },
    setFestivos: (next) => {
      festivos = next;
      if (open) paintPanel();
    },
    repaint: () => {
      if (open) paintPanel();
    },
  };
}
