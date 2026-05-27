/**
 * Fila de gráficas del dashboard supervisor (incidencias + home office por día).
 */
import type {
  SupervisorHomeOfficeWeekdayChartData,
  SupervisorIncidenciasChartData,
} from "../../dashboard/lider/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { SUPERVISOR_CHARTS_PLOT_HEIGHT_PX } from "./supervisorChartsLayout.ts";
import { renderSupervisorHomeOfficeWeekdayChartCard } from "./liderSupervisorHomeOfficeWeekdayChart.ts";
import { renderSupervisorIncidenciasChartCard } from "./liderSupervisorIncidenciasChart.ts";

export function renderSupervisorChartsSection(
  incidencias: SupervisorIncidenciasChartData | null,
  hoWeekday: SupervisorHomeOfficeWeekdayChartData | null,
): string {
  if (!incidencias && !hoWeekday) return "";

  return `
    <section
      id="lider-supervisor-charts"
      class="mt-8"
      aria-label="Gráficas del equipo"
    >
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <div class="${RH_LISTADO_SURFACE} flex h-full min-h-0 min-w-0 flex-col p-5 sm:p-6">
          ${renderSupervisorIncidenciasChartCard(incidencias)}
        </div>
        <div class="${RH_LISTADO_SURFACE} flex h-full min-h-0 min-w-0 flex-col p-5 sm:p-6">
          ${renderSupervisorHomeOfficeWeekdayChartCard(hoWeekday)}
        </div>
      </div>
    </section>`;
}

export function renderSupervisorChartsSkeleton(): string {
  const card = `<div class="${RH_LISTADO_SURFACE} flex h-full min-h-0 min-w-0 flex-col animate-pulse p-5 sm:p-6">
    <div class="h-6 w-56 max-w-full rounded bg-slate-200"></div>
    <div class="mt-2 h-4 w-full max-w-sm rounded bg-slate-100"></div>
    <div class="mt-6 rounded-xl bg-slate-50" style="height:${SUPERVISOR_CHARTS_PLOT_HEIGHT_PX}px"></div>
  </div>`;
  return `
    <section class="mt-8" aria-hidden="true">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">${card}${card}</div>
    </section>`;
}
