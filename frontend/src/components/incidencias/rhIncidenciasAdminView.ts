import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { renderRhIncidenciasFiltersSection } from "./rhIncidenciasFilters.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "./rhIncidenciasPageStyles.ts";
import { renderRhIncidenciasKpiSection } from "./rhIncidenciasAnalyticsSection.ts";
import { renderRhIncidenciasTable } from "./rhIncidenciasTable.ts";

function renderIncidenciasExportToolbar(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "error") return "";
  return `
    <div class="flex shrink-0 justify-end">
      <button
        type="button"
        id="rh-inc-export"
        class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary w-full shrink-0 sm:w-auto"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-slate-600" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        ${escapeIncHtml(INC_COPY.exportar)}
      </button>
    </div>`;
}

function renderListadoHeading(vm: RhIncidenciasAdminViewModel): string {
  const esperandoEstadisticas =
    vm.ui.mostrarTarjetasEstadisticas && vm.estadisticasStatus === "loading";
  if (esperandoEstadisticas || vm.tableStatus === "loading" || vm.tableStatus === "error") {
    return "";
  }
  const total = vm.table?.total ?? 0;
  return `
    <section class="mb-3 shrink-0 sm:mb-4" aria-labelledby="rh-inc-listado-heading">
      <div class="min-w-0">
        <h2 id="rh-inc-listado-heading" class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-lg">${escapeIncHtml(INC_COPY.listadoTitulo)}</h2>
        <p class="mt-0.5 text-xs font-medium leading-relaxed text-[color:var(--color-text-secondary)] sm:text-sm">${escapeIncHtml(INC_COPY.listadoSubtitulo(total))}</p>
      </div>
    </section>`;
}

/** Vista administrativa de incidencias (rol RH): encabezado, analítica, filtros y tabla. */
export function renderRhIncidenciasAdminView(vm: RhIncidenciasAdminViewModel): string {
  const listadoBloque = `
      ${renderListadoHeading(vm)}
      <div id="rh-inc-table" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasTable(vm)}</div>`;

  const kpiHtml = renderRhIncidenciasKpiSection(vm);
  const kpiBlock = kpiHtml ? `<div class="shrink-0">${kpiHtml}</div>` : "";

  return `
    <div id="rh-incidencias-root" class="rh-incidencias-module ${RH_LISTADO_PAGE_OUTER_GRADIENT} gap-4 sm:gap-5">
      ${renderIncidenciasExportToolbar(vm)}
      <div id="rh-inc-filters" class="shrink-0">${renderRhIncidenciasFiltersSection(vm)}</div>
      ${kpiBlock}
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
