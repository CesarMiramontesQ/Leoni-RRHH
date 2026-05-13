import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT } from "./rhIncidenciasPageStyles.ts";
import { renderRhIncidenciasAnalyticsSection } from "./rhIncidenciasAnalyticsSection.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";

function renderListadoHeading(vm: RhIncidenciasAdminViewModel): string {
  if (vm.estadisticasStatus === "loading" || vm.tableStatus === "loading" || vm.tableStatus === "error") {
    return "";
  }
  const total = vm.table?.total ?? 0;
  const totalBadge =
    total > 0
      ? `<span class="hidden shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm sm:inline-flex">
        ${escapeIncHtml(INC_COPY.mostrando(1, Math.min(total, 10), total))}
      </span>`
      : "";
  return `
    <section class="mb-3 flex shrink-0 flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="rh-inc-listado-heading">
      <div class="min-w-0">
        <h2 id="rh-inc-listado-heading" class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-lg">${escapeIncHtml(INC_COPY.listadoTitulo)}</h2>
        <p class="mt-0.5 text-xs font-medium leading-relaxed text-[color:var(--color-text-secondary)] sm:text-sm">${escapeIncHtml(INC_COPY.listadoSubtitulo(total))}</p>
      </div>
      ${totalBadge}
    </section>`;
}

/** Vista administrativa de incidencias (rol RH): encabezado, analítica, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  const listadoBloque = `
      ${renderListadoHeading(vm)}
      <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>`;

  return `
    <div id="rh-incidencias-root" class="rh-incidencias-module ${RH_LISTADO_PAGE_OUTER_GRADIENT} gap-4 sm:gap-5">
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      <div class="shrink-0">${renderRhIncidenciasAnalyticsSection(vm)}</div>
      <details class="mt-4 flex min-h-0 flex-1 flex-col lg:mt-6 lg:flex lg:flex-1 lg:flex-col" open>
        <summary class="mb-3 flex cursor-pointer list-none items-center justify-between rounded-xl border border-[rgba(148,163,184,0.28)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-sm lg:hidden [&::-webkit-details-marker]:hidden">
          <span>${escapeIncHtml(INC_COPY.listadoTitulo)}</span>
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
            ${escapeIncHtml(INC_COPY.listadoDetalleToggle)}
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" /></svg>
          </span>
        </summary>
        <div class="flex min-h-0 flex-1 flex-col">
          ${listadoBloque}
        </div>
      </details>
    </div>`;
}
