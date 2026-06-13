import { BTN_GHOST, FIELD_FOCUS, RH_LISTADO_SURFACE } from "../../../ui/uiTokens.ts";
import { renderConciliacionTableBody } from "./conciliacionTableRows.ts";
import type { ConciliacionPageViewModel } from "../types.ts";

const TABLE_COLUMNS = [
  "Concepto",
  "Nómina acum.",
  "TRESS acum.",
  "Dif. nóm-TRESS",
  "Directos contab.",
  "Indirectos contab.",
  "Total contab.",
  "Dif. nóm-contab.",
  "Estatus",
] as const;

const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-text-muted" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`;

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>`;

const ICON_GROUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm0 5.25h.007v.008H3.75V12Zm0 5.25h.007v.008H3.75v-.008Z" /></svg>`;

const LEGEND_ITEMS = [
  { tone: "bg-emerald-500", label: "Conciliado" },
  { tone: "bg-amber-500", label: "Menor" },
  { tone: "bg-red-500", label: "Crítica" },
  { tone: "bg-slate-400", label: "Sin contab." },
] as const;

function renderLegend(): string {
  return LEGEND_ITEMS.map(
    (item) => `
      <span class="inline-flex items-center gap-1.5 text-xs text-text-secondary">
        <span class="size-2 shrink-0 rounded-full ${item.tone}" aria-hidden="true"></span>
        ${item.label}
      </span>`,
  ).join("");
}

export function renderConciliacionTableContainer(vm: ConciliacionPageViewModel): string {
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Detalle de conciliación por concepto">
      <div class="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label class="relative min-w-0 flex-1 sm:min-w-[16rem] sm:max-w-md">
            <span class="sr-only">Buscar concepto, cuenta o póliza</span>
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center">${ICON_SEARCH}</span>
            <input
              type="search"
              id="conciliacion-search"
              placeholder="Buscar concepto, cuenta o póliza…"
              class="block w-full rounded-lg border border-border bg-white py-2 pr-3 pl-9 text-sm text-text-primary shadow-sm placeholder:text-text-muted ${FIELD_FOCUS}"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-conciliacion-action="filter-estatus" class="${BTN_GHOST}">
              ${ICON_FILTER}
              Estatus
            </button>
            <button type="button" data-conciliacion-action="filter-agrupado" class="${BTN_GHOST}">
              ${ICON_GROUP}
              Agrupado por categoría
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3" aria-label="Leyenda de estatus">
          ${renderLegend()}
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left">
          <thead class="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            <tr>
              ${TABLE_COLUMNS.map((col) => `<th scope="col" class="px-3 py-3 whitespace-nowrap ${col === "Concepto" ? "text-left" : "text-right"}">${col}</th>`).join("")}
            </tr>
          </thead>
          <tbody id="conciliacion-table-body">
            ${renderConciliacionTableBody(vm.categorias)}
          </tbody>
        </table>
      </div>
    </section>`;
}
