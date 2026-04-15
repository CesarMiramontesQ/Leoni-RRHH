import type { ComedorCalendarMonth, ComedorPanelState } from "../../comedor/rh/types.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";

export type ComedorDashboardEmpleadoViewState = {
  calendarState: ComedorPanelState;
  calendar: ComedorCalendarMonth | null;
  calendarError: string | null;
};

function renderHeader(): string {
  return `
    <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div></div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" data-comedor-nuevo class="inline-flex items-center rounded-lg bg-leoni-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-leoni-blue-light">
          Agregar comida
        </button>
      </div>
    </section>`;
}

export function renderComedorDashboardEmpleado(state: ComedorDashboardEmpleadoViewState): string {
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      ${renderHeader()}
      ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
    </div>`;
}
