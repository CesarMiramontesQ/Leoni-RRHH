/** Sección inferior del dashboard RH (calendario). Ya no se monta en `#/`; conservada para reutilización futura. */
import { escapeHtml } from "../vista360/html.ts";
import {
  addCalendarMonths,
  addCalendarWeeks,
  CAL_NAV_BTN_CLASS,
  formatCalendarWeekTitle,
  formatCalendarMonthTitle,
  getCalendarWeekDates,
  getCalendarWeekdayLabels,
  isoLocalDate,
  parseIsoLocalDate,
  resolveCalendarWeekStart,
  type CalendarViewMode,
  type CalendarWeekStart,
} from "./calendarShared.ts";
import { buildRhCalendarMonthGrid, rhIsoLocalDate } from "../../dashboard/rh/calendarMonthGrid.ts";
import type {
  RhCalendarDayLine,
  RhCalendarDayMetrics,
  RhLowerSectionPayload,
  RhPriorityAlertIcon,
  RhUpcomingEventIcon,
} from "../../dashboard/rh/lowerSectionTypes.ts";
function formatMetric(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX").format(Math.trunc(n));
}

function alertChipIcon(icon: RhPriorityAlertIcon): string {
  const c =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-orange-600" aria-hidden="true"';
  switch (icon) {
    case "document":
      return `<svg ${c}><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V12M10.5 2.25h5.25a1.5 1.5 0 0 1 1.5 1.5v5.25a1.5 1.5 0 0 1-1.5 1.5H10.5m0-8.25v8.25" /></svg>`;
    case "calendar":
      return `<svg ${c}><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
    case "bell":
      return `<svg ${c}><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>`;
    default:
      return "";
  }
}

function eventIcon(icon: RhUpcomingEventIcon): string {
  const wrap = "size-9 shrink-0 rounded-lg p-1.5";
  switch (icon) {
    case "umbrella":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="${wrap} bg-orange-500/10 text-orange-600" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m-6.53-7.11A5.5 5.5 0 0 1 12 7.5v0a5.5 5.5 0 0 1 6.53 6.39 6 6 0 0 1-1.06 2.34m-11 0A6 6 0 0 1 5.47 13.9" /></svg>`;
    case "utensils":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="${wrap} bg-blue-500/10 text-blue-700" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 18 9.75a8.25 8.25 0 0 1-8.25 8.25H12M12 18h.008v.008H12V18Zm-4.5-1.5v-9a4.5 4.5 0 0 1 9 0v9" /></svg>`;
    case "users":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="${wrap} bg-violet-500/10 text-violet-700" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>`;
    default:
      return "";
  }
}

function lineClasses(line: RhCalendarDayLine): string {
  const base = "rh-cal-badge max-w-full truncate px-2 py-0.5 text-[10px] font-semibold leading-snug md:text-[11px]";
  if (line.danger) {
    return line.solid ? `${base} rh-cal-badge--danger rh-cal-badge--danger-solid` : `${base} rh-cal-badge--danger`;
  }
  switch (line.kind) {
    case "normal":
      return line.solid ? `${base} rh-cal-badge--normal rh-cal-badge--solid` : `${base} rh-cal-badge--normal-soft`;
    case "dieta":
      return line.solid ? `${base} rh-cal-badge--dieta rh-cal-badge--solid` : `${base} rh-cal-badge--dieta-soft`;
    case "vacaciones":
      return `${base} rh-cal-badge--vacaciones`;
    case "ho":
      return `${base} rh-cal-badge--ho`;
    case "sin_goce":
      return `${base} rh-cal-badge--sin-goce`;
    case "goce_sueldo":
      return `${base} rh-cal-badge--goce-sueldo`;
    default:
      return `${base} rh-cal-badge--muted`;
  }
}

/** Indicadores compactos en móvil cuando no caben todas las pills. */
function renderMobileMetricDots(metrics: RhCalendarDayMetrics | undefined): string {
  if (!metrics) return "";
  const hasLines = Boolean(metrics.lines?.length);
  const hasFlags = Boolean(metrics.showWarning || metrics.showAttention);
  if (!hasLines && !hasFlags) return "";

  const kinds = new Set((metrics.lines ?? []).map((l) => l.kind));
  const dots: string[] = [];
  if (kinds.has("normal")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-leoni-blue" title="Normal"></span>');
  }
  if (kinds.has("dieta")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-leoni-green" title="Dieta"></span>');
  }
  if (kinds.has("vacaciones")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-500" title="Vacaciones"></span>');
  }
  if (kinds.has("ho")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-violet-600" title="Home Office"></span>');
  }
  if (kinds.has("sin_goce")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-slate-600" title="Sin goce"></span>');
  }
  if (kinds.has("goce_sueldo")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-sky-600" title="Con goce"></span>');
  }
  if (metrics.showWarning) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-400" title="Alerta"></span>');
  }
  if (metrics.showAttention) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-red-500" title="Atención"></span>');
  }
  if (dots.length === 0) return "";

  return `<div class="mt-0.5 flex flex-wrap gap-1 md:hidden" aria-hidden="true">${dots.join("")}</div>`;
}

function renderCalendarDayCell(
  iso: string,
  dayNumber: number,
  inMonth: boolean,
  metrics: RhCalendarDayMetrics | undefined,
  isToday: boolean,
  isSelected: boolean,
): string {
  const hasMetrics =
    Boolean(metrics?.lines?.length) || Boolean(metrics?.showWarning) || Boolean(metrics?.showAttention);

  const cellPieces: string[] = [
    "rh-cal-cell group relative flex min-h-[4.5rem] flex-col rounded-lg p-2 outline-none md:min-h-[6.5rem] md:p-3",
    "border transition-[background,box-shadow,border-color,transform] duration-150 ease-out",
  ];

  if (!inMonth) {
    cellPieces.push("rh-cal-cell--out");
  } else if (isSelected) {
    cellPieces.push("rh-cal-cell--selected z-[1]");
  } else if (isToday) {
    cellPieces.push("rh-cal-cell--today");
  } else {
    cellPieces.push("rh-cal-cell--default");
  }

  const cellBase = cellPieces.join(" ");

  const dayNumWrap =
    isSelected && inMonth
      ? `<span class="rh-cal-cell__daynum rh-cal-cell__daynum--selected">${dayNumber}</span>`
      : isToday && inMonth
        ? `<span class="rh-cal-cell__daynum rh-cal-cell__daynum--today">${dayNumber}</span>`
        : `<span class="rh-cal-cell__daynum ${inMonth ? "rh-cal-cell__daynum--plain" : "rh-cal-cell__daynum--muted"}">${dayNumber}</span>`;

  const warn = metrics?.showWarning
    ? `<span class="text-orange-600" title="Alerta" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </span>`
    : "";

  const attn = metrics?.showAttention
    ? `<span class="text-red-600" title="Atención" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </span>`
    : "";

  const topRowSep = hasMetrics ? "border-b border-border/30 pb-2 mb-2" : "";

  const linesDesktop =
    metrics?.lines?.length ?
      `<div class="hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden md:flex">
          ${metrics.lines
            .map((ln) => `<span class="truncate ${lineClasses(ln)}">${escapeHtml(ln.text)}</span>`)
            .join("")}
        </div>`
    : "";

  const dotsMobile = hasMetrics ? renderMobileMetricDots(metrics) : "";

  return `
    <div
      role="gridcell"
      class="${cellBase}"
      data-rh-cal-day="${escapeHtml(iso)}"
      aria-label="${escapeHtml(iso)}"
      aria-selected="${isSelected ? "true" : "false"}"
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-1 ${topRowSep}">
        ${dayNumWrap}
        <div class="flex shrink-0 items-center gap-0.5">${warn}${attn}</div>
      </div>
      ${linesDesktop}
      ${dotsMobile}
    </div>`;
}

function dayMetricsMap(payload: RhLowerSectionPayload | null): Record<string, RhCalendarDayMetrics> {
  return payload?.calendar.dayMetrics ?? {};
}

function selectedIso(payload: RhLowerSectionPayload | null): string | null {
  return payload?.calendar.selectedIsoDate ?? null;
}

/** Contenido interno del calendario (mes + leyenda + grilla), sustituible al navegar. */
export function renderRhCalendarReplaceable(
  year: number,
  monthIndex: number,
  payload: RhLowerSectionPayload | null,
  viewMode: CalendarViewMode = "month",
  weekAnchorIso: string | null = null,
  weekStartsOn: CalendarWeekStart = 1,
): string {
  const anchorDate = parseIsoLocalDate(weekAnchorIso) ?? new Date(year, monthIndex, 1);
  const title = escapeHtml(
    viewMode === "week"
      ? formatCalendarWeekTitle(anchorDate, weekStartsOn)
      : formatCalendarMonthTitle(year, monthIndex),
  );
  const grid = buildRhCalendarMonthGrid(year, monthIndex, weekStartsOn);
  const map = dayMetricsMap(payload);
  const sel = selectedIso(payload);
  const todayIso = rhIsoLocalDate(new Date());

  const rows: string[] = [];
  if (viewMode === "month") {
    for (let r = 0; r < 6; r += 1) {
      const slice = grid.slice(r * 7, r * 7 + 7);
      rows.push(
        `<div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${slice
          .map((cell) =>
            renderCalendarDayCell(
              cell.isoDate,
              cell.dayNumber,
              cell.inCurrentMonth,
              map[cell.isoDate],
              cell.isoDate === todayIso,
              Boolean(sel && cell.isoDate === sel),
            ),
          )
          .join("")}</div>`,
      );
    }
  } else {
    const weekDates = getCalendarWeekDates(anchorDate, weekStartsOn);
    rows.push(
      `<div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${weekDates
        .map((d) => {
          const iso = isoLocalDate(d);
          return renderCalendarDayCell(
            iso,
            d.getDate(),
            true,
            map[iso],
            iso === todayIso,
            Boolean(sel && iso === sel),
          );
        })
        .join("")}</div>`,
    );
  }

  const legend = `
    <div class="rh-cal-legend flex flex-wrap gap-x-6 gap-y-1 text-xs leading-tight">
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--normal" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Normal</span>
      </span>
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--dieta" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Dieta</span>
      </span>
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--vacaciones" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Vacaciones</span>
      </span>
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--ho" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Home Office</span>
      </span>
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--sin-goce" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Permiso sin goce</span>
      </span>
      <span class="rh-cal-legend__item">
        <span class="rh-cal-legend__swatch rh-cal-legend__swatch--goce-sueldo" aria-hidden="true"></span>
        <span class="rh-cal-legend__label">Permiso con goce</span>
      </span>
    </div>`;

  const weekHeader = getCalendarWeekdayLabels(weekStartsOn)
    .map(
      (d) =>
        `<div role="columnheader" class="rh-cal-colhead py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">${d}</div>`,
    )
    .join("");

  const weeklyPlanner = (() => {
    if (viewMode !== "week") return "";
    const weekDates = getCalendarWeekDates(anchorDate, weekStartsOn);
    const dayColumns = weekDates
      .map((d) => {
        const iso = isoLocalDate(d);
        const isToday = iso === todayIso;
        const dayName = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(d);
        const metrics = map[iso];
        const lineItems = metrics?.lines ?? [];
        const entries =
          lineItems.length > 0
            ? lineItems
                .map((ln) => `<span class="truncate ${lineClasses(ln)}">${escapeHtml(ln.text)}</span>`)
                .join("")
            : `<span class="text-xs text-text-muted">Sin registros</span>`;
        const flags = `${metrics?.showWarning ? '<span class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">Alerta</span>' : ""}${metrics?.showAttention ? '<span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Atención</span>' : ""}`;
        return `<article class="rh-cal-week-planner-day rounded-xl border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(dayName)}</span>
            <span class="${isToday ? "rh-cal-week-planner-day__date rh-cal-week-planner-day__date--today" : "rh-cal-week-planner-day__date"}">${d.getDate()}</span>
          </div>
          <div class="mb-2 flex flex-wrap gap-1">${flags}</div>
          <div class="flex flex-col gap-1.5">${entries}</div>
        </article>`;
      })
      .join("");
    return `
      <div class="grid grid-cols-1 gap-3 md:grid-cols-7">
        ${dayColumns}
      </div>`;
  })();

  return `
    <header class="rh-cal-card-header px-4 pt-5 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-base font-semibold text-text-primary">Calendario RH</h2>
        <div class="rh-cal-toolbar flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div class="rh-cal-seg" role="group" aria-label="Vista del calendario">
            <button
              type="button"
              id="rh-cal-view-month"
              data-rh-cal-view="month"
              class="rh-cal-seg__btn ${viewMode === "month" ? "rh-cal-seg__btn--active" : ""}"
            >
              Mes
            </button>
            <button
              type="button"
              id="rh-cal-view-week"
              data-rh-cal-view="week"
              class="rh-cal-seg__btn ${viewMode === "week" ? "rh-cal-seg__btn--active" : ""}"
            >
              Semana
            </button>
          </div>
          <div class="rh-cal-nav-cluster inline-flex min-w-0 flex-wrap items-center justify-center gap-0.5 rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-white/90 p-0.5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
            <button
              type="button"
              id="rh-cal-prev"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana anterior" : "Mes anterior"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <p id="rh-cal-month-label" class="min-w-0 max-w-[min(100%,14rem)] shrink px-2 py-1 text-center text-sm font-semibold text-text-primary sm:min-w-44 sm:max-w-none">${title}</p>
            <button
              type="button"
              id="rh-cal-next"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana siguiente" : "Mes siguiente"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <button
            type="button"
            id="rh-cal-today"
            class="rh-cal-today-btn rounded-xl border border-[rgba(148,163,184,0.26)] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.28)] hover:bg-[rgba(219,234,254,0.45)] hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Ir al mes actual"
          >
            Hoy
          </button>
        </div>
      </div>
      <div class="mt-4 border-t border-border/50 pt-2 pb-3">
        ${legend}
      </div>
    </header>
    <div class="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-5 pt-4 sm:mx-0 sm:overflow-visible sm:px-6 sm:pb-6 sm:pt-5">
      ${viewMode === "week"
        ? weeklyPlanner
        : `<div
            role="grid"
            aria-label="Calendario mensual"
            class="rh-cal-grid-shell flex min-w-136 flex-col gap-1 sm:min-w-0"
          >
            <div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${weekHeader}</div>
            ${rows.join("")}
          </div>`}
    </div>`;
}

export function renderRhPriorityAlertsBlock(payload: RhLowerSectionPayload | null): string {
  const alerts = payload?.priority_alerts ?? [];
  if (alerts.length === 0) {
    return `
      <section class="rh-dash-priority rh-dash-priority--empty mb-6 rounded-[18px] px-4 py-4 sm:px-6" aria-label="Alertas RH prioritarias">
        <div class="flex flex-wrap items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0 text-amber-700/90" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h2 class="text-sm font-semibold text-amber-950/90">Alertas RH prioritarias</h2>
        </div>
        <p class="mt-2 text-sm text-amber-900/75">Sin alertas prioritarias.</p>
      </section>`;
  }

  const chips = alerts
    .map(
      (a) => `
      <span class="rh-dash-priority-chip inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(251,146,60,0.35)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-[0_4px_12px_rgba(245,158,11,0.08)]">
        ${alertChipIcon(a.icon)}
        ${escapeHtml(a.label)}
      </span>`,
    )
    .join("");

  return `
    <section class="rh-dash-priority rh-dash-priority--active mb-6 rounded-[18px] px-4 py-4 sm:px-6" aria-label="Alertas RH prioritarias">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0 text-orange-700" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h2 class="text-sm font-semibold text-orange-950">Alertas RH prioritarias</h2>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${chips}
      </div>
    </section>`;
}

export function renderRhCalendarCard(
  year: number,
  monthIndex: number,
  payload: RhLowerSectionPayload | null,
): string {
  return `
    <section class="rh-cal-card mb-6 overflow-hidden rounded-[20px]" aria-label="Calendario RH">
      <div id="rh-calendar-replaceable">
        ${renderRhCalendarReplaceable(year, monthIndex, payload)}
      </div>
    </section>`;
}

export function renderRhWeeklyAndEvents(payload: RhLowerSectionPayload | null): string {
  const w = payload?.weekly_summary;
  const metrics = [
    { label: "Total Almuerzos", value: formatMetric(w?.total_almuerzos ?? null) },
    { label: "Menús de dieta", value: formatMetric(w?.menus_dieta ?? null) },
    { label: "Home Office total", value: formatMetric(w?.home_office_total ?? null) },
    { label: "Promedio diario", value: formatMetric(w?.promedio_diario ?? null) },
  ];

  const metricsHtml = metrics
    .map(
      (m) => `
      <div class="rh-week-summary__metric min-w-0 text-center sm:text-left">
        <p class="rh-week-summary__label text-[10px] font-semibold uppercase tracking-[0.06em]">${escapeHtml(m.label)}</p>
        <p class="rh-week-summary__value mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">${escapeHtml(m.value)}</p>
      </div>`,
    )
    .join("");

  const events = payload?.upcoming_events ?? [];
  const eventsHtml =
    events.length === 0
      ? `<div class="rh-upcoming-empty rounded-xl border border-dashed border-[rgba(148,163,184,0.35)] bg-[rgba(248,251,255,0.85)] px-4 py-8 text-center">
          <p class="text-sm font-semibold text-[#0f172a]">No hay próximos eventos</p>
          <p class="mt-1.5 text-xs leading-relaxed text-[#64748b]">Los eventos aparecerán cuando el calendario RH esté sincronizado.</p>
        </div>`
      : `<ul class="rh-upcoming-list divide-y divide-[rgba(148,163,184,0.22)]">
          ${events
            .map(
              (e) => `
            <li class="flex gap-3 py-4 first:pt-0 last:pb-0">
              ${eventIcon(e.icon)}
              <div class="min-w-0">
                <p class="font-semibold text-text-primary">${escapeHtml(e.title)}</p>
                <p class="mt-0.5 text-sm text-text-muted">${escapeHtml(e.subtitle)}</p>
              </div>
            </li>`,
            )
            .join("")}
        </ul>`;

  return `
    <div class="rh-week-events-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
      <article class="rh-week-summary-card relative overflow-hidden rounded-[18px] p-5 sm:p-6">
        <div class="relative z-1 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0 text-white/90" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 3.75c0-.621.504-1.125 1.125-1.125h2.25C20.496 2.625 21 3.129 21 3.75v17.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V3.75Z" />
          </svg>
          <h2 class="text-sm font-semibold text-white">Resumen de la Semana</h2>
        </div>
        <div class="relative z-1 mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-6 lg:grid-cols-4">
          ${metricsHtml}
        </div>
      </article>
      <article class="rh-upcoming-card rounded-[18px] border border-[rgba(148,163,184,0.26)] bg-linear-to-br from-white to-[#f8fbff] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)] sm:p-6">
        <h2 class="text-base font-semibold text-text-primary">Próximos Eventos RH</h2>
        <div class="mt-3">
          ${eventsHtml}
        </div>
      </article>
    </div>`;
}

export function renderRhLowerSection(
  year: number,
  monthIndex: number,
  payload: RhLowerSectionPayload | null,
): string {
  return `
    <div class="rh-dashboard-lower mt-10 border-t border-[rgba(148,163,184,0.22)] pt-10">
      ${renderRhPriorityAlertsBlock(payload)}
      ${renderRhCalendarCard(year, monthIndex, payload)}
      ${renderRhWeeklyAndEvents(payload)}
    </div>`;
}

export function renderRhLowerSectionSkeleton(): string {
  const bar = `
    <div class="mb-6 animate-pulse rounded-[18px] border border-[rgba(245,158,11,0.22)] bg-linear-to-br from-[#fffbeb] to-[#fff7ed] px-4 py-6 sm:px-6">
      <div class="h-4 w-56 rounded bg-amber-200/50"></div>
      <div class="mt-4 flex flex-wrap gap-2">
        <div class="h-8 w-40 rounded-full bg-white/80"></div>
        <div class="h-8 w-44 rounded-full bg-white/80"></div>
        <div class="h-8 w-52 rounded-full bg-white/80"></div>
      </div>
    </div>`;
  const cal = `
    <div class="mb-6 animate-pulse rounded-[20px] border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:p-6">
      <div class="flex justify-between gap-4">
        <div class="h-5 w-36 rounded bg-slate-200/90"></div>
        <div class="h-9 w-40 rounded-[12px] bg-slate-100"></div>
      </div>
      <div class="mt-6 h-4 w-full max-w-md rounded bg-slate-100/90"></div>
      <div class="mt-6 grid grid-cols-7 gap-2">
        ${"<div class=\"h-10 rounded-lg bg-slate-100/90\"></div>".repeat(7)}
      </div>
      <div class="mt-2 grid grid-cols-7 gap-2">
        ${"<div class=\"h-16 rounded-lg border border-slate-100/80 bg-slate-50/80\"></div>".repeat(7)}
      </div>
      <div class="mt-2 grid grid-cols-7 gap-2">
        ${"<div class=\"h-16 rounded-lg border border-slate-100/80 bg-slate-50/80\"></div>".repeat(7)}
      </div>
    </div>`;
  const bottom = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="h-44 animate-pulse rounded-[18px] bg-linear-to-br from-[#021b3a]/25 via-[#063b73]/20 to-[#0b4f8a]/25"></div>
      <div class="h-44 animate-pulse rounded-[18px] border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff]"></div>
    </div>`;
  return `<div class="rh-dashboard-lower mt-10 border-t border-[rgba(148,163,184,0.22)] pt-10">${bar}${cal}${bottom}</div>`;
}

/**
 * Enlaza flechas del calendario para re-renderizar solo el bloque reemplazable.
 */
export function bindRhCalendarNavigation(
  container: HTMLElement,
  payload: RhLowerSectionPayload | null,
  initialYear: number,
  initialMonthIndex: number,
): void {
  const weekStartsOn = resolveCalendarWeekStart();
  let currentYear = initialYear;
  let currentMonthIndex = initialMonthIndex;
  let currentView: CalendarViewMode = "month";
  let weekAnchor = parseIsoLocalDate(payload?.calendar.selectedIsoDate) ?? new Date(initialYear, initialMonthIndex, 1);
  const replaceable = (): HTMLElement | null => container.querySelector("#rh-calendar-replaceable");
  const ensureAnchorInCurrentMonth = (): void => {
    if (currentView !== "month") return;
    const day = weekAnchor.getDate();
    weekAnchor = new Date(currentYear, currentMonthIndex, Math.min(day, new Date(currentYear, currentMonthIndex + 1, 0).getDate()));
  };
  const paint = (): void => {
    const slot = replaceable();
    if (!slot) return;
    slot.innerHTML = renderRhCalendarReplaceable(
      currentYear,
      currentMonthIndex,
      payload,
      currentView,
      isoLocalDate(weekAnchor),
      weekStartsOn,
    );
    wire();
  };
  const wire = (): void => {
    container.querySelector<HTMLButtonElement>("#rh-cal-prev")?.addEventListener("click", () => {
      if (currentView === "week") {
        weekAnchor = addCalendarWeeks(weekAnchor, -1);
        currentYear = weekAnchor.getFullYear();
        currentMonthIndex = weekAnchor.getMonth();
      } else {
        [currentYear, currentMonthIndex] = addCalendarMonths(currentYear, currentMonthIndex, -1);
        ensureAnchorInCurrentMonth();
      }
      paint();
    });
    container.querySelector<HTMLButtonElement>("#rh-cal-next")?.addEventListener("click", () => {
      if (currentView === "week") {
        weekAnchor = addCalendarWeeks(weekAnchor, 1);
        currentYear = weekAnchor.getFullYear();
        currentMonthIndex = weekAnchor.getMonth();
      } else {
        [currentYear, currentMonthIndex] = addCalendarMonths(currentYear, currentMonthIndex, 1);
        ensureAnchorInCurrentMonth();
      }
      paint();
    });
    container.querySelector<HTMLButtonElement>("#rh-cal-today")?.addEventListener("click", () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      weekAnchor = now;
      paint();
    });
    container.querySelector<HTMLButtonElement>("#rh-cal-view-month")?.addEventListener("click", () => {
      if (currentView === "month") return;
      currentView = "month";
      currentYear = weekAnchor.getFullYear();
      currentMonthIndex = weekAnchor.getMonth();
      paint();
    });
    container.querySelector<HTMLButtonElement>("#rh-cal-view-week")?.addEventListener("click", () => {
      if (currentView === "week") return;
      currentView = "week";
      const now = new Date();
      weekAnchor = now;
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      paint();
    });
  };

  paint();
}
