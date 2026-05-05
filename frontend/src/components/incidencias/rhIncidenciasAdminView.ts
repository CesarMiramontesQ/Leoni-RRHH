import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { renderRhIncidenciasHeader } from "./rhIncidenciasHeader.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT } from "./rhIncidenciasPageStyles.ts";
import { renderRhIncidenciasSummaryCards } from "./rhIncidenciasSummaryCards.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";

function renderListadoHeading(vm: RhIncidenciasAdminViewModel): string {
  if (vm.resumenStatus === "loading" || vm.tableStatus === "loading" || vm.tableStatus === "error") {
    return "";
  }
  const total = vm.table?.total ?? 0;
  return `
    <section class="mb-1 shrink-0 sm:mb-2" aria-labelledby="rh-inc-listado-heading">
      <h2 id="rh-inc-listado-heading" class="text-base font-semibold tracking-tight text-[#0f172a]">${escapeIncHtml(INC_COPY.listadoTitulo)}</h2>
      <p class="mt-1 text-xs font-medium text-[#64748b] sm:text-sm">${escapeIncHtml(INC_COPY.listadoSubtitulo(total))}</p>
    </section>`;
}

/** Vista administrativa de incidencias (rol RH): encabezado, KPIs, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  return `
    <div id="rh-incidencias-root" class="rh-incidencias-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="shrink-0">${renderRhIncidenciasHeader()}</div>
      <div id="rh-inc-stats" class="shrink-0">${renderRhIncidenciasSummaryCards(vm)}</div>
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div class="flex min-h-0 flex-1 flex-col">
        ${renderListadoHeading(vm)}
        <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>
      </div>
    </div>`;
}
