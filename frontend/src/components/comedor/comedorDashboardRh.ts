import type {
  ComedorCalendarMonth,
  ComedorKpi,
  ComedorPanelState,
  ComedorSidebarDataset,
} from "../../comedor/rh/types.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "../../ui/uiTokens.ts";
import { renderComedorAlerts } from "./comedorAlerts.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";
import { renderComedorCharts, renderComedorExternalCodesCard } from "./comedorCharts.ts";
import { renderComedorStats } from "./comedorStats.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

export type ComedorDashboardRhViewState = {
  statsState: ComedorPanelState;
  stats: readonly ComedorKpi[] | null;
  statsError: string | null;
  calendarState: ComedorPanelState;
  calendar: ComedorCalendarMonth | null;
  calendarError: string | null;
  sidebarState: ComedorPanelState;
  sidebar: ComedorSidebarDataset | null;
  sidebarError: string | null;
};

function renderHeader(): string {
  return `
    <section class="${RH_LISTADO_SURFACE} rh-comedor-hero rh-sol-hero-card p-5 sm:p-7">
      <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-8">
        <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)] md:pr-4">
          <h1 class="text-[clamp(1.35rem,2.5vw,1.85rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Comedor</h1>
          <p class="mt-3 max-w-[65ch] text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-[1.65]">Monitoreo avanzado de capacidad y planificación mensual del comedor.</p>
        </div>
        <div class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2.5 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:justify-end md:w-auto md:flex-nowrap md:items-center md:justify-end md:gap-2.5">
          <button
            type="button"
            data-comedor-nuevo
            class="${RH_SOLICITUDES_BTN_PRIMARY} w-full min-[520px]:w-auto"
          >
            Nuevo registro
          </button>
        </div>
      </div>
    </section>`;
}

export function renderComedorDashboardRh(state: ComedorDashboardRhViewState): string {
  const sidebar = state.sidebar;
  return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">
      ${renderHeader()}
      ${renderComedorStats(state.statsState, state.stats, state.statsError)}
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
        <div class="flex flex-col gap-4">
          ${renderComedorAlerts(state.sidebarState, sidebar?.alerts ?? null, state.sidebarError)}
          ${renderComedorCharts(state.sidebarState, sidebar?.weeklyOccupancy ?? null, sidebar?.rhPlatillosPorSemana)}
          ${renderComedorExternalCodesCard(state.sidebarState, sidebar?.externalCodesCard ?? null)}
        </div>
      </section>
    </div>`;
}

export function renderComedorForbidden(role: string | null): string {
  const roleLabel = role ? escapeComedorHtml(role) : "sin rol";
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">La vista analítica de comedor es exclusiva para RH. Rol actual: ${roleLabel}.</p>
    </div>`;
}
