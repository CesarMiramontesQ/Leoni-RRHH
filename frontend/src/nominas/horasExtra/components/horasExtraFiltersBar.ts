import { escapeHtml } from "../../../ui/uiUtils.ts";
import { BTN_GHOST, FIELD_FOCUS, RH_LISTADO_SURFACE } from "../../../ui/uiTokens.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-text-muted" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`;

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>`;

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`;

function renderTabs(vm: HorasExtraPageViewModel): string {
  return vm.tabs
    .map((tab) => {
      const isActive = tab.id === vm.activeTabId;
      const activeCls = isActive
        ? "border-text-primary text-text-primary"
        : "border-transparent text-text-secondary hover:border-slate-200 hover:text-text-primary";
      return `
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-1 pb-3 text-sm font-semibold transition ${activeCls}"
          ${isActive ? 'aria-current="true"' : ""}
        >
          ${escapeHtml(tab.label)}
          <span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">${tab.count}</span>
        </button>`;
    })
    .join("");
}

export function renderHorasExtraFiltersBar(vm: HorasExtraPageViewModel): string {
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros del listado de horas extras">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap gap-4" role="tablist" aria-label="Filtrar por estado">
          ${renderTabs(vm)}
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label class="relative min-w-0 flex-1 sm:min-w-[14rem] sm:max-w-xs">
            <span class="sr-only">Buscar colaborador o centro de costo</span>
            <span class="pointer-events-none absolute inset-y-0 start-3 flex items-center">${ICON_SEARCH}</span>
            <input
              type="search"
              placeholder="Buscar colaborador o C. cost..."
              class="block w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm text-text-primary shadow-sm ${FIELD_FOCUS}"
            />
          </label>
          <button type="button" class="${BTN_GHOST}">
            ${ICON_FILTER}
            Centro de costo
          </button>
          <button type="button" class="${BTN_GHOST}">
            ${ICON_USER}
            Gerente
          </button>
        </div>
      </div>
    </section>`;
}
