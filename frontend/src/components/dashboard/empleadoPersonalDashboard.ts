import { escapeHtml } from "../vista360/html.ts";
import {
  addCalendarMonths,
  addCalendarWeeks,
  CAL_NAV_BTN_CLASS,
  formatCalendarWeekTitle,
  formatCalendarMonthTitle,
  getCalendarMonthVisibleRange,
  getCalendarWeekDates,
  getCalendarWeekVisibleRange,
  getCalendarWeekdayLabels,
  isoLocalDate,
  parseIsoLocalDate,
  resolveCalendarWeekStart,
  type CalendarViewMode,
  type CalendarWeekStart,
} from "./calendarShared.ts";
import { buildRhCalendarMonthGrid, rhIsoLocalDate } from "../../dashboard/rh/calendarMonthGrid.ts";
import { getEmpleadoSolicitudCalendarBadge } from "../../dashboard/empleado/solicitudCalendarioConsts.ts";
import type {
  EmpleadoCalendarDayEntry,
  EmpleadoDashboardPayload,
  EmpleadoPendingRequestType,
} from "../../dashboard/empleado/types.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT, RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";

/**
 * `null` = sin dato (nómina no respondió) y se muestra «—». Antes devolvía "0 días",
 * lo que hacía indistinguible un cero real de un fallo de conexión.
 */
function fmtDays(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const safe = Math.max(0, value);
  const rounded = Math.round(safe * 10) / 10;
  const shown = Number.isInteger(rounded)
    ? String(rounded)
    : new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rounded);
  return `${shown} ${rounded === 1 ? "día" : "días"}`;
}

function fmtPendingCount(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "0";
  return String(Math.trunc(value));
}

function pendingTypeLabel(t: EmpleadoPendingRequestType): string {
  if (t === "vacation") return "VAC";
  if (t === "homeOffice") return "HO";
  if (t === "permiso_sin_goce") return "Sin goce";
  if (t === "goce_sueldo") return "Con goce";
  return "SOL";
}

function mealCalendarText(meal: EmpleadoCalendarDayEntry["meal"]): string {
  if (typeof meal === "string" && meal.trim()) return meal.trim();
  return "Comida";
}

function entryToLines(entry: EmpleadoCalendarDayEntry | undefined): Array<{ text: string; cls: string }> {
  if (!entry) return [];
  const lines: Array<{ text: string; cls: string }> = [];
  if (entry.meal) {
    lines.push({
      text: mealCalendarText(entry.meal),
      cls:
        "rounded border border-orange-200 bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-orange-800 md:text-[11px]",
    });
  }
  if (entry.vacation) {
    lines.push({
      text: "Vacaciones",
      cls:
        "rounded-md bg-orange-500/12 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-orange-700 md:text-[11px]",
    });
  }
  if (entry.home_office) {
    lines.push({
      text: "Home Office",
      cls:
        "rounded-md bg-violet-500/12 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-violet-800 md:text-[11px]",
    });
  }
  const solicitudes = entry.solicitudes_empleado;
  if (solicitudes?.length) {
    const rol = getRolFromAccessToken();
    const sorted = [...solicitudes].sort((a, b) => {
      const pri = (e: (typeof solicitudes)[0]) => (e.estado === "pending" ? 0 : 1);
      return pri(a) - pri(b) || a.solicitud_id - b.solicitud_id;
    });
    for (const ev of sorted) {
      const b = getEmpleadoSolicitudCalendarBadge(rol, ev.estado, ev.tipo);
      lines.push({ text: b.text, cls: b.badgeCls });
    }
  }
  return lines;
}

function renderMobileDots(entry: EmpleadoCalendarDayEntry | undefined): string {
  if (!entry) return "";
  const dots: string[] = [];
  if (entry.meal) dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-500" title="Comida"></span>');
  if (entry.vacation) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-500" title="Vacaciones"></span>');
  }
  if (entry.home_office) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-violet-600" title="Home Office"></span>');
  }
  const solicitudes = entry.solicitudes_empleado;
  if (solicitudes?.length) {
    const rol = getRolFromAccessToken();
    const sorted = [...solicitudes].sort((a, b) => {
      const pri = (e: (typeof solicitudes)[0]) => (e.estado === "pending" ? 0 : 1);
      return pri(a) - pri(b) || a.solicitud_id - b.solicitud_id;
    });
    for (const ev of sorted) {
      const b = getEmpleadoSolicitudCalendarBadge(rol, ev.estado, ev.tipo);
      dots.push(
        `<span class="size-1.5 shrink-0 rounded-full ${b.dotClass}" title="${escapeHtml(b.dotTitle)}"></span>`,
      );
    }
  }
  if (dots.length === 0) return "";
  return `<div class="mt-0.5 flex flex-wrap gap-1 md:hidden" aria-hidden="true">${dots.join("")}</div>`;
}

