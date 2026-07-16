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
  /** Ancla el popover al inicio (izq) o al final (der) del campo. */
  align?: "start" | "end";
};

export function buildWorkdayDatePickerHtml(opts: WorkdayDatePickerHtmlOpts): string {
  const display = formatDisplay(opts.value);
  const placeholder = opts.placeholder ?? "Seleccionar fecha";
  const triggerCls = `${TRIGGER} ${opts.invalid ? TRIGGER_INVALID : ""}`.trim();
  const panelCls = opts.align === "end" ? PANEL_ALIGN_END : PANEL_ALIGN_START;
  const nameAttr = opts.inputName ? ` name="${escapeHtml(opts.inputName)}"` : "";
  return `
    <div
      class="relative"
      data-workday-date-picker
      data-block-weekends="${opts.blockWeekends === true ? "true" : "false"}"
    >
      <input type="hidden" id="${escapeHtml(opts.inputId)}"${nameAttr} value="${escapeHtml(opts.value)}" />
      <button
        type="button"
        data-wd-trigger
        class="${triggerCls}"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-invalid="${opts.invalid ? "true" : "false"}"
        ${opts.disabled ? "disabled" : ""}
      >
        <span data-wd-label class="${display ? "font-medium text-slate-900" : "text-slate-400/80"}">${
          display ? escapeHtml(display) : escapeHtml(placeholder)
        }</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 text-slate-400" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18h-10.5A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clip-rule="evenodd"/>
        </svg>
      </button>
      <div data-wd-panel class="${panelCls} hidden" role="dialog" aria-label="Calendario" hidden></div>
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

function renderPanelHtml(
  year: number,
  monthIndex: number,
  selected: string,
  blockWeekends: boolean,
): string {
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
      const blocked = blockWeekends && weekend;
      const selectedDay = cell.isoDate === selected;
      const isToday = cell.isoDate === today;
      const muted = !cell.inCurrentMonth;

      let cls =
        "flex size-8 items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40";
      if (blocked) {
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
          ${blocked ? 'aria-disabled="true" tabindex="-1"' : `aria-label="${escapeHtml(cell.isoDate)}"`}
          ${selectedDay ? 'aria-current="date"' : ""}
        >${cell.dayNumber}</button>`;
    })
    .join("");

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
      blockWeekends
        ? `<p class="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">Sábados y domingos no disponibles para personal administrativo.</p>`
        : ""
    }
  `;
}

export type BindWorkdayDatePickerOpts = {
  onChange: (iso: string) => void;
  signal?: AbortSignal;
};

/**
 * Enlaza un picker ya presente en el DOM (`[data-workday-date-picker]`).
 * Devuelve función para cerrar el panel (p. ej. al destruir el modal).
 */
export function bindWorkdayDatePicker(
  root: HTMLElement,
  opts: BindWorkdayDatePickerOpts,
): () => void {
  const trigger = root.querySelector("[data-wd-trigger]") as HTMLButtonElement | null;
  const panel = root.querySelector("[data-wd-panel]") as HTMLElement | null;
  const hidden = root.querySelector("input[type='hidden']") as HTMLInputElement | null;
  const labelEl = root.querySelector("[data-wd-label]") as HTMLElement | null;
  if (!trigger || !panel || !hidden) return () => {};

  let open = false;
  let [viewY, viewM] = monthFromValue(hidden.value);

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
    panel!.innerHTML = renderPanelHtml(viewY, viewM, hidden!.value, blockWeekends());
  }

  function setOpen(next: boolean): void {
    open = next;
    panel!.classList.toggle("hidden", !next);
    panel!.hidden = !next;
    trigger!.setAttribute("aria-expanded", next ? "true" : "false");
    if (next) {
      [viewY, viewM] = monthFromValue(hidden!.value);
      paintPanel();
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
    { signal: opts.signal },
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
        return;
      }
      if (t.closest("[data-wd-next]")) {
        e.preventDefault();
        [viewY, viewM] = addCalendarMonths(viewY, viewM, 1);
        paintPanel();
        return;
      }
      const dayBtn = t.closest("[data-wd-day]") as HTMLElement | null;
      if (!dayBtn) return;
      e.preventDefault();
      if (dayBtn.getAttribute("aria-disabled") === "true") return;
      const iso = dayBtn.getAttribute("data-wd-day") ?? "";
      if (!iso) return;
      if (blockWeekends() && isWeekendIso(iso)) return;
      hidden!.value = iso;
      syncLabel();
      setOpen(false);
      opts.onChange(iso);
    },
    { signal: opts.signal },
  );

  document.addEventListener(
    "mousedown",
    (e) => {
      if (!open) return;
      if (root.contains(e.target as Node)) return;
      close();
    },
    { signal: opts.signal },
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    { signal: opts.signal },
  );

  return close;
}
