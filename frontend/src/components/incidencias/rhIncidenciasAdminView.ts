import { renderRhIncidenciasHeader } from "./rhIncidenciasHeader.ts";
import { renderRhIncidenciasSummaryCards } from "./rhIncidenciasSummaryCards.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";

/** Vista administrativa de incidencias (rol RH): encabezado, KPIs, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  return `
    <div id="rh-incidencias-root" class="space-y-8">
      ${renderRhIncidenciasHeader()}
      <div id="rh-inc-stats">${renderRhIncidenciasSummaryCards(vm)}</div>
      <div id="rh-inc-filters">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div id="rh-inc-table">${renderRhIncidenciasTable(vm)}</div>
    </div>`;
}
