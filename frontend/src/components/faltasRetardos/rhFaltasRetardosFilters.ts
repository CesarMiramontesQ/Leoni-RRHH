import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import { filtrosFaltasRetardosActivos } from "../../faltasRetardos/rh/faltasRetardosFilterHelpers.ts";
import {
  FALTA_RETARDO_TIPOS,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import type { FaltasRetardosAdminViewModel, FaltasRetardosListFilters } from "../../faltasRetardos/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhFaltasRetardosPageStyles.ts";

const FR_FILTER_CONTROL =
  "rh-sol-filter-input min-h-11 w-full rounded-[12px] border border-[rgba(148,163,184,0.34)] bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-11 rounded-[12px] border-[rgba(148,163,184,0.34)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

function textField(
  id: string,
  label: string,
  field: keyof FaltasRetardosListFilters,
  f: FaltasRetardosListFilters,
  inputType: "text" | "search" | "date" = "text",
  placeholder = "",
): string {
  const val = f[field];
  const v = typeof val === "string" ? val : "";
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(label)}</label>
  <input
    type="${inputType}"
    id="${id}"
    name="${field}"
    data-rh-fr-filter-field="${field}"
    autocomplete="off"
    placeholder="${escapeHtml(placeholder)}"
    value="${escapeHtml(v)}"
    class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}"
  />
