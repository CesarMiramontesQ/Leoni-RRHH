import type {
  ComedorCalendarMonth,
  ComedorKpi,
  ComedorPanelState,
  ComedorRhProximosRegistrosPage,
  ComedorSidebarDataset,
} from "../../comedor/rh/types.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "../../ui/uiTokens.ts";
import { renderComedorAlerts } from "./comedorAlerts.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";
import { renderComedorCharts, renderComedorExternalCodesCard } from "./comedorCharts.ts";
import { renderComedorRhProximosRegistrosTable } from "./comedorRhProximosRegistrosTable.ts";
import type { ComedorTableFiltersState } from "./comedorReservationsTable.ts";
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
  tableFilters: ComedorTableFiltersState;
  futurosRhState: ComedorPanelState;
  futurosRh: ComedorRhProximosRegistrosPage | null;
  futurosRhError: string | null;
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
            data-comedor-gestionar
            class="rh-comedor-btn-gestionar order-3 inline-flex min-h-10 w-full min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/45 focus-visible:ring-offset-2 min-[520px]:w-auto md:order-1"
          >
            Gestionar comedores
          </button>
          <button
            type="button"
            data-comedor-planear
            class="${RH_SOLICITUDES_BTN_SECONDARY} order-2 w-full min-[520px]:w-auto"
          >
            Planear
          </button>
          <button
            type="button"
            data-comedor-nuevo
            class="${RH_SOLICITUDES_BTN_PRIMARY} order-1 w-full min-[520px]:w-auto md:order-3"
          >
            Nuevo registro
          </button>
        </div>
      </div>
    </section>`;
}

export function renderComedorDashboardRh(state: ComedorDashboardRhViewState): string {
  const sidebar = state.sidebar;
  const esRh = getRolFromAccessToken() === "rh";
  const bloqueFuturosRh = esRh
    ? renderComedorRhProximosRegistrosTable(
        state.futurosRhState,
        state.futurosRh,
        state.futurosRhError,
        state.tableFilters,
      )
    : "";
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
      ${bloqueFuturosRh}
    </div>`;
}

export function renderComedorForbidden(role: string | null): string {
  const roleLabel = role ? escapeComedorHtml(role) : "sin rol";
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">La vista analítica de comedor es exclusiva para RH. Rol actual: ${roleLabel}.</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al dashboard</a>
    </div>`;
}
