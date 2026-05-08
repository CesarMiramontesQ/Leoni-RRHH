import type {
  ComedorCalendarMonth,
  ComedorKpi,
  ComedorPanelState,
  ComedorSupervisorTableSegment,
  ComedorTeamReservationsPage,
} from "../../comedor/rh/types.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "../../ui/uiTokens.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";
import { renderComedorStats } from "./comedorStats.ts";
import { renderComedorTeamReservationsTable } from "./comedorTeamReservationsTable.ts";

export type ComedorDashboardLiderViewState = {
  statsState: ComedorPanelState;
  stats: readonly ComedorKpi[] | null;
  statsError: string | null;
  calendarState: ComedorPanelState;
  calendar: ComedorCalendarMonth | null;
  calendarError: string | null;
  tableState: ComedorPanelState;
  table: ComedorTeamReservationsPage | null;
  tableError: string | null;
  tableFilters: {
    search: string;
    supervisorSegment: ComedorSupervisorTableSegment;
    showSupervisorSegment: boolean;
  };
};

function renderHeader(): string {
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div class="rh-sol-hero__copy min-w-0 flex-1">
          <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Comedor</h1>
          <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">
            Consulta reservas propias y de tu equipo.
          </p>
        </div>
        <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <button type="button" data-comedor-nuevo class="${RH_SOLICITUDES_BTN_PRIMARY} w-full sm:w-auto">
            Agregar comida
          </button>
        </div>
      </div>
    </section>`;
}

export function renderComedorDashboardLider(state: ComedorDashboardLiderViewState): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">
      ${renderHeader()}
      ${renderComedorStats(
        state.statsState,
        state.stats,
        state.statsError,
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
      )}
      ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
      ${renderComedorTeamReservationsTable(state.tableState, state.table, state.tableFilters, state.tableError)}
    </div>`;
}
