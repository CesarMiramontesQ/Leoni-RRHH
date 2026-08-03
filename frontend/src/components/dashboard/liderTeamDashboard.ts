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
import { renderSupervisorChartsSection, renderSupervisorChartsSkeleton } from "./liderSupervisorChartsSection.ts";
import { SOLICITUDES_HASH_LIDER_EQUIPO_PENDING } from "../../solicitudes/solicitudesPageFilterConfig.ts";
import {
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  badgePending,
} from "../../ui/uiTokens.ts";
import { buildRhCalendarMonthGrid, rhIsoLocalDate } from "../../dashboard/rh/calendarMonthGrid.ts";
import {
  canSeeDashboardTeamCalendar,
  canAccessLiderTeamDashboard,
  getEffectiveGestorNavRol,
  getEmpleadoIdFromAccessToken,
} from "../../auth/jwt.ts";
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
    home_office_dias_anio: p.home_office_dias_anio,
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
    <header class="mb-6">
      <h2 id="${escapeHtml(headingId)}" class="text-xl font-semibold tracking-tight text-text-primary">${escapeHtml(title)}</h2>
      <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">${escapeHtml(subtitle)}</p>
    </header>`;
}

type LiderKpiAccent = "red" | "orange" | "violet" | "blue";

const LIDER_KPI_ICON_WRAP: Record<LiderKpiAccent, string> = {
  red: "rh-dash-kpi-icon rh-dash-kpi-icon--red",
  orange: "rh-dash-kpi-icon rh-dash-kpi-icon--orange",
  violet: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
  blue: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
};

type LiderTeamKpiCardId = "incidencias" | "vacaciones" | "home_office" | "colaboradores";

export function renderLiderTeamStatCards(team: LiderTeamStats | null): string {
  const t = team;
  const rolLider = getEffectiveGestorNavRol();
  const esGerente = rolLider === "gerente";
  const esSupervisor = rolLider === "supervisor";
  const cards: Array<{
    id: LiderTeamKpiCardId;
    title: string;
    accent: LiderKpiAccent;
    icon: string;
    value: string;
    sub: string;
  }> = [
    {
      id: "incidencias",
      title: "Incidencias activas",
      accent: "red",
      icon: iconIncidencias(),
      value: fmtActivas(t?.team_active_incidents ?? null),
      sub: "Incidencias del equipo",
    },
    {
      id: "vacaciones",
      title: "Vacaciones por aprobar",
      accent: "orange",
      icon: iconVacPend(),
      value: fmtPendientes(t?.team_pending_vacation_requests ?? null),
      sub: "Pendientes de aprobación",
    },
    {
      id: "home_office",
      title: "Home Office pendientes",
      accent: "violet",
      icon: iconHoPend(),
      value: fmtPendientes(t?.team_pending_home_office_requests ?? null),
      sub: "Home Office por aprobar",
    },
    {
      id: "colaboradores",
      title: esGerente ? "Miembro de mi equipo" : "Total colaboradores",
      accent: "blue",
      icon: iconColaboradores(),
      value: fmtPersonas(t?.team_collaborators_count ?? null),
      sub: esGerente ? "Todos los niveles bajo tu mando" : "Equipo directo",
    },
  ];

  const visibleCards = esSupervisor
    ? cards.filter((c) => c.id !== "incidencias" && c.id !== "colaboradores")
    : cards;

  const html = visibleCards
    .map(
      (c) => `
    <article class="rh-dash-kpi-card flex h-full flex-col rounded-[18px] p-5">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-medium text-text-muted">${escapeHtml(c.title)}</h2>
        <div class="flex shrink-0 rounded-[14px] p-2 ${LIDER_KPI_ICON_WRAP[c.accent]}" aria-hidden="true">
          ${c.icon}
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold tracking-tight text-text-primary">${escapeHtml(c.value)}</p>
      <p class="mt-1 text-sm text-text-muted">${escapeHtml(c.sub)}</p>
    </article>`,
    )
    .join("");

  const gridClass = esSupervisor
    ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
    : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";

  return `<div class="${gridClass}">${html}</div>`;
}

function approvalTypeLabel(tp: LiderApprovalRequestType): string {
  switch (tp) {
    case "vacation":
      return "Vacaciones";
    case "home_office":
      return "Home Office";
    case "permiso_sin_goce":
      return "Permiso sin goce";
    case "goce_sueldo":
      return "Permiso con goce";
    case "permiso":
      return "Permiso";
    case "incidencia":
      return "Incidencia";
    default:
      return "Solicitud";
  }
}

/** Misma familia visual que el botón “ver” en listado de solicitudes (`rhSolicitudesAdminView`). */
function iconLiderVerDetalle(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
}

/** Botón compacto de fila: token RH_LISTADO_BTN_SECONDARY + tamaño tabla densa. */
const LIDER_ROW_BTN_VER_DETALLE = `${RH_LISTADO_BTN_SECONDARY} inline-flex items-center gap-1.5 text-xs px-3 py-1.5`;

function renderApprovalRequestsCard(requests: LiderApprovalRequestRow[]): string {
  const empty =
    requests.length === 0 ?
      `<div class="rounded-xl border border-dashed border-slate-200/90 bg-gradient-to-br from-slate-50/80 to-white px-4 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p class="text-sm font-semibold text-text-primary">No hay solicitudes pendientes por aprobar</p>
        <p class="mt-1 text-xs text-text-muted">Las solicitudes de tu equipo aparecerán aquí.</p>
      </div>`
    : `
      <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <table class="min-w-full w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-[#e5e7eb] bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <th scope="col" class="w-[24%] min-w-0 py-3 pr-3 pl-4 sm:pl-5">Colaborador</th>
              <th scope="col" class="w-[19%] min-w-0 py-3 pr-3">Tipo</th>
              <th scope="col" class="w-[22%] min-w-0 py-3 pr-3">Fechas</th>
              <th scope="col" class="w-[17%] min-w-0 py-3 pr-3">Estatus</th>
              <th scope="col" class="w-[18%] min-w-0 py-3 pr-4 text-right sm:pr-5">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#e5e7eb]/80">
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
              <tr class="bg-white transition-colors hover:bg-slate-50/70">
                <td class="min-w-0 py-3 pr-3 pl-4 align-middle sm:pl-5">
                  <div class="flex min-w-0 items-center gap-3">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-full border border-blue-200/60 bg-blue-50/90 text-xs font-bold text-[#1e40af] shadow-[0_1px_0_rgba(255,255,255,0.9)]">${ini}</span>
                    <span class="min-w-0 truncate font-semibold text-text-primary">${name}</span>
                  </div>
                </td>
                <td class="min-w-0 py-3 pr-3 align-middle text-text-primary">${escapeHtml(approvalTypeLabel(r.request_type))}</td>
                <td class="min-w-0 py-3 pr-3 align-middle text-text-muted">${escapeHtml(r.date_range)}</td>
                <td class="min-w-0 py-3 pr-3 align-middle">
                  ${badgePending(r.status)}
                </td>
                <td class="min-w-0 py-3 pr-4 align-middle text-right sm:pr-5">
                  <button
                    type="button"
                    class="${LIDER_ROW_BTN_VER_DETALLE}"
                    data-lider-solicitud-detalle="${escapeHtml(r.id)}"
                    title="Ver detalle de la solicitud"
                  >
                    ${iconLiderVerDetalle()}
                    Ver detalles
                  </button>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

  return `
    <section class="${RH_LISTADO_SURFACE} mt-8 p-5 sm:p-6" aria-label="Solicitudes de aprobación">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Solicitudes de aprobación</h2>
          <p class="mt-1 text-sm text-text-muted">Abre el detalle de cada solicitud para aprobar, rechazar o solicitar cambios.</p>
        </div>
        <a href="${SOLICITUDES_HASH_LIDER_EQUIPO_PENDING}" class="mt-2 shrink-0 text-sm font-semibold text-leoni-blue transition hover:text-leoni-blue-light sm:mt-0">Ver todas</a>
      </div>
      <div class="mt-5">
        ${empty}
      </div>
    </section>`;
}