function renderEmpleadoDayCell(
  iso: string,
  dayNumber: number,
  inMonth: boolean,
  entry: EmpleadoCalendarDayEntry | undefined,
  isToday: boolean,
  isSelected: boolean,
): string {
  const lines = entryToLines(entry);
  const hasContent = lines.length > 0;

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

  const topRowSep = hasContent ? "border-b border-border/30 pb-2 mb-2" : "";

  const linesDesktop =
    lines.length > 0 ?
      `<div class="hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden md:flex">
          ${lines.map((ln) => `<span class="truncate ${ln.cls}">${escapeHtml(ln.text)}</span>`).join("")}
        </div>`
    : "";

  const dotsMobile = hasContent ? renderMobileDots(entry) : "";

  return `
    <div
      role="gridcell"
      class="${cellBase}"
      data-emp-cal-day="${escapeHtml(iso)}"
      aria-label="${escapeHtml(iso)}"
      aria-selected="${isSelected ? "true" : "false"}"
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-1 ${topRowSep}">
        ${dayNumWrap}
      </div>
      ${linesDesktop}
      ${dotsMobile}
    </div>`;
}

function iconDisponibles(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m-6.53-7.11A5.5 5.5 0 0 1 12 7.5v0a5.5 5.5 0 0 1 6.53 6.39 6 6 0 0 1-1.06 2.34m-11 0A6 6 0 0 1 5.47 13.9" /></svg>`;
}

function iconUtilizados(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
}

function iconEsteMes(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M9.75 21V9.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M15.75 21v-6.375c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V21" /></svg>`;
}

function iconEnProceso(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>`;
}

export function renderEmpleadoStatCards(payload: EmpleadoDashboardPayload | null): string {
  const p = payload;
  const pending = p?.pending_requests ?? null;
  const pendingTypes = p?.pending_request_types ?? [];
  const pendingCount = pending ?? 0;
  const showBadges = pendingCount > 0 && pendingTypes.length > 0;

  const badges = showBadges
    ? `<div class="mt-3 flex flex-wrap gap-1.5">
        ${pendingTypes
          .map(
            (t) =>
              `<span class="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(pendingTypeLabel(t))}</span>`,
          )
          .join("")}
      </div>`
    : "";

  const enProcesoSub = pendingCount === 0 ? "Sin solicitudes pendientes" : "Solicitudes pendientes";

  const cards = [
    {
      label: "Disponibles",
      labelCls: "text-leoni-green",
      iconWrap: "bg-leoni-green/12 text-leoni-green",
      icon: iconDisponibles(),
      value: fmtDays(p?.vacation_available_days ?? null),
      sub: "Vacaciones disponibles",
      extra: "",
    },
    {
      label: "Utilizados",
      labelCls: "text-orange-600",
      iconWrap: "bg-orange-500/12 text-orange-600",
      icon: iconUtilizados(),
      value: fmtDays(p?.vacation_used_days ?? null),
      sub: "Vacaciones tomadas",
      extra: "",
    },
    {
      label: "Este año",
      labelCls: "text-violet-700",
      iconWrap: "bg-violet-500/12 text-violet-700",
      icon: iconEsteMes(),
      value: fmtDays(p?.home_office_dias_anio ?? null),
      sub: "Home Office tomados",
      extra: "",
    },
    {
      label: "En proceso",
      labelCls: "text-red-600",
      iconWrap: "bg-red-500/12 text-red-600",
      icon: iconEnProceso(),
      value: fmtPendingCount(pending),
      sub: enProcesoSub,
      extra: badges,
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="${RH_LISTADO_SURFACE} p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex size-11 shrink-0 items-center justify-center rounded-full ${c.iconWrap}">
          ${c.icon}
        </div>
        <span class="max-w-[55%] text-right text-[11px] font-bold uppercase leading-tight tracking-wide ${c.labelCls}">${escapeHtml(c.label)}</span>
      </div>
      <p class="mt-4 text-2xl font-bold tracking-tight text-text-primary">${escapeHtml(c.value)}</p>
      <p class="mt-1 text-sm text-text-muted">${escapeHtml(c.sub)}</p>
      ${c.extra}
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${html}</div>`;
}

