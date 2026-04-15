import type { ComedorCalendarMonth, ComedorPanelState } from "../../comedor/rh/types.ts";
import { addComedorMonths, escapeComedorHtml, formatComedorMonthTitle, isoLocalDate } from "./comedorUiUtils.ts";

type CalendarCell = {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - firstWeekday);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      isoDate: isoLocalDate(d),
      dayNumber: d.getDate(),
      inCurrentMonth: d.getMonth() === monthIndex,
    });
  }
  return cells;
}

function dayTagClass(tone: "normal" | "dieta" | "critico"): string {
  if (tone === "dieta") return "bg-emerald-100 text-emerald-800";
  if (tone === "critico") return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-800";
}

function renderCalendarBody(month: ComedorCalendarMonth): string {
  const grid = buildMonthGrid(month.year, month.monthIndex);
  const today = isoLocalDate(new Date());
  const rows: string[] = [];
  for (let row = 0; row < 6; row += 1) {
    const chunk = grid.slice(row * 7, row * 7 + 7);
    rows.push(
      `<div class="grid grid-cols-7 gap-1">${chunk
        .map((cell) => {
          const metrics = month.dayMetrics[cell.isoDate];
          const tags = metrics?.tags.slice(0, 2) ?? [];
          const isToday = cell.isoDate === today;
          return `
            <div class="min-h-[5.75rem] rounded-lg border p-2 transition-colors ${
              cell.inCurrentMonth
                ? isToday
                  ? "border-leoni-blue bg-leoni-blue/5"
                  : "border-slate-100 bg-white hover:bg-slate-50"
                : "border-slate-100 bg-slate-50 text-slate-400"
            }">
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-semibold">${cell.dayNumber}</span>
                ${
                  metrics
                    ? `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">${metrics.reservas}</span>`
                    : ""
                }
              </div>
              <div class="mt-1 flex flex-wrap gap-1">
                ${tags
                  .map(
                    (tag) =>
                      `<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${dayTagClass(tag.tone)}">${escapeComedorHtml(tag.label)}</span>`,
                  )
                  .join("")}
              </div>
            </div>`;
        })
        .join("")}</div>`,
    );
  }

  const weekHeader = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    .map(
      (d) =>
        `<div class="rounded bg-slate-50 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">${d}</div>`,
    )
    .join("");

  return `
    <div class="mt-4 overflow-x-auto">
      <div class="min-w-[760px] space-y-1">
        <div class="grid grid-cols-7 gap-1">${weekHeader}</div>
        ${rows.join("")}
      </div>
    </div>`;
}

function renderLegend(month: ComedorCalendarMonth): string {
  return `
    <div class="mt-3 flex flex-wrap gap-3">
      ${month.legend
        .map(
          (item) => `
          <span class="inline-flex items-center gap-2 text-xs text-text-muted">
            <span class="size-2 rounded-full ${item.dotClass}" aria-hidden="true"></span>
            <span class="font-medium text-text-primary">${escapeComedorHtml(item.label)}</span>
          </span>`,
        )
        .join("")}
    </div>`;
}

function calendarNavigation(year: number, monthIndex: number): string {
  const prev = addComedorMonths(year, monthIndex, -1);
  const next = addComedorMonths(year, monthIndex, 1);
  const now = new Date();
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" data-comedor-cal-prev-year="${prev[0]}" data-comedor-cal-prev-month="${prev[1]}" class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
        <span class="sr-only">Mes anterior</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
      </button>
      <p class="min-w-44 text-center text-sm font-semibold text-text-primary">${escapeComedorHtml(formatComedorMonthTitle(year, monthIndex))}</p>
      <button type="button" data-comedor-cal-next-year="${next[0]}" data-comedor-cal-next-month="${next[1]}" class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
        <span class="sr-only">Mes siguiente</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
      </button>
      <button type="button" data-comedor-cal-today-year="${now.getFullYear()}" data-comedor-cal-today-month="${now.getMonth()}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
        Hoy
      </button>
    </div>`;
}

export function renderComedorCalendar(
  state: ComedorPanelState,
  month: ComedorCalendarMonth | null,
  errorMessage: string | null,
): string {
  if (state === "loading") {
    return `
      <section class="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div class="animate-pulse">
          <div class="h-6 w-52 rounded bg-slate-100"></div>
          <div class="mt-3 h-4 w-72 rounded bg-slate-100"></div>
          <div class="mt-5 grid grid-cols-7 gap-1">${"<div class='h-14 rounded bg-slate-100'></div>".repeat(7)}</div>
        </div>
      </section>`;
  }

  if (state === "error") {
    return `
      <section class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p class="font-semibold">No fue posible cargar el calendario.</p>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-retry-calendar class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }

  if (state === "empty" || !month) {
    return `
      <section class="rounded-2xl border border-border bg-white px-4 py-6 text-sm text-text-muted shadow-sm">
        No hay información de calendario para este mes.
      </section>`;
  }

  return `
    <section class="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-text-primary">Calendario mensual</h2>
          <p class="text-sm text-text-muted">Vista operativa de reservas por día</p>
          ${renderLegend(month)}
        </div>
        ${calendarNavigation(month.year, month.monthIndex)}
      </div>
      ${renderCalendarBody(month)}
    </section>`;
}
