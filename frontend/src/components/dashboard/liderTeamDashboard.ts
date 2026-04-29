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
import { renderEmpleadoStatCards } from "./empleadoPersonalDashboard.ts";
import { buildRhCalendarMonthGrid, rhIsoLocalDate } from "../../dashboard/rh/calendarMonthGrid.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { emptyEmpleadoDashboardPayload } from "../../dashboard/empleado/mock.ts";
import { getCalendarRequestBadge } from "../../dashboard/empleado/solicitudCalendarioConsts.ts";
import type { EmpleadoDashboardPayload } from "../../dashboard/empleado/types.ts";
import type {
  LiderApprovalRequestRow,
  LiderApprovalRequestType,
  LiderDashboardPayload,
  LiderPersonalStats,
  LiderTeamStats,
  TeamCalendarDayEntry,
  TeamCalendarLine,
} from "../../dashboard/lider/types.ts";

const MAX_VISIBLE_TEAM_CAL_LINES = 3;
const DEFAULT_MEAL_DETAIL_TITLE = "Selecciona un registro de comida";
const DEFAULT_MEAL_DETAIL_BODY = "Haz clic en una etiqueta azul del calendario para ver tipo de menú y hora.";

type SelectedMealDetail = {
  dateIso: string;
  employeeName: string;
  mealType: string;
  mealTime: string;
};

function personalToEmpleadoPayload(p: LiderPersonalStats): EmpleadoDashboardPayload {
  const stub = emptyEmpleadoDashboardPayload();
  return {
    vacation_available_days: p.vacation_available_days,
    vacation_used_days: p.vacation_used_days,
    home_office_this_month: p.home_office_this_month,
    pending_requests: p.pending_requests,
    pending_request_types: p.pending_request_types,
    calendar: stub.calendar,
  };
}

function fmtActivas(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "0 activas";
  const v = Math.trunc(n);
  return `${v} ${v === 1 ? "activa" : "activas"}`;
}

function fmtPendientes(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "0 pendientes";
  const v = Math.trunc(n);
  return `${v} ${v === 1 ? "pendiente" : "pendientes"}`;
}

function fmtPersonas(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "0 personas";
  const v = Math.trunc(n);
  return `${v} ${v === 1 ? "persona" : "personas"}`;
}

function iconIncidencias(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
}

function iconVacPend(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
}

function iconHoPend(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>`;
}

function iconColaboradores(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>`;
}

function renderLiderDashboardSectionHeader(title: string, subtitle: string): string {
  const idSlug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "");
  const headingId = `lider-dash-section-${idSlug}`;
  return `
    <header class="mb-4">
      <h2 id="${escapeHtml(headingId)}" class="text-lg font-semibold tracking-tight text-text-primary">${escapeHtml(title)}</h2>
      <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">${escapeHtml(subtitle)}</p>
    </header>`;
}