</div>`;
}

function tipoSelectField(f: FaltasRetardosListFilters): string {
  const selected = f.tipo;
  const opts =
    `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(FR_COPY.optTodosTipos)}</option>` +
    FALTA_RETARDO_TIPOS.map(
      (t) =>
        `<option value="${t}" ${selected === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`,
    ).join("");
  return `<div class="min-w-0">
  <label for="rh-fr-f-tipo" class="${RH_LISTADO_LABEL}">${escapeHtml(FR_COPY.filtroTipo)}</label>
  <div class="grid grid-cols-1">
    <select
      id="rh-fr-f-tipo"
      name="tipo"
      data-rh-fr-filter-field="tipo"
      class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}"
    >
      ${opts}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function renderFilters(vm: FaltasRetardosAdminViewModel, resultCount: number | null): string {
  const f = vm.filterDraft;
  const clearVisible =
    filtrosFaltasRetardosActivos(f) || filtrosFaltasRetardosActivos(vm.appliedFilters);
  const countHtml =
    resultCount !== null
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[color:var(--color-text-secondary)]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[color:var(--color-text-primary)]">${escapeHtml(String(resultCount))}</span> eventos</p>`
      : "";

  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto">
        <button type="button" data-rh-fr-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">
          ${escapeHtml(FR_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const applyBtn = `<div class="w-full shrink-0 sm:w-auto">
      <button type="button" data-rh-fr-apply-filters class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 w-full justify-center sm:w-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 1 0 2.545 7.086l3.684 3.684a.75.75 0 1 0 1.06-1.06l-3.683-3.685A4 4 0 0 0 8 4ZM5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" clip-rule="evenodd" /></svg>
        ${escapeHtml(FR_COPY.aplicarFiltros)}
      </button>
    </div>`;

  const wrapCls = FILTER_FIELD_WRAP;
  const grid = `
    <div class="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="${wrapCls}">${textField("rh-fr-f-busqueda", FR_COPY.filtroBusqueda, "busqueda", f, "search", FR_COPY.placeholderBusqueda)}</div>
      <div class="${wrapCls}">${tipoSelectField(f)}</div>
      <div class="${wrapCls}">${textField("rh-fr-f-fi", FR_COPY.filtroFechaDesde, "fecha_inicio", f, "date")}</div>
      <div class="${wrapCls}">${textField("rh-fr-f-ff", FR_COPY.filtroFechaHasta, "fecha_fin", f, "date")}</div>
    </div>`;

  const inner = `
      <div class="flex flex-col gap-4">
        ${grid}
        <div class="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="max-w-2xl text-xs leading-relaxed text-[color:var(--color-text-secondary)] lg:hidden">${escapeHtml(FR_COPY.filtrosAplicadosHint)}</p>
          <div class="flex flex-wrap items-end gap-2 sm:justify-end sm:gap-3">
            ${applyBtn}
            ${clearBtn}
          </div>
        </div>
      </div>`;

  const desktopTitle = `
      <div class="mb-4 hidden flex-col gap-2 sm:flex-row sm:items-start sm:justify-between lg:flex">
        <div class="min-w-0">
          <h2 class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)]">${escapeHtml(FR_COPY.filtrosTitulo)}</h2>
          <p class="mt-1 text-xs font-medium text-[color:var(--color-text-secondary)]">${escapeHtml(FR_COPY.filtrosAplicadosHint)}</p>
        </div>
        ${countHtml}
      </div>`;

  const mobileCountBadge =
    resultCount !== null
      ? `<span class="text-xs text-[color:var(--color-text-muted)]"><span class="font-semibold tabular-nums text-[color:var(--color-text-primary)]">${escapeHtml(String(resultCount))}</span> en listado</span>`
      : "";

  const mobileSummary = `
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:hidden [&::-webkit-details-marker]:hidden">
        <span class="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--color-text-primary)]">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 text-[#2563eb]" aria-hidden="true"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.222 7.49 1 10 1s4.973.222 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.591l-4.682 4.683a.75.75 0 0 0-.22.53v3.935a2.25 2.25 0 0 1-1.244 2.013l-2 1a.75.75 0 0 1-1.085-.671v-6.277a.75.75 0 0 0-.22-.53L3.21 6.22a2.25 2.25 0 0 1-.659-1.591V2.34a.75.75 0 0 1 .078-.74Z" clip-rule="evenodd" /></svg>
          ${escapeHtml(FR_COPY.filtrosToggleMobile)}
        </span>
        <div class="flex items-center gap-2">
          ${mobileCountBadge}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-[color:var(--color-text-muted)] transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
        </div>
      </summary>`;

  return `
    <details class="${RH_LISTADO_SURFACE} rh-sol-filters-card rh-inc-filters-card group rounded-2xl border border-[rgba(148,163,184,0.24)] shadow-sm open:shadow-sm" open aria-label="${escapeHtml(FR_COPY.filtrosSeccionAria)}">
      ${mobileSummary}
      <div class="border-t border-[rgba(148,163,184,0.22)] px-4 pb-4 pt-3 sm:px-5 lg:border-t-0 lg:p-5 lg:pt-5">
        ${desktopTitle}
        ${inner}
      </div>
    </details>`;
}

function renderFiltersSkeleton(): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-24 max-w-full rounded bg-[color:var(--color-surface-container-high)]"></div>
      <div class="h-[42px] w-full rounded-[12px] bg-[color:var(--color-surface-container)]"></div>
    </div>`;
  const wrapCls = FILTER_FIELD_WRAP;
  const slots = Array.from({ length: 4 }, () => `<div class="${wrapCls}">${cell}</div>`).join("");
  return `
    <div class="${RH_LISTADO_SURFACE} rh-sol-filters-card rh-inc-filters-card rounded-2xl border border-[rgba(148,163,184,0.24)] shadow-sm" aria-hidden="true">
      <div class="px-4 py-3 sm:px-5">
        <div class="mb-3 h-5 w-48 animate-pulse rounded-md bg-[color:var(--color-surface-container-high)]"></div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">${slots}</div>
      </div>
    </div>`;
}

export function renderRhFaltasRetardosFiltersSection(vm: FaltasRetardosAdminViewModel): string {
  if (vm.tableStatus === "error") return "";
  if (vm.tableStatus === "loading") return renderFiltersSkeleton();
  const resultCount = vm.table ? vm.table.total : null;
  return renderFilters(vm, resultCount);
}
