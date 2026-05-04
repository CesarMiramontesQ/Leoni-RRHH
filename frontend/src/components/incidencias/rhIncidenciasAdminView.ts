import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { renderRhIncidenciasHeader } from "./rhIncidenciasHeader.ts";
import { RH_LISTADO_PAGE_OUTER } from "./rhIncidenciasPageStyles.ts";
import { renderRhIncidenciasSummaryCards } from "./rhIncidenciasSummaryCards.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";

function renderListadoHeading(vm: RhIncidenciasAdminViewModel): string {
  if (vm.resumenStatus === "loading" || vm.tableStatus === "loading" || vm.tableStatus === "error") {
    return "";
  }
  const total = vm.table?.total ?? 0;
  return `
    <section class="mb-3">
      <h2 class="text-lg font-semibold text-slate-900">${escapeIncHtml(INC_COPY.listadoTitulo)}</h2>
      <p class="text-sm text-slate-500">${escapeIncHtml(INC_COPY.listadoSubtitulo(total))}</p>
    </section>`;
}

/** Vista administrativa de incidencias (rol RH): encabezado, KPIs, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  return `
    <div id="rh-incidencias-root" class="${RH_LISTADO_PAGE_OUTER}">
      <div class="shrink-0">${renderRhIncidenciasHeader()}</div>
      <div id="rh-inc-stats" class="shrink-0">${renderRhIncidenciasSummaryCards(vm)}</div>
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div class="flex min-h-0 flex-1 flex-col">
        ${renderListadoHeading(vm)}
        <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>
      </div>
    </div>`;
}