export function renderLiderTeamStatCards(team: LiderTeamStats | null): string {
  const t = team;
  const rolLider = getRolFromAccessToken();
  const esGerente = rolLider === "gerente";
  const cards = [
    {
      label: "Incidencias activas",
      labelCls: "text-red-600",
      iconWrap: "bg-red-500/12 text-red-600",
      icon: iconIncidencias(),
      value: fmtActivas(t?.team_active_incidents ?? null),
      sub: "Incidencias del equipo",
    },
    {
      label: "Vacaciones por aprobar",
      labelCls: "text-orange-600",
      iconWrap: "bg-orange-500/12 text-orange-600",
      icon: iconVacPend(),
      value: fmtPendientes(t?.team_pending_vacation_requests ?? null),
      sub: "Pendientes de aprobación",
    },
    {
      label: "Home Office pendientes",
      labelCls: "text-violet-700",
      iconWrap: "bg-violet-500/12 text-violet-700",
      icon: iconHoPend(),
      value: fmtPendientes(t?.team_pending_home_office_requests ?? null),
      sub: "Home Office por aprobar",
    },
    {
      label: esGerente ? "Total estructura" : "Total colaboradores",
      labelCls: "text-leoni-blue",
      iconWrap: "bg-leoni-blue/10 text-leoni-blue",
      icon: iconColaboradores(),
      value: fmtPersonas(t?.team_collaborators_count ?? null),
      sub: esGerente
        ? "Todos los niveles bajo tu mando"
        : "Equipo directo",
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="flex size-11 shrink-0 items-center justify-center rounded-full ${c.iconWrap}">
          ${c.icon}
        </div>
        <span class="max-w-[55%] text-right text-[11px] font-bold uppercase leading-tight tracking-wide ${c.labelCls}">${escapeHtml(c.label)}</span>
      </div>
      <p class="mt-4 text-2xl font-bold tracking-tight text-text-primary">${escapeHtml(c.value)}</p>
      <p class="mt-1 text-sm text-text-muted">${escapeHtml(c.sub)}</p>
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${html}</div>`;
}

function approvalTypeLabel(tp: LiderApprovalRequestType): string {
  switch (tp) {
    case "vacation":
      return "Vacaciones";
    case "home_office":
      return "Home Office";
    case "permiso":
      return "Permiso";
    case "incidencia":
      return "Incidencia";
    default:
      return "Solicitud";
  }
}

function renderApprovalRequestsCard(requests: LiderApprovalRequestRow[]): string {
  const empty =
    requests.length === 0 ?
      `<div class="rounded-xl border border-dashed border-border/90 bg-surface/40 px-4 py-10 text-center">
        <p class="text-sm font-semibold text-text-primary">No hay solicitudes pendientes por aprobar</p>
        <p class="mt-1 text-xs text-text-muted">Las solicitudes de tu equipo aparecerán aquí.</p>
      </div>`
    : `
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th scope="col" class="whitespace-nowrap py-3 pr-4">Colaborador</th>
              <th scope="col" class="whitespace-nowrap py-3 pr-4">Tipo</th>
              <th scope="col" class="whitespace-nowrap py-3 pr-4">Fechas</th>
              <th scope="col" class="min-w-[8rem] py-3 pr-4">Detalle</th>
              <th scope="col" class="whitespace-nowrap py-3 pr-4">Estatus</th>
              <th scope="col" class="whitespace-nowrap py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/80">
            ${requests
              .map((r) => {
                const initials =
                  r.collaborator_initials?.trim() ||
                  (r.collaborator_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0] ?? "")
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "??");
                const name = escapeHtml(r.collaborator_name);
                const ini = escapeHtml(initials);
                return `
              <tr class="bg-white">
                <td class="py-3 pr-4 align-middle">
                  <div class="flex items-center gap-3">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 text-xs font-bold text-leoni-blue">${ini}</span>
                    <span class="font-semibold text-text-primary">${name}</span>
                  </div>
                </td>
                <td class="py-3 pr-4 align-middle text-text-primary">${escapeHtml(approvalTypeLabel(r.request_type))}</td>
                <td class="py-3 pr-4 align-middle text-text-muted">${escapeHtml(r.date_range)}</td>
                <td class="max-w-xs py-3 pr-4 align-middle text-text-muted">${escapeHtml(r.detail)}</td>
                <td class="py-3 pr-4 align-middle">
                  <span class="inline-flex rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-semibold text-amber-800">${escapeHtml(r.status)}</span>
                </td>
                <td class="py-3 align-middle text-right">
                  <div class="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" data-lider-reject="${escapeHtml(r.id)}">
                      Rechazar
                    </button>
                    <button type="button" class="rounded-lg bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-leoni-blue-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leoni-blue" data-lider-approve="${escapeHtml(r.id)}">
                      Aprobar
                    </button>
                  </div>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

  return `
    <section class="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6" aria-label="Solicitudes de aprobación">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-base font-semibold text-text-primary">Solicitudes de aprobación</h2>
        <a href="#" class="text-sm font-semibold text-leoni-blue hover:text-leoni-blue-light">Ver todas</a>
      </div>
      <div class="mt-4">
        ${empty}
      </div>
    </section>`;
}

function teamLineClass(line: TeamCalendarLine): string {
  if (
    (line.kind === "vacation" || line.kind === "home_office") &&
    (line.request_status === "approved" || line.request_status === "pending")
  ) {
    return line.request_status === "approved"
      ? "rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-emerald-800 md:text-[11px]"
      : "rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-amber-950 md:text-[11px]";
  }

  switch (line.kind) {
    case "meal":
      return "rounded-md bg-leoni-blue/10 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-leoni-blue md:text-[11px]";
    case "vacation":
      return "rounded-md bg-orange-500/12 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-orange-700 md:text-[11px]";
    case "home_office":
      return "rounded-md bg-violet-500/12 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-violet-800 md:text-[11px]";
    case "incident":
      return "rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-red-700 md:text-[11px]";
    default:
      return "rounded-md px-1.5 py-0.5 text-[10px] text-text-muted md:text-[11px]";
  }
}

function mealLineIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 3v6a2.5 2.5 0 0 0 5 0V3M7 3v18m8-18v8m0 0c0 1.1.9 2 2 2h.5M15 11v10" /></svg>`;
}

function renderTeamLineText(line: TeamCalendarLine, currentRole: string | null, currentUserId: string | null): string {
  if (
    (line.kind === "vacation" || line.kind === "home_office") &&
    (line.request_status === "approved" || line.request_status === "pending")
  ) {
    const tipo = line.request_type === "home_office" || line.kind === "home_office" ? "home_office" : "vacaciones";
    return getCalendarRequestBadge({
      userRole: currentRole,
      currentUserId,
      ownerId: line.owner_id ?? null,
      ownerName: line.owner_name ?? null,
      estado: line.request_status,
      tipo,
    }).text;
  }
  return line.text;
}

function visibleTeamLines(entry: TeamCalendarDayEntry | undefined): {
  visible: TeamCalendarLine[];
  overflow: number;
} {
  const all = entry?.lines ?? [];
  if (all.length <= MAX_VISIBLE_TEAM_CAL_LINES) {
    return { visible: all, overflow: 0 };
  }
  return {
    visible: all.slice(0, MAX_VISIBLE_TEAM_CAL_LINES),
    overflow: all.length - MAX_VISIBLE_TEAM_CAL_LINES,
  };
}

function teamCalendarMobileDots(entry: TeamCalendarDayEntry | undefined): string {
  if (!entry?.lines?.length) return "";
  const kinds = new Set(entry.lines.map((l) => l.kind));
  const hasApprovedRequest = entry.lines.some(
    (l) => (l.kind === "vacation" || l.kind === "home_office") && l.request_status === "approved",
  );
  const hasPendingRequest = entry.lines.some(
    (l) => (l.kind === "vacation" || l.kind === "home_office") && l.request_status === "pending",
  );
  const dots: string[] = [];
  if (kinds.has("meal")) dots.push('<span class="size-1.5 shrink-0 rounded-full bg-leoni-blue" title="Comidas"></span>');
  if (hasApprovedRequest) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-emerald-600" title="Solicitudes aprobadas"></span>');
  } else if (kinds.has("vacation")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-500" title="Vacaciones"></span>');
  }
  if (hasPendingRequest) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-amber-500" title="Solicitudes pendientes"></span>');
  } else if (kinds.has("home_office")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-violet-600" title="Home Office"></span>');
  }
  if (kinds.has("incident")) dots.push('<span class="size-1.5 shrink-0 rounded-full bg-red-500" title="Incidencias"></span>');
  if (dots.length === 0) return "";
  return `<div class="mt-0.5 flex flex-wrap gap-1 md:hidden" aria-hidden="true">${dots.join("")}</div>`;
}

function renderTeamCalendarDayCell(
  iso: string,
  dayNumber: number,
  inMonth: boolean,
  entry: TeamCalendarDayEntry | undefined,
  isToday: boolean,
  isSelected: boolean,
  selectedMeal: SelectedMealDetail | null,
): string {
  const { visible, overflow } = visibleTeamLines(entry);
  const hasContent = visible.length > 0 || overflow > 0;
  const currentRole = getRolFromAccessToken();
  const currentUserId = getEmpleadoIdFromAccessToken();

  const cellPieces: string[] = [
    "group relative flex min-h-[4.5rem] flex-col rounded-sm p-2 outline-none md:min-h-[6.5rem] md:p-3",
    "border-0 transition-colors transition-shadow duration-150 ease-out",
  ];

  if (!inMonth) {
    cellPieces.push("bg-surface text-text-muted hover:bg-border/20 hover:shadow-sm");
  } else if (isSelected) {
    const selBg = isToday ? "bg-leoni-blue/10" : "bg-leoni-blue/[0.09]";
    cellPieces.push(
      `z-[1] ${selBg} ring-2 ring-leoni-blue ring-inset hover:bg-leoni-blue/[0.12] hover:shadow-sm`,
    );
  } else if (isToday) {
    cellPieces.push("bg-leoni-blue/5 hover:bg-leoni-blue/[0.09] hover:shadow-sm");
  } else {
    cellPieces.push("bg-white hover:bg-surface hover:shadow-sm");
  }

  const cellBase = cellPieces.join(" ");

  const dayNumWrap = isToday && inMonth
    ? `<span class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-leoni-blue text-xs font-bold text-white shadow-sm">${dayNumber}</span>`
    : `<span class="inline-flex min-h-7 min-w-7 items-center justify-center text-xs font-semibold ${inMonth ? "text-text-primary" : "text-text-muted"}">${dayNumber}</span>`;

  const topRowSep = hasContent ? "border-b border-border/30 pb-2 mb-2" : "";

  const overflowPill =
    overflow > 0 ?
      `<span class="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-text-muted md:text-[11px]">+${overflow}</span>`
    : "";

  const linesDesktop =
    visible.length > 0 || overflow > 0 ?
      `<div class="hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden md:flex">
          ${visible
            .map((ln) => {
              if (ln.kind !== "meal") {
                return `<span class="truncate ${teamLineClass(ln)}">${escapeHtml(renderTeamLineText(ln, currentRole, currentUserId))}</span>`;
              }
              const dateIso = escapeHtml(iso);
              const employeeName = escapeHtml(ln.meal_employee_name ?? "Sin nombre");
              const mealType = escapeHtml(ln.meal_type_label ?? "Sin tipo");
              const mealTime = escapeHtml(ln.meal_time_label ?? "Sin hora");
              const isMealSelected =
                selectedMeal?.dateIso === iso &&
                selectedMeal.employeeName === (ln.meal_employee_name ?? "Sin nombre") &&
                selectedMeal.mealType === (ln.meal_type_label ?? "Sin tipo") &&
                selectedMeal.mealTime === (ln.meal_time_label ?? "Sin hora");
              const selectedClass = isMealSelected ? "ring-1 ring-inset ring-leoni-blue/50" : "";
              const summaryText = escapeHtml(ln.text);
              return `<button
                type="button"
                class="inline-flex max-w-full items-center gap-1 truncate text-left ${teamLineClass(ln)} ${selectedClass}"
                data-lider-meal-detail="1"
                data-lider-meal-date="${dateIso}"
                data-lider-meal-employee="${employeeName}"
                data-lider-meal-type="${mealType}"
                data-lider-meal-time="${mealTime}"
                title="${summaryText}"
              >
                ${mealLineIcon()}
                <span class="truncate">${summaryText}</span>
              </button>`;
            })
            .join("")}
          ${overflowPill}
        </div>`
    : "";

  const dotsMobile = hasContent ? teamCalendarMobileDots(entry) : "";

  return `
    <div
      role="gridcell"
      class="${cellBase}"
      data-lider-cal-day="${escapeHtml(iso)}"
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

export function renderLiderTeamCalendarReplaceable(
  year: number,
  monthIndex: number,
  payload: LiderDashboardPayload | null,
  selectedMeal: SelectedMealDetail | null = null,
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
  const map = payload?.team_calendar.day_entries ?? {};
  const sel = payload?.team_calendar.selected_iso_date ?? null;
  const todayIso = rhIsoLocalDate(new Date());

  const rows: string[] = [];
  if (viewMode === "month") {
    for (let r = 0; r < 6; r += 1) {
      const slice = grid.slice(r * 7, r * 7 + 7);
      rows.push(
        `<div role="row" class="grid grid-cols-7 gap-1">${slice
          .map((cell) =>
            renderTeamCalendarDayCell(
              cell.isoDate,
              cell.dayNumber,
              cell.inCurrentMonth,
              map[cell.isoDate],
              cell.isoDate === todayIso,
              Boolean(sel && cell.isoDate === sel),
              selectedMeal,
            ),
          )
          .join("")}</div>`,
      );
    }
  } else {
    const weekDates = getCalendarWeekDates(anchorDate, weekStartsOn);
    rows.push(
      `<div role="row" class="grid grid-cols-7 gap-1">${weekDates
        .map((d) => {
          const iso = isoLocalDate(d);
          return renderTeamCalendarDayCell(
            iso,
            d.getDate(),
            true,
            map[iso],
            iso === todayIso,
            Boolean(sel && iso === sel),
            selectedMeal,
          );
        })
        .join("")}</div>`,
    );
  }

  const legend = `
    <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-leoni-blue" aria-hidden="true"></span>
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
        <span class="font-medium text-text-primary">Solicitudes aprobadas</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Solicitudes pendientes</span>
      </span>
      <span class="inline-flex items-center gap-2 text-text-muted">
        <span class="size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Incidencias</span>
      </span>
    </div>`;

  const weekHeader = getCalendarWeekdayLabels(weekStartsOn)
    .map(
      (d) =>
        `<div role="columnheader" class="rounded-sm bg-white py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">${d}</div>`,
    )
    .join("");

  const hasMealSelected = Boolean(selectedMeal);
  const mealTitle = hasMealSelected ? "Detalle de comida" : DEFAULT_MEAL_DETAIL_TITLE;
  const mealMain = hasMealSelected
    ? `${selectedMeal?.employeeName ?? "Sin nombre"} · ${selectedMeal?.mealType ?? "Sin tipo"}`
    : DEFAULT_MEAL_DETAIL_BODY;
  const mealMeta = hasMealSelected
    ? `Fecha: ${selectedMeal?.dateIso ?? ""} · Hora: ${selectedMeal?.mealTime ?? "Sin hora"}`
    : "";
  const mealDetail = `<div
      id="lider-meal-detail-panel"
      class="mt-4 rounded-xl border px-4 py-3 ${hasMealSelected ? "border-leoni-blue/25 bg-leoni-blue/5" : "border-border/80 bg-surface/50"}"
    >
      <p id="lider-meal-detail-title" class="text-xs font-semibold ${hasMealSelected ? "uppercase tracking-wide text-leoni-blue" : "text-text-primary"}">${escapeHtml(mealTitle)}</p>
      <p id="lider-meal-detail-main" class="mt-1 ${hasMealSelected ? "text-sm font-semibold text-text-primary" : "text-xs text-text-muted"}">${escapeHtml(mealMain)}</p>
      <p id="lider-meal-detail-meta" class="text-xs text-text-muted">${escapeHtml(mealMeta)}</p>
    </div>`;

  const currentRole = getRolFromAccessToken();
  const currentUserId = getEmpleadoIdFromAccessToken();
  const weeklyPlanner = (() => {
    if (viewMode !== "week") return "";
    const weekDates = getCalendarWeekDates(anchorDate, weekStartsOn);
    const dayColumns = weekDates
      .map((d) => {
        const iso = isoLocalDate(d);
        const isToday = iso === todayIso;
        const dayName = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(d);
        const lines = map[iso]?.lines ?? [];
        const entries =
          lines.length > 0
            ? lines
                .map((ln) => {
                  if (ln.kind === "meal") {
                    const dateIso = escapeHtml(iso);
                    const employeeName = escapeHtml(ln.meal_employee_name ?? "Sin nombre");
                    const mealType = escapeHtml(ln.meal_type_label ?? "Sin tipo");
                    const mealTime = escapeHtml(ln.meal_time_label ?? "Sin hora");
                    return `<button
                      type="button"
                      class="inline-flex max-w-full items-center gap-1 truncate text-left ${teamLineClass(ln)}"
                      data-lider-meal-detail="1"
                      data-lider-meal-date="${dateIso}"
                      data-lider-meal-employee="${employeeName}"
                      data-lider-meal-type="${mealType}"
                      data-lider-meal-time="${mealTime}"
                    >
                      ${mealLineIcon()}
                      <span class="truncate">${escapeHtml(renderTeamLineText(ln, currentRole, currentUserId))}</span>
                    </button>`;
                  }
                  return `<span class="truncate ${teamLineClass(ln)}">${escapeHtml(renderTeamLineText(ln, currentRole, currentUserId))}</span>`;
                })
                .join("")
            : `<span class="text-xs text-text-muted">Sin registros</span>`;
        return `<article class="rounded-xl border border-border bg-white p-3 shadow-sm">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(dayName)}</span>
            <span class="${isToday ? "inline-flex size-8 items-center justify-center rounded-full bg-leoni-blue text-sm font-semibold text-white" : "inline-flex size-8 items-center justify-center rounded-full bg-surface text-sm font-semibold text-text-primary"}">${d.getDate()}</span>
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
    <header class="px-4 pt-5 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-base font-semibold text-text-primary">Calendario del equipo</h2>
        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div class="inline-flex items-center rounded-xl border border-border bg-white p-0.5 shadow-sm">
            <button
              type="button"
              id="lid-cal-view-month"
              data-lid-cal-view="month"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === "month" ? "bg-leoni-blue text-white" : "text-text-muted hover:bg-surface"}"
            >
              Mes
            </button>
            <button
              type="button"
              id="lid-cal-view-week"
              data-lid-cal-view="week"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === "week" ? "bg-leoni-blue text-white" : "text-text-muted hover:bg-surface"}"
            >
              Semana
            </button>
          </div>
          <div class="inline-flex items-center rounded-xl border border-border bg-white p-0.5 shadow-sm">
            <button
              type="button"
              id="lid-cal-prev"
              class="${CAL_NAV_BTN_CLASS}"
              aria-label="${viewMode === "week" ? "Semana anterior" : "Mes anterior"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <p id="lid-cal-month-label" class="min-w-44 px-1 text-center text-sm font-semibold text-text-primary">${title}</p>
            <button
              type="button"
              id="lid-cal-next"
              class="${CAL_NAV_BTN_CLASS}"
              aria-label="${viewMode === "week" ? "Semana siguiente" : "Mes siguiente"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <button
            type="button"
            id="lid-cal-today"
            class="rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-muted shadow-sm transition-colors hover:border-leoni-blue/25 hover:bg-leoni-blue/5 hover:text-leoni-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leoni-blue"
            aria-label="Ir al mes actual"
          >
            Hoy
          </button>
        </div>
      </div>
      <div class="mt-5 border-t border-border/50 pt-4">
        ${legend}
      </div>
    </header>
    <div class="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-5 pt-4 sm:mx-0 sm:overflow-visible sm:px-6 sm:pb-6">
      ${viewMode === "week"
        ? weeklyPlanner
        : `<div
            role="grid"
            aria-label="Calendario del equipo"
            class="flex min-w-136 flex-col gap-1 rounded-xl border border-border bg-border/80 p-1 shadow-sm sm:min-w-0"
          >
            <div role="row" class="grid grid-cols-7 gap-1">${weekHeader}</div>
            ${rows.join("")}
          </div>`}
      ${mealDetail}
    </div>`;
}

function renderLiderTeamCalendarCard(
  year: number,
  monthIndex: number,
  payload: LiderDashboardPayload | null,
  selectedMeal: SelectedMealDetail | null = null,
): string {
  return `
    <section class="mt-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-label="Calendario del equipo">
      <div id="lider-calendar-replaceable">
        ${renderLiderTeamCalendarReplaceable(year, monthIndex, payload, selectedMeal)}
      </div>
    </section>`;
}

export function renderLiderTeamDashboard(
  year: number,
  monthIndex: number,
  payload: LiderDashboardPayload | null,
  selectedMeal: SelectedMealDetail | null = null,
): string {
  const p = payload;
  const personalHtml = renderEmpleadoStatCards(p ? personalToEmpleadoPayload(p.personal) : null);
  const teamHtml = renderLiderTeamStatCards(p?.team ?? null);
  const approvalsHtml = renderApprovalRequestsCard(p?.approval_requests ?? []);
  const calHtml = renderLiderTeamCalendarCard(year, monthIndex, p, selectedMeal);

  const teamHeading = renderLiderDashboardSectionHeader(
    "Resumen del equipo",
    "Indicadores generales del desempeño y estado del equipo",
  );
  const personalHeading = renderLiderDashboardSectionHeader(
    "Resumen personal",
    "Información y métricas individuales",
  );

  return `
    <div class="space-y-0">
      <section class="lider-dashboard-stats-section" aria-labelledby="lider-dash-section-resumen-personal">
        ${personalHeading}
        ${personalHtml}
      </section>
      <div class="my-10 border-t border-border/40" aria-hidden="true"></div>
      <section class="lider-dashboard-stats-section" aria-labelledby="lider-dash-section-resumen-del-equipo">
        ${teamHeading}
        ${teamHtml}
        ${approvalsHtml}
      </section>
      ${calHtml}
    </div>`;
}

export function renderLiderDashboardSkeleton(): string {
  const headingSkel = `
    <header class="mb-4">
      <div class="h-6 w-52 max-w-full animate-pulse rounded-md bg-surface"></div>
      <div class="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-surface/80"></div>
    </header>`;
  const row4 = `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    ${`<div class="animate-pulse rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div class="flex justify-between gap-3"><div class="size-11 rounded-full bg-surface"></div><div class="h-3 w-24 rounded bg-surface"></div></div>
      <div class="mt-4 h-8 w-28 rounded bg-surface"></div>
      <div class="mt-2 h-4 w-36 rounded bg-surface/80"></div>
    </div>`.repeat(4)}
  </div>`;
  const sep = `<div class="my-10 border-t border-border/40"></div>`;
  const table = `<div class="mt-8 animate-pulse rounded-2xl border border-border bg-white p-6 shadow-sm">
    <div class="flex justify-between"><div class="h-5 w-48 rounded bg-surface"></div><div class="h-4 w-16 rounded bg-surface"></div></div>
    <div class="mt-6 h-32 rounded-lg bg-surface/60"></div>
  </div>`;
  const cal = `<div class="mt-8 animate-pulse rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
    <div class="flex justify-between gap-4"><div class="h-5 w-40 rounded bg-surface"></div><div class="h-9 w-44 rounded-xl bg-surface"></div></div>
    <div class="mt-6 grid grid-cols-7 gap-1">${"<div class=\"h-16 rounded-sm bg-surface/50\"></div>".repeat(7)}</div>
  </div>`;
  return headingSkel + row4 + sep + headingSkel + row4 + table + cal;
}

export function bindLiderTeamCalendarNavigation(
  container: HTMLElement,
  payload: LiderDashboardPayload | null,
  initialYear: number,
  initialMonthIndex: number,
  options?: {
    loadMonthData?: (target: {
      year: number;
      monthIndex: number;
      visibleStartIso: string;
      visibleEndIso: string;
      weekStartsOn: CalendarWeekStart;
    }) => Promise<LiderDashboardPayload | null>;
  },
): void {
  let currentPayload = payload;
  const weekStartsOn = resolveCalendarWeekStart();
  let currentYear = initialYear;
  let currentMonthIndex = initialMonthIndex;
  let currentView: CalendarViewMode = "month";
  let fetchVersion = 0;
  let selectedMeal: SelectedMealDetail | null = null;
  let weekAnchor = parseIsoLocalDate(currentPayload?.team_calendar.selected_iso_date) ?? new Date(initialYear, initialMonthIndex, 1);
  const replaceable = (): HTMLElement | null => container.querySelector("#lider-calendar-replaceable");
  const ensureAnchorInCurrentMonth = (): void => {
    if (currentView !== "month") return;
    const day = weekAnchor.getDate();
    weekAnchor = new Date(currentYear, currentMonthIndex, Math.min(day, new Date(currentYear, currentMonthIndex + 1, 0).getDate()));
  };
  const paint = (): void => {
    const slot = replaceable();
    if (!slot) return;
    slot.innerHTML = renderLiderTeamCalendarReplaceable(
      currentYear,
      currentMonthIndex,
      currentPayload,
      selectedMeal,
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
    const prevSelected = currentPayload?.team_calendar.selected_iso_date ?? null;
    currentPayload = {
      ...next,
      team_calendar: {
        ...next.team_calendar,
        selected_iso_date: prevSelected ?? next.team_calendar.selected_iso_date,
      },
    };
    paint();
  };

  const wire = (): void => {
    container.querySelector<HTMLButtonElement>("#lid-cal-prev")?.addEventListener("click", () => {
      selectedMeal = null;
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
    container.querySelector<HTMLButtonElement>("#lid-cal-next")?.addEventListener("click", () => {
      selectedMeal = null;
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
    container.querySelector<HTMLButtonElement>("#lid-cal-today")?.addEventListener("click", () => {
      selectedMeal = null;
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      weekAnchor = now;
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#lid-cal-view-month")?.addEventListener("click", () => {
      if (currentView === "month") return;
      currentView = "month";
      selectedMeal = null;
      currentYear = weekAnchor.getFullYear();
      currentMonthIndex = weekAnchor.getMonth();
      paint();
      void requestData();
    });
    container.querySelector<HTMLButtonElement>("#lid-cal-view-week")?.addEventListener("click", () => {
      if (currentView === "week") return;
      currentView = "week";
      selectedMeal = null;
      const now = new Date();
      weekAnchor = now;
      currentYear = now.getFullYear();
      currentMonthIndex = now.getMonth();
      paint();
      void requestData();
    });
  };

  paint();

  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("[data-lider-meal-detail]");
    if (!button) return;
    selectedMeal = {
      dateIso: button.getAttribute("data-lider-meal-date") ?? "",
      employeeName: button.getAttribute("data-lider-meal-employee") ?? "Sin nombre",
      mealType: button.getAttribute("data-lider-meal-type") ?? "Sin tipo",
      mealTime: button.getAttribute("data-lider-meal-time") ?? "Sin hora",
    };
    paint();
  });
}