function esSolicitudPersonal(line: TeamCalendarLine, currentUserId: string | null): boolean {
  return Boolean(currentUserId && line.owner_id && currentUserId === line.owner_id);
}

function esComidaPersonal(line: TeamCalendarLine, currentUserId: string | null): boolean {
  if (line.kind !== "meal") return false;
  return Boolean(line.meal_empleado_id && currentUserId && currentUserId === line.meal_empleado_id);
}

/** Estilos por categoría visual: solicitud/comida propia vs equipo (sin cambiar datos ni textos funcionales). */
function esLineaSolicitudEquipoCal(line: TeamCalendarLine): boolean {
  return (
    line.kind === "vacation" ||
    line.kind === "home_office" ||
    line.kind === "permiso_sin_goce" ||
    line.kind === "goce_sueldo"
  );
}

function teamLineClass(line: TeamCalendarLine, currentUserId: string | null): string {
  if (esLineaSolicitudEquipoCal(line)) {
    const personal = esSolicitudPersonal(line, currentUserId);
    return personal
      ? "rounded-md bg-blue-500/14 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-blue-950 md:text-[11px]"
      : "rounded-md bg-violet-500/14 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-violet-950 md:text-[11px]";
  }
  switch (line.kind) {
    case "meal":
      return esComidaPersonal(line, currentUserId)
        ? "rounded-md bg-emerald-500/14 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-emerald-950 md:text-[11px]"
        : "rounded-md bg-orange-500/14 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-orange-950 md:text-[11px]";
    case "incident":
      return "rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-red-800 md:text-[11px]";
    default:
      return "rounded-md px-1.5 py-0.5 text-[10px] text-text-muted md:text-[11px]";
  }
}

function mealLineIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 3v6a2.5 2.5 0 0 0 5 0V3M7 3v18m8-18v8m0 0c0 1.1.9 2 2 2h.5M15 11v10" /></svg>`;
}

function renderTeamLineText(line: TeamCalendarLine, currentRole: string | null, currentUserId: string | null): string {
  if (
    esLineaSolicitudEquipoCal(line) &&
    (line.request_status === "approved" || line.request_status === "pending") &&
    line.request_tipo
  ) {
    return getCalendarRequestBadge({
      userRole: currentRole,
      currentUserId,
      ownerId: line.owner_id ?? null,
      ownerName: line.owner_name ?? null,
      estado: line.request_status,
      tipo: line.request_tipo,
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

function teamCalendarMobileDots(entry: TeamCalendarDayEntry | undefined, currentUserId: string | null): string {
  if (!entry?.lines?.length) return "";
  const dots: string[] = [];
  const reqLines = entry.lines.filter((l) => esLineaSolicitudEquipoCal(l));
  const mealLines = entry.lines.filter((l) => l.kind === "meal");

  const hasPersonalReq = reqLines.some((l) => esSolicitudPersonal(l, currentUserId));
  const hasTeamReq = reqLines.some((l) => !esSolicitudPersonal(l, currentUserId));
  const hasPersonalMeal = mealLines.some((l) => esComidaPersonal(l, currentUserId));
  const hasTeamMeal = mealLines.some((l) => !esComidaPersonal(l, currentUserId));

  if (hasPersonalReq) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-blue-600" title="Solicitudes propias"></span>');
  }
  if (hasTeamReq) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-violet-600" title="Solicitudes del equipo"></span>');
  }
  if (hasPersonalMeal) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-emerald-600" title="Comidas propias"></span>');
  }
  if (hasTeamMeal) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-orange-500" title="Comidas del equipo"></span>');
  }
  if (entry.lines.some((l) => l.kind === "incident")) {
    dots.push('<span class="size-1.5 shrink-0 rounded-full bg-red-500" title="Incidencias"></span>');
  }
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
  const currentRole = getEffectiveGestorNavRol();
  const currentUserId = getEmpleadoIdFromAccessToken();

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
                return `<span class="truncate ${teamLineClass(ln, currentUserId)}">${escapeHtml(renderTeamLineText(ln, currentRole, currentUserId))}</span>`;
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
              const selectedClass = isMealSelected ? "ring-1 ring-inset ring-[var(--color-outline)]/55" : "";
              const summaryText = escapeHtml(ln.text);
              return `<button
                type="button"
                class="inline-flex max-w-full items-center gap-1 truncate text-left ${teamLineClass(ln, currentUserId)} ${selectedClass}"
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

  const dotsMobile = hasContent ? teamCalendarMobileDots(entry, currentUserId) : "";

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
        `<div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${slice
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
      `<div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${weekDates
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
    <div
      class="lider-cal-legend flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs leading-snug text-text-muted"
      aria-label="Leyenda del calendario"
    >
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[3px] bg-blue-500/35 ring-1 ring-blue-700/25" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Solicitudes personales</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[3px] bg-violet-500/35 ring-1 ring-violet-800/22" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Solicitudes del equipo</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[3px] bg-emerald-500/35 ring-1 ring-emerald-800/22" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Comidas personales</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[3px] bg-orange-500/35 ring-1 ring-orange-800/25" aria-hidden="true"></span>
        <span class="font-medium text-text-primary">Comidas del equipo</span>
      </span>
    </div>`;

  const weekHeader = getCalendarWeekdayLabels(weekStartsOn)
    .map(
      (d) =>
        `<div role="columnheader" class="rh-cal-colhead py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">${d}</div>`,
    )
    .join("");

  const hasMealSelected = Boolean(selectedMeal);
  const mealDetail =
    hasMealSelected ?
      `<div
      id="lider-meal-detail-panel"
      class="mt-4 rounded-xl border border-[rgba(148,163,184,0.22)] bg-gradient-to-br from-blue-50/90 to-white px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
    >
      <p id="lider-meal-detail-title" class="text-xs font-semibold uppercase tracking-wide text-leoni-blue">Detalle de comida</p>
      <p id="lider-meal-detail-main" class="mt-1 text-sm font-semibold text-text-primary">${escapeHtml(
        `${selectedMeal?.employeeName ?? "Sin nombre"} · ${selectedMeal?.mealType ?? "Sin tipo"}`,
      )}</p>
      <p id="lider-meal-detail-meta" class="text-xs text-text-muted">${escapeHtml(
        `Fecha: ${selectedMeal?.dateIso ?? ""} · Hora: ${selectedMeal?.mealTime ?? "Sin hora"}`,
      )}</p>
    </div>`
    : "";

  const currentRole = getEffectiveGestorNavRol();
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
                      class="inline-flex max-w-full items-center gap-1 truncate text-left ${teamLineClass(ln, currentUserId)}"
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
                  return `<span class="truncate ${teamLineClass(ln, currentUserId)}">${escapeHtml(renderTeamLineText(ln, currentRole, currentUserId))}</span>`;
                })
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
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Calendario del equipo</h2>
          <p class="mt-1 max-w-xl text-sm text-text-muted">Vacaciones, home office y comidas: colores distinguen tus registros y los del equipo.</p>
        </div>
        <div class="rh-cal-toolbar flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div class="rh-cal-seg" role="group" aria-label="Vista del calendario">
            <button
              type="button"
              id="lid-cal-view-month"
              data-lid-cal-view="month"
              class="rh-cal-seg__btn ${viewMode === "month" ? "rh-cal-seg__btn--active" : ""}"
            >
              Mes
            </button>
            <button
              type="button"
              id="lid-cal-view-week"
              data-lid-cal-view="week"
              class="rh-cal-seg__btn ${viewMode === "week" ? "rh-cal-seg__btn--active" : ""}"
            >
              Semana
            </button>
          </div>
          <div class="rh-cal-nav-cluster inline-flex min-w-0 flex-wrap items-center justify-center gap-0.5 rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-white/90 p-0.5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
            <button
              type="button"
              id="lid-cal-prev"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana anterior" : "Mes anterior"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <p id="lid-cal-month-label" class="min-w-0 max-w-[min(100%,14rem)] shrink px-2 py-1 text-center text-sm font-semibold text-text-primary sm:min-w-44 sm:max-w-none">${title}</p>
            <button
              type="button"
              id="lid-cal-next"
              class="${CAL_NAV_BTN_CLASS} rh-cal-nav-icon-btn"
              aria-label="${viewMode === "week" ? "Semana siguiente" : "Mes siguiente"}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <button
            type="button"
            id="lid-cal-today"
            class="rh-cal-today-btn rounded-xl border border-[rgba(148,163,184,0.26)] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.28)] hover:bg-[rgba(219,234,254,0.45)] hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Ir al mes actual"
          >
            Hoy
          </button>
        </div>
      </div>
      <div class="mt-4 border-t border-border/50 pb-3 pt-2">
        ${legend}
      </div>
    </header>
    <div class="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-5 pt-4 sm:mx-0 sm:overflow-visible sm:px-6 sm:pb-6 sm:pt-5">
      ${viewMode === "week"
        ? weeklyPlanner
        : `<div
            role="grid"
            aria-label="Calendario del equipo"
            class="rh-cal-grid-shell flex min-w-136 flex-col gap-1 sm:min-w-0"
          >
            <div role="row" class="rh-cal-row grid grid-cols-7 gap-1">${weekHeader}</div>
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
    <section class="rh-cal-card mt-8 overflow-hidden rounded-[20px]" aria-label="Calendario del equipo">
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
  const liderChartsHtml = canAccessLiderTeamDashboard()
      ? renderSupervisorChartsSection(
          p?.supervisor_incidencias_chart ?? null,
          p?.supervisor_ho_weekday_chart ?? null,
        )
      : "";
  const calHtml = canSeeDashboardTeamCalendar()
    ? renderLiderTeamCalendarCard(year, monthIndex, p, selectedMeal)
    : "";

  const teamHeading = renderLiderDashboardSectionHeader(
    "Resumen del equipo",
    "Indicadores generales del desempeño y estado del equipo",
  );
  const personalHeading = renderLiderDashboardSectionHeader(
    "Resumen personal",
    "Información y métricas individuales",
  );

  return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} min-h-0">
      <div class="flex flex-col gap-8 sm:gap-10">
        <section class="lider-dashboard-stats-section" aria-labelledby="lider-dash-section-resumen-personal">
          ${personalHeading}
          ${personalHtml}
        </section>
        <section class="lider-dashboard-stats-section" aria-labelledby="lider-dash-section-resumen-del-equipo">
          ${teamHeading}
          ${teamHtml}
          ${approvalsHtml}
          ${liderChartsHtml}
        </section>
        ${calHtml}
      </div>
    </div>`;
}

