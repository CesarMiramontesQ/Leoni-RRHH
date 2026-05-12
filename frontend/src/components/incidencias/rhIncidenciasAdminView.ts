import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { renderRhIncidenciasHeader } from "./rhIncidenciasHeader.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT } from "./rhIncidenciasPageStyles.ts";
import { renderRhIncidenciasAnalyticsSection } from "./rhIncidenciasAnalyticsSection.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";

function renderListadoHeading(vm: RhIncidenciasAdminViewModel): string {
  if (vm.estadisticasStatus === "loading" || vm.tableStatus === "loading" || vm.tableStatus === "error") {
    return "";
  }
  const total = vm.table?.total ?? 0;
  return `
    <section class="mb-2 shrink-0" aria-labelledby="rh-inc-listado-heading">
      <h2 id="rh-inc-listado-heading" class="text-sm font-semibold tracking-tight text-[color:var(--color-text-primary)] sm:text-base">${escapeIncHtml(INC_COPY.listadoTitulo)}</h2>
      <p class="mt-0.5 text-xs font-medium text-[color:var(--color-text-secondary)] sm:text-sm">${escapeIncHtml(INC_COPY.listadoSubtitulo(total))}</p>
    </section>`;
}

/** Vista administrativa de incidencias (rol RH): encabezado, analítica, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  const listadoBloque = `
      ${renderListadoHeading(vm)}
      <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>`;

  return `
    <div id="rh-incidencias-root" class="rh-incidencias-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="shrink-0">${renderRhIncidenciasHeader()}</div>
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div class="shrink-0">${renderRhIncidenciasAnalyticsSection(vm)}</div>
      <details class="mt-4 flex min-h-0 flex-1 flex-col lg:mt-6 lg:flex lg:flex-1 lg:flex-col" open>
        <summary class="mb-2 flex cursor-pointer list-none items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-sm lg:hidden [&::-webkit-details-marker]:hidden">
          <span>${escapeIncHtml(INC_COPY.listadoTitulo)}</span>
          <span class="text-xs font-normal text-[color:var(--color-text-muted)]">${escapeIncHtml(INC_COPY.listadoDetalleToggle)}</span>
        </summary>
        <div class="flex min-h-0 flex-1 flex-col">
          ${listadoBloque}
        </div>
      </details>
    </div>`;
}
