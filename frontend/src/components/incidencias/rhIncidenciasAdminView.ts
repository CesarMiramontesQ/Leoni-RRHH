import { renderRhIncidenciasHeader } from "./rhIncidenciasHeader.ts";
import { renderRhIncidenciasSummaryCards } from "./rhIncidenciasSummaryCards.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";

/** Vista administrativa de incidencias (rol RH): encabezado, KPIs, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  return `
    <div id="rh-incidencias-root" class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <div class="shrink-0">${renderRhIncidenciasHeader()}</div>
      <div id="rh-inc-stats" class="shrink-0">${renderRhIncidenciasSummaryCards(vm)}</div>
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>
    </div>`;
}