export function renderLiderDashboardSkeleton(): string {
  const headingSkel = `
    <header class="mb-6">
      <div class="h-7 w-56 max-w-full animate-pulse rounded-md bg-slate-200/90"></div>
      <div class="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-slate-100"></div>
    </header>`;
  const personalRow = `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    ${`<div class="${RH_LISTADO_SURFACE} animate-pulse p-5">
      <div class="flex justify-between gap-3"><div class="size-11 rounded-full bg-slate-100"></div><div class="h-3 w-24 rounded bg-slate-100"></div></div>
      <div class="mt-4 h-8 w-28 rounded bg-slate-100"></div>
      <div class="mt-2 h-4 w-36 rounded bg-slate-50"></div>
    </div>`.repeat(4)}
  </div>`;
  const esSupervisor = getEffectiveGestorNavRol() === "supervisor";
  const muestraGraficasLider = canAccessLiderTeamDashboard();
  const teamKpiCount = esSupervisor ? 2 : 4;
  const teamKpiGridClass = esSupervisor
    ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
    : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
  const teamRow = `<div class="${teamKpiGridClass}">
    ${`<div class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="flex justify-between gap-3"><div class="h-4 w-32 rounded bg-slate-200"></div><div class="size-10 rounded-xl bg-slate-200"></div></div>
      <div class="mt-4 h-8 w-24 rounded bg-slate-200"></div>
      <div class="mt-3 h-3 w-40 rounded bg-slate-100"></div>
    </div>`.repeat(teamKpiCount)}
  </div>`;
  const table = `<div class="${RH_LISTADO_SURFACE} mt-8 animate-pulse p-6">
    <div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
      <div class="h-6 w-56 rounded bg-slate-200"></div>
      <div class="h-4 w-20 rounded bg-slate-100 sm:self-end"></div>
    </div>
    <div class="mt-6 h-4 w-full max-w-md rounded bg-slate-100"></div>
    <div class="mt-6 h-36 rounded-xl bg-slate-50"></div>
  </div>`;
  const supervisorChartsSkel = muestraGraficasLider ? renderSupervisorChartsSkeleton() : "";
  const cal = canSeeDashboardTeamCalendar()
    ? `<div class="rh-cal-card mt-8 animate-pulse overflow-hidden rounded-[20px] p-4 sm:p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:justify-between">
      <div class="space-y-2"><div class="h-6 w-48 rounded bg-slate-200"></div><div class="h-3 w-full max-w-xs rounded bg-slate-100"></div></div>
      <div class="h-10 w-full max-w-[16rem] rounded-xl bg-slate-100 sm:ml-auto"></div>
    </div>
    <div class="mt-6 grid grid-cols-7 gap-1">${"<div class=\"h-9 rounded-lg bg-slate-100\"></div>".repeat(7)}</div>
    <div class="mt-1 grid grid-cols-7 gap-1">${"<div class=\"h-16 rounded-lg bg-slate-50\"></div>".repeat(7)}</div>
  </div>`
    : "";
  return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} min-h-0">
    <div class="flex flex-col gap-8 sm:gap-10">
      ${headingSkel + personalRow}
      ${headingSkel + teamRow + table + supervisorChartsSkel + cal}
    </div>
  </div>`;
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
