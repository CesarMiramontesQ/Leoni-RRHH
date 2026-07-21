import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderRhFaltasRetardosKpiSection } from "./rhFaltasRetardosAnalyticsSection.ts";
import { renderRhFaltasRetardosFiltersSection } from "./rhFaltasRetardosFilters.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhFaltasRetardosPageStyles.ts";
import { renderRhFaltasRetardosTable } from "./rhFaltasRetardosTable.ts";

/** Sync: accent filled — contraste frente al navy de Nuevo (rh-sol-btn-primary). */
const FR_BTN_SYNC =
  "rh-fr-btn-sync inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function renderActionsToolbar(vm: FaltasRetardosAdminViewModel): string {
  const syncBusy = Boolean(vm.sincronizando);
  const syncLabel = syncBusy ? FR_COPY.sincronizando : FR_COPY.sincronizar;

  return `
    <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3" role="toolbar" aria-label="${escapeHtml(FR_COPY.tituloPagina)}">
      <button
        type="button"
        id="rh-fr-sync"
        class="${FR_BTN_SYNC} min-h-11 w-full justify-center sm:w-auto"
        ${syncBusy ? 'disabled aria-busy="true"' : ""}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 ${syncBusy ? "animate-spin" : ""}" aria-hidden="true"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311-1.414 1.414.312.311a7.5 7.5 0 0 0 12.547-3.366l1.437.375a9 9 0 0 1-15.056 4.04l-.312.311-1.414-1.414.312-.311a7.5 7.5 0 0 0 10.79-5.515l1.4-.364Zm-10.624-2.848a5.5 5.5 0 0 1 9.201-2.466l.312.311 1.414-1.414-.312-.311A7.5 7.5 0 0 0 2.756 7.862l-1.437-.375a9 9 0 0 1 15.056-4.04l.312-.311 1.414 1.414-.312.311a7.5 7.5 0 0 0-10.79 5.515l-1.4.364Z" clip-rule="evenodd" /></svg>
        ${escapeHtml(syncLabel)}
      </button>
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
