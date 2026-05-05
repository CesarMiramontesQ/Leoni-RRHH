import type { ComedorCalendarMonth, ComedorPanelState } from "../../comedor/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
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

function dayTagClass(tone: "normal" | "dieta" | "critico" | "reserva" | "supervisor"): string {
  if (tone === "reserva") {
    return "border border-orange-200/90 bg-linear-to-br from-amber-50 to-orange-50 text-orange-900";
  }
  if (tone === "supervisor") {
    return "border border-violet-200/90 bg-linear-to-br from-violet-50 to-fuchsia-50 text-violet-900";
  }
  if (tone === "dieta") {
    return "border border-emerald-200/90 bg-linear-to-br from-emerald-50 to-teal-50 text-emerald-900";
  }
  if (tone === "critico") {
    return "border border-red-200/90 bg-linear-to-br from-red-50 to-rose-50 text-red-900";
  }
  return "border border-sky-200/90 bg-linear-to-br from-sky-50 to-blue-50 text-sky-900";
}

function renderCalendarBody(month: ComedorCalendarMonth): string {
  const grid = buildMonthGrid(month.year, month.monthIndex);
  const today = isoLocalDate(new Date());
  const rows: string[] = [];
  for (let row = 0; row < 6; row += 1) {
    const chunk = grid.slice(row * 7, row * 7 + 7);
    rows.push(
      `<div class="grid grid-cols-7 gap-1.5">${chunk
        .map((cell) => {
          const metrics = month.dayMetrics[cell.isoDate];
          const tags = metrics?.tags.slice(0, 6) ?? [];
          const isToday = cell.isoDate === today;
          const outMonth = !cell.inCurrentMonth;
          const cellBase =
            outMonth ?
              "rh-comedor-cal-day border-slate-200/70 bg-slate-50/90 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            : isToday ?
              "rh-comedor-cal-day border-[#1e40af]/35 bg-linear-to-br from-blue-50/95 via-white to-indigo-50/50 text-[#0f172a] shadow-[0_4px_14px_rgba(30,64,175,0.08)] ring-1 ring-blue-200/50"
            : "rh-comedor-cal-day border-slate-200/80 bg-white text-[#0f172a] hover:border-blue-200/80 hover:bg-slate-50/90";
          const dayNumClass = isToday
            ? "inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-linear-to-br from-[#1e40af] to-[#2563eb] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
            : "text-[11px] font-semibold text-[#334155]";
          return `
            <div class="min-h-[5.85rem] rounded-xl border p-2 ${cellBase}">
              <div class="flex items-center justify-between gap-1">
                <span class="${dayNumClass}">${cell.dayNumber}</span>
                ${
                  metrics
                    ? `<span class="rounded-full bg-slate-100/95 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200/80">${metrics.reservas}</span>`
                    : ""
                }
              </div>
              <div class="mt-1.5 flex flex-wrap gap-1">
                ${tags
                  .map(
                    (tag) =>
                      `<span class="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${dayTagClass(tag.tone)}">${escapeComedorHtml(tag.label)}</span>`,
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
        `<div class="rounded-lg bg-linear-to-b from-slate-50 to-slate-100/80 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/60">${d}</div>`,
    )
    .join("");

  return `
    <div class="mt-4 overflow-x-auto">
      <div class="min-w-[760px] space-y-1.5">
        <div class="grid grid-cols-7 gap-1.5">${weekHeader}</div>
        ${rows.join("")}
      </div>
    </div>`;
}

function renderLegend(month: ComedorCalendarMonth): string {
  return `
    <div class="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
      ${month.legend
        .map(
          (item) => `
          <span class="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-xs text-[#64748b] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <span class="size-2 shrink-0 rounded-full ${item.dotClass} ring-2 ring-white shadow-sm" aria-hidden="true"></span>
            <span class="font-medium text-[#0f172a]">${escapeComedorHtml(item.label)}</span>
          </span>`,
        )
        .join("")}
    </div>`;
}

function calendarNavigation(year: number, monthIndex: number): string {
  const prev = addComedorMonths(year, monthIndex, -1);
  const next = addComedorMonths(year, monthIndex, 1);
  const now = new Date();
  const btnNav =
    "rh-comedor-cal-nav-btn inline-flex size-10 items-center justify-center rounded-xl border border-[rgba(148,163,184,0.35)] bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.05)] hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.35)] hover:text-[#002147] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" data-comedor-cal-prev-year="${prev[0]}" data-comedor-cal-prev-month="${prev[1]}" class="${btnNav}" title="Mes anterior" aria-label="Ir al mes anterior">
        <span class="sr-only">Mes anterior</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
      </button>
      <p class="min-w-44 text-center text-sm font-semibold tracking-tight text-[#0f172a]">${escapeComedorHtml(formatComedorMonthTitle(year, monthIndex))}</p>
      <button type="button" data-comedor-cal-next-year="${next[0]}" data-comedor-cal-next-month="${next[1]}" class="${btnNav}" title="Mes siguiente" aria-label="Ir al mes siguiente">
        <span class="sr-only">Mes siguiente</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
      </button>
      <button type="button" data-comedor-cal-today-year="${now.getFullYear()}" data-comedor-cal-today-month="${now.getMonth()}" class="rh-comedor-cal-nav-btn inline-flex min-h-10 items-center rounded-xl border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.05)] hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.35)] hover:text-[#002147] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2" title="Ir al mes actual" aria-label="Ir al mes de hoy">
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
      <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
        <div class="animate-pulse">
          <div class="h-6 w-52 rounded-lg bg-slate-100"></div>
          <div class="mt-3 h-4 w-72 rounded-lg bg-slate-100"></div>
          <div class="mt-5 grid grid-cols-7 gap-1.5">${"<div class='h-16 rounded-xl bg-slate-100'></div>".repeat(7)}</div>
        </div>
      </section>`;
  }

  if (state === "error") {
    return `
      <section class="rounded-2xl border border-red-200/90 bg-white px-4 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <p class="font-semibold text-red-900">No fue posible cargar el calendario.</p>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-retry-calendar class="mt-3 inline-flex min-h-10 items-center rounded-[10px] border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2">
          Reintentar
        </button>
      </section>`;
  }

  if (state === "empty" || !month) {
    return `
      <section class="${RH_LISTADO_SURFACE} px-4 py-8 text-center text-sm text-[#64748b]">
        No hay información de calendario para este mes.
      </section>`;
  }

  return `
    <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
      <div class="flex flex-col gap-4 border-b border-slate-100/90 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Calendario mensual</h2>
          <p class="mt-0.5 text-sm text-[#64748b]">Vista operativa de reservas por día</p>
          ${renderLegend(month)}
        </div>
        ${calendarNavigation(month.year, month.monthIndex)}
      </div>
      ${renderCalendarBody(month)}
    </section>`;
}
