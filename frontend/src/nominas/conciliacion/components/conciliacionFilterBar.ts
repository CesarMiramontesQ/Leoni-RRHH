import { FIELD_FOCUS, FILTER_FIELD_WRAP, SELECT_CHEVRON } from "../../../ui/uiTokens.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { ConciliacionFiltros } from "../types.ts";

const ICON_BUILDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-9.75 0h.008v.008H12V7.5Zm0 3h.008v.008H12V10.5Zm0 3h.008v.008H12V13.5Z" /></svg>`;

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;

const ICON_FACTORY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>`;

function filterSelect(id: string, label: string, value: string, icon: string): string {
  return `
    <label class="${FILTER_FIELD_WRAP}">
      <span class="sr-only">${escapeHtml(label)}</span>
      <div class="relative">
        ${icon}
        <div class="grid grid-cols-1">
          <select id="${id}" data-conciliacion-filter="${id}" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pr-8 pl-9 text-sm text-text-primary shadow-sm ${FIELD_FOCUS}">
            <option selected>${escapeHtml(value)}</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
    </label>`;
}

export function renderConciliacionFilterBar(filtros: ConciliacionFiltros): string {
  return `
    <section class="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Filtros de conciliación">
      <div class="flex flex-1 flex-wrap gap-3">
        ${filterSelect("conciliacion-razon-social", "Razón social", filtros.razonSocial, ICON_BUILDING)}
        ${filterSelect("conciliacion-periodo", "Período", filtros.periodo, ICON_CALENDAR)}
        ${filterSelect("conciliacion-centro", "Centro", filtros.centro, ICON_FACTORY)}
      </div>
      <p class="shrink-0 text-xs text-text-muted">${escapeHtml(filtros.ultimaCorrida)}</p>
    </section>`;
}
