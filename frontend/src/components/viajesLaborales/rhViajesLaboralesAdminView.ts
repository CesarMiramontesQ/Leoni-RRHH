import type { ViajeLaboralEstadoOption } from "../../api/viajesLaborales.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import type { ViajesLaboralesAdminViewModel } from "../../viajesLaborales/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderRhViajesLaboralesKpiSection } from "./rhViajesLaboralesAnalyticsSection.ts";
import { renderRhViajesLaboralesFiltersSection } from "./rhViajesLaboralesFilters.ts";
import { RH_LISTADO_PAGE_OUTER_GRADIENT } from "./rhViajesLaboralesPageStyles.ts";
import { renderRhViajesLaboralesTable } from "./rhViajesLaboralesTable.ts";

export function renderRhViajesLaboralesAdminView(
  vm: ViajesLaboralesAdminViewModel,
  estados: ViajeLaboralEstadoOption[],
): string {
  const listadoBloque = `
    <section class="mb-3 shrink-0 sm:mb-4">
      <h2 class="text-base font-bold text-[color:var(--color-text-primary)] sm:text-lg">${escapeHtml(VL_COPY.listadoTitulo)}</h2>
      <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)] sm:text-sm">${escapeHtml(VL_COPY.listadoSubtitulo(vm.table?.total ?? 0))}</p>
    </section>
    <div id="rh-vl-table" class="flex min-h-0 flex-1 flex-col">${renderRhViajesLaboralesTable(vm)}</div>`;

  return `
    <div id="rh-viajes-laborales-root" class="rh-viajes-laborales-module ${RH_LISTADO_PAGE_OUTER_GRADIENT} gap-4 sm:gap-5">
      <div id="rh-vl-filters" class="shrink-0">${renderRhViajesLaboralesFiltersSection(vm, estados)}</div>
      ${renderRhViajesLaboralesKpiSection(vm)}
      <details class="mt-4 flex min-h-0 flex-1 flex-col lg:mt-6 lg:flex lg:flex-1 lg:flex-col" open>
        <summary class="mb-3 flex cursor-pointer list-none items-center justify-between rounded-xl border border-[rgba(148,163,184,0.28)] bg-white px-4 py-3 text-sm font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
          <span>${escapeHtml(VL_COPY.listadoTitulo)}</span>
        </summary>
        <div class="flex min-h-0 flex-1 flex-col">${listadoBloque}</div>
      </details>
    </div>`;
}