export function renderEmpleadoCalendarReplaceable(
  year: number,
  monthIndex: number,
  payload: EmpleadoDashboardPayload | null,
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
  const map = payload?.calendar.day_entries ?? {};
  const sel = payload?.calendar.selected_iso_date ?? null;
  const todayIso = rhIsoLocalDate(new Date());

  const rows: string[] = [];
  if (viewMode === "month") {
    for (let r = 0; r < 6; r += 1) {
      const slice = grid.slice(r * 7, r * 7 + 7);
      rows.push(
        `<div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${slice
          .map((cell) =>
            renderEmpleadoDayCell(
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
          return renderEmpleadoDayCell(
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
    <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Comidas</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Vacaciones</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-violet-600" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Home Office</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Solicitud aprobada (verde)</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Solicitud pendiente (amarillo)</span>
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
        const lines = entryToLines(map[iso]);
        const entries =
          lines.length > 0
            ? lines
                .map((ln) => `<span class="truncate ${ln.cls}">${escapeHtml(ln.text)}</span>`)
                .join("")
            : `<span class="text-xs text-text-muted">Sin registros</span>`;
        return `<article class="rh-cal-week-planner-day rounded-xl border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(dayName)}</span>
            <span class="${isToday ? "rh-cal-week-planner-day__date rh-cal-week-planner-day__date--today" : "rh-cal-week-planner-day__date"}">${d.getDate()}</span>
          </div>
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
        <h2 class="text-base font-semibold text-text-primary">Mi calendario</h2>
        <div class="rh-cal-toolbar flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div class="rh-cal-seg" role="group" aria-label="Vista del calendario">
            <button
              type="button"
              id="emp-cal-view-month"
              data-emp-cal-view="month"
              class="rh-cal-seg__btn ${viewMode === "month" ? "rh-cal-seg__btn--active" : ""}"
            >
              Mes
            </button>
            <button
              type="button"
              id="emp-cal-view-week"
              data-emp-cal-view="week"
              class="rh-cal-seg__btn ${viewMode === "week" ? "rh-cal-seg__btn--active" : ""}"
            >
              Semana
            </button>
          </div>
          <div class="rh-cal-nav-cluster inline-flex min-w-0 flex-wrap items-center justify-center gap-0.5 rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-white/90 p-0.5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
            <button
              type="button"
              id="emp-cal-prev"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana anterior" : "Mes anterior"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <p id="emp-cal-month-label" class="min-w-0 max-w-[min(100%,14rem)] shrink px-2 py-1 text-center text-sm font-semibold text-text-primary sm:min-w-44 sm:max-w-none">${title}</p>
            <button
              type="button"
              id="emp-cal-next"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana siguiente" : "Mes siguiente"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <button
            type="button"
            id="emp-cal-today"
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
            aria-label="Calendario personal"
            class="rh-cal-grid-shell flex min-w-136 flex-col gap-1 sm:min-w-0"
          >
            <div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${weekHeader}</div>
            ${rows.join("")}
          </div>`}
    </div>`;
}

export function renderEmpleadoCalendarCard(
  year: number,
  monthIndex: number,
  payload: EmpleadoDashboardPayload | null,
): string {
  return `
    <section class="rh-cal-card overflow-hidden rounded-[20px]" aria-label="Calendario personal">
      <div id="empleado-calendar-replaceable">
        ${renderEmpleadoCalendarReplaceable(year, monthIndex, payload)}
      </div>
    </section>`;
}

export function renderEmpleadoPersonalDashboard(
  year: number,
  monthIndex: number,
  payload: EmpleadoDashboardPayload | null,
): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">
      ${renderEmpleadoStatCards(payload)}
      ${renderEmpleadoCalendarCard(year, monthIndex, payload)}
    </div>`;
}

export function renderEmpleadoDashboardSkeleton(): string {
  const cards = `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${`<div class="${RH_LISTADO_SURFACE} animate-pulse p-5">
        <div class="flex justify-between gap-3">
          <div class="size-11 rounded-full bg-surface"></div>
          <div class="h-3 w-20 rounded bg-surface"></div>
        </div>
        <div class="mt-4 h-8 w-24 rounded bg-surface"></div>
        <div class="mt-2 h-4 w-40 rounded bg-surface/80"></div>
      </div>`.repeat(4)}
    </div>`;
  const cal = `
    <div class="rh-cal-card animate-pulse overflow-hidden rounded-[20px] p-4 sm:p-6">
      <div class="flex justify-between gap-4">
        <div class="h-5 w-32 rounded bg-surface"></div>
        <div class="h-9 w-44 rounded-xl bg-surface"></div>
      </div>
      <div class="mt-6 h-3 w-full max-w-sm rounded bg-surface/80"></div>
      <div class="mt-4 grid grid-cols-7 gap-1">
        ${"<div class=\"h-9 rounded-lg bg-surface/90\"></div>".repeat(7)}
      </div>
      <div class="mt-1 grid grid-cols-7 gap-1">
        ${"<div class=\"h-16 rounded-lg bg-surface/50\"></div>".repeat(7)}
      </div>
    </div>`;
  return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">${cards}${cal}</div>`;
}

export function bindEmpleadoCalendarNavigation(
  container: HTMLElement,
  payload: EmpleadoDashboardPayload | null,
  initialYear: number,
  initialMonthIndex: number,
  options?: {
    loadMonthData?: (target: {
      year: number;
      monthIndex: number;
      visibleStartIso: string;
      visibleEndIso: string;
      weekStartsOn: CalendarWeekStart;
    }) => Promise<EmpleadoDashboardPayload | null>;
  },
): void {
  let currentPayload = payload;
  const weekStartsOn = resolveCalendarWeekStart();
  let currentYear = initialYear;
  let currentMonthIndex = initialMonthIndex;
  let currentView: CalendarViewMode = "month";
  let fetchVersion = 0;
  let weekAnchor = parseIsoLocalDate(currentPayload?.calendar.selected_iso_date) ?? new Date(initialYear, initialMonthIndex, 1);

  const replaceable = (): HTMLElement | null => container.querySelector("#empleado-calendar-replaceable");
  const ensureAnchorInCurrentMonth = (): void => {
    if (currentView !== "month") return;
    const day = weekAnchor.getDate();
    weekAnchor = new Date(currentYear, currentMonthIndex, Math.min(day, new Date(currentYear, currentMonthIndex + 1, 0).getDate()));
  };
  const paint = (): void => {
    const slot = replaceable();
    if (!slot) return;
    slot.innerHTML = renderEmpleadoCalendarReplaceable(
      currentYear,
      currentMonthIndex,
      currentPayload,
      currentView,
      isoLocalDate(weekAnchor),
      weekStartsOn,
    );
    wire();
  };
  const currentVisibleRange = (): { startIso: string; endIso: string } =>
    currentView === "week"
      ? getCalendarWeekVisibleRange(weekAnchor, weekStartsOn)
      : getCalendarMonthVisibleRange(currentYear, currentMonthIndex, weekStartsOn);
  const requestData = async (): Promise<void> => {
    if (!options?.loadMonthData) return;
    const reqVersion = ++fetchVersion;
    const visible = currentVisibleRange();
    const next = await options.loadMonthData({
      year: currentView === "week" ? weekAnchor.getFullYear() : currentYear,
      monthIndex: currentView === "week" ? weekAnchor.getMonth() : currentMonthIndex,
      visibleStartIso: visible.startIso,
      visibleEndIso: visible.endIso,
      weekStartsOn,
    });
    if (reqVersion !== fetchVersion || !next) return;
    const prevSelected = currentPayload?.calendar.selected_iso_date ?? null;
    currentPayload = {
      ...next,
      calendar: {
        ...next.calendar,
        selected_iso_date: prevSelected ?? next.calendar.selected_iso_date,
      },
    };
    paint();
  };

  const wire = (): void => {
    container.querySelector<HTMLButtonElement>("#emp-cal-prev")?.addEventListener("click", () => {
      if (currentView === "week") {
        weekAnchor = addCalendarWeeks(weekAnchor, -1);
        currentYear = weekAnchor.getFullYear();
        currentMonthIndex = weekAnchor.getMonth();
      } else {
        [currentYear, currentMonthIndex] = addCalendarMonths(currentYear, currentMonthIndex, -1);
        ensureAnchorInCurrentMonth();
      }
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#emp-cal-next")?.addEventListener("click", () => {
      if (currentView === "week") {
        weekAnchor = addCalendarWeeks(weekAnchor, 1);
        currentYear = weekAnchor.getFullYear();
        currentMonthIndex = weekAnchor.getMonth();
      } else {
        [currentYear, currentMonthIndex] = addCalendarMonths(currentYear, currentMonthIndex, 1);
        ensureAnchorInCurrentMonth();
      }
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#emp-cal-today")?.addEventListener("click", () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      weekAnchor = now;
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#emp-cal-view-month")?.addEventListener("click", () => {
      if (currentView === "month") return;
      currentView = "month";
      currentYear = weekAnchor.getFullYear();
      currentMonthIndex = weekAnchor.getMonth();
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#emp-cal-view-week")?.addEventListener("click", () => {
      if (currentView === "week") return;
      currentView = "week";
      const now = new Date();
      weekAnchor = now;
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      paint();
      void requestData();
    });
  };

  paint();
}
