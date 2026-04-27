import type {
  ComedorCalendarMonth,
  ComedorKpi,
  ComedorPanelState,
  ComedorTeamReservationsPage,
} from "../../comedor/rh/types.ts";
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
  tableFilters: { search: string };
};

function renderHeader(): string {
  return `
    <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="mt-1 text-sm text-text-muted">
          Consulta reservas propias y de tu equipo.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" data-comedor-nuevo class="inline-flex items-center rounded-lg bg-leoni-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-leoni-blue-light">
          Agregar comida
        </button>
      </div>
    </section>`;
}

export function renderComedorDashboardLider(state: ComedorDashboardLiderViewState): string {
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      ${renderHeader()}
      ${renderComedorStats(
        state.statsState,
        state.stats,
        state.statsError,
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
      )}
      ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
      ${renderComedorTeamReservationsTable(state.tableState, state.table, state.tableFilters, state.tableError)}
    </div>`;
}
