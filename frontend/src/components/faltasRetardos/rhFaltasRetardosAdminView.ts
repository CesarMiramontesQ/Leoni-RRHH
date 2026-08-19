import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderRhFaltasRetardosKpiSection } from "./rhFaltasRetardosAnalyticsSection.ts";
import { renderRhFaltasRetardosFiltersSection } from "./rhFaltasRetardosFilters.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "./rhFaltasRetardosPageStyles.ts";
import { renderRhFaltasRetardosTable } from "./rhFaltasRetardosTable.ts";

/**
 * Descarga del reporte semanal en Excel. Va detrás del mismo gate que «Nuevo registro»
 * (`canCrearFaltaRetardo`): es una superficie de RH. Supervisor, gerente y director ven
 * la página —lo que llega de nómina— pero no este botón, y el endpoint les responde 403.
 */
function renderDescargarReporteButton(vm: FaltasRetardosAdminViewModel): string {
  const cargando = vm.descargandoReporte === true;
  const etiqueta = cargando ? FR_COPY.descargarReporteGenerando : FR_COPY.descargarReporte;
  return `
      <button
        type="button"
        id="rh-fr-descargar-reporte"
        class="${RH_SOLICITUDES_BTN_SECONDARY} min-h-11 w-full justify-center sm:w-auto"
        aria-label="${escapeHtml(FR_COPY.descargarReporteAria)}"
        ${cargando ? 'disabled aria-busy="true"' : ""}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L6.28 6.97a.75.75 0 1 0-1.06 1.06l4.25 4.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 1 0-1.06-1.06l-2.97 2.97V2.75Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1.5Z" /></svg>
        ${escapeHtml(etiqueta)}
      </button>`;
}

/**
 * Sin botón de sincronizar: el mirror FI/RE corre en el job semanal del backend.
 * Toda la barra es de RH: supervisor y gerente consultan lo que llega de nómina, no
 * capturan ni descargan el reporte.
 */
function renderActionsToolbar(vm: FaltasRetardosAdminViewModel): string {
  if (!vm.puedeCrear) return "";
  return `
    <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3" role="toolbar" aria-label="${escapeHtml(FR_COPY.tituloPagina)}">
      ${renderDescargarReporteButton(vm)}
      <button
        type="button"
        id="rh-fr-nuevo"
        class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 w-full justify-center sm:w-auto"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
        ${escapeHtml(FR_COPY.nuevo)}
      </button>
    </div>`;
}

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
      ${renderActionsToolbar(vm)}
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
