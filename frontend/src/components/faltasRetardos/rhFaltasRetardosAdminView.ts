import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderRhFaltasRetardosKpiSection } from "./rhFaltasRetardosAnalyticsSection.ts";
import { renderRhFaltasRetardosFiltersSection } from "./rhFaltasRetardosFilters.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT } from "./rhFaltasRetardosPageStyles.ts";
import { renderRhFaltasRetardosTable } from "./rhFaltasRetardosTable.ts";

function renderListadoHeading(vm: FaltasRetardosAdminViewModel): string {
  if (vm.tableStatus === "loading" || vm.tableStatus === "error") return "";
  const total = vm.table?.total ?? 0;
  return `
    <section class="mb-3 shrink-0 sm:mb-4" aria-labelledby="rh-fr-listado-heading">
      <div class="min-w-0">
        <h2 id="rh-fr-listado-heading" class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-lg">${escapeHtml(FR_COPY.listadoTitulo)}</h2>
        <p class="mt-0.5 text-xs font-medium leading-relaxed text-[color:var(--color-text-secondary)] sm:text-sm">${escapeHtml(FR_COPY.listadoSubtitulo(total))}</p>
      </div>
    </section>`;
}

export function renderRhFaltasRetardosAdminView(vm: FaltasRetardosAdminViewModel): string {
  const listadoBloque = `
      ${renderListadoHeading(vm)}
      <div id="rh-fr-table" class="flex min-h-0 flex-1 flex-col">${renderRhFaltasRetardosTable(vm)}</div>`;

  return `
    <div id="rh-faltas-retardos-root" class="rh-faltas-retardos-module rh-incidencias-module ${RH_LISTADO_PAGE_OUTER_GRADIENT} gap-4 sm:gap-5">
      <div id="rh-fr-filters" class="shrink-0">${renderRhFaltasRetardosFiltersSection(vm)}</div>
      ${renderRhFaltasRetardosKpiSection(vm)}
      <details class="mt-4 flex min-h-0 flex-1 flex-col lg:mt-6 lg:flex lg:flex-1 lg:flex-col" open>
        <summary class="mb-3 flex cursor-pointer list-none items-center justify-between rounded-xl border border-[rgba(148,163,184,0.28)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-sm lg:hidden [&::-webkit-details-marker]:hidden">
          <span>${escapeHtml(FR_COPY.listadoTitulo)}</span>
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
            ${escapeHtml(FR_COPY.listadoDetalleToggle)}
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.25a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" /></svg>
          </span>
        </summary>
        <div class="flex min-h-0 flex-1 flex-col">${listadoBloque}</div>
      </details>
    </div>`;
}
