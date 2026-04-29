import type {
  ComedorCalendarMonth,
  ComedorKpi,
  ComedorPanelState,
  ComedorRhProximosRegistrosPage,
  ComedorSidebarDataset,
} from "../../comedor/rh/types.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import { renderComedorAlerts } from "./comedorAlerts.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";
import {
  renderComedorCharts,
  renderComedorExternalCodesCard,
  renderComedorSuggestion,
} from "./comedorCharts.ts";
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
    <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="mt-1 text-sm text-text-muted">Monitoreo avanzado de capacidad y planificación mensual del comedor.</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" data-comedor-gestionar class="inline-flex items-center rounded-lg border border-yellow-400 bg-yellow-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-yellow-200">
          Gestionar comedores
        </button>
        <button type="button" data-comedor-planear class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Planear
        </button>
        <button type="button" data-comedor-nuevo class="inline-flex items-center rounded-lg bg-leoni-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-leoni-blue-light">
          Nuevo registro
        </button>
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
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      ${renderHeader()}
      ${renderComedorStats(state.statsState, state.stats, state.statsError)}
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
        <div class="space-y-4">
          ${renderComedorAlerts(state.sidebarState, sidebar?.alerts ?? null, state.sidebarError)}
          ${renderComedorCharts(state.sidebarState, sidebar?.weeklyOccupancy ?? null, sidebar?.rhPlatillosPorSemana)}
          ${renderComedorSuggestion(state.sidebarState, sidebar?.suggestion ?? null)}
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
