import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import type { RhIncidenciasAdminViewModel, RhIncidenciaListFilters } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhIncidenciasPageStyles.ts";

const INC_FILTER_CONTROL =
  "rh-sol-filter-input min-h-11 w-full rounded-[12px] border border-[rgba(148,163,184,0.34)] bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-11 rounded-[12px] border-[rgba(148,163,184,0.34)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

function filtrosDraftActivos(f: RhIncidenciaListFilters): boolean {
  return (
    f.tipo.trim().length > 0 ||
    f.no_empleado.trim().length > 0 ||
    f.nombre.trim().length > 0 ||
    f.fecha_inicio.trim().length > 0 ||
    f.fecha_fin.trim().length > 0 ||
    f.area.trim().length > 0 ||
    f.subarea.trim().length > 0
  );
}

function filtrosAppliedActivos(a: RhIncidenciaListFilters): boolean {
  return (
    a.tipo.trim().length > 0 ||
    a.no_empleado.trim().length > 0 ||
    a.nombre.trim().length > 0 ||
    a.fecha_inicio.trim().length > 0 ||
    a.fecha_fin.trim().length > 0 ||
    a.area.trim().length > 0 ||
    a.subarea.trim().length > 0
  );
}

function textField(
  id: string,
  label: string,
  field: keyof RhIncidenciaListFilters,
  f: RhIncidenciaListFilters,
  inputType: "text" | "search" | "date" | "number" = "text",
): string {
  const val = f[field];
  const v = typeof val === "string" ? val : "";
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeIncHtml(label)}</label>
  <input
    type="${inputType}"
    id="${id}"
    name="${field}"
    data-rh-inc-filter-field="${field}"
    autocomplete="off"
    value="${escapeIncHtml(v)}"
    class="${INC_FILTER_CONTROL} ${FIELD_FOCUS}"
  />
</div>`;
}

function catalogSelectField(opts: {
  id: string;
  label: string;
  field: "area" | "subarea";
  f: RhIncidenciaListFilters;
  items: readonly string[];
  emptyLabel: string;
}): string {
  const selected = opts.f[opts.field].trim();
  const seen = new Set(opts.items);
  const merged =
    selected && !seen.has(selected) ? [selected, ...opts.items] : [...opts.items];
  const optionHtml =
    `<option value="" ${selected === "" ? "selected" : ""}>${escapeIncHtml(opts.emptyLabel)}</option>` +
    merged
      .map(
        (v) =>
          `<option value="${escapeIncHtml(v)}" ${selected === v ? "selected" : ""}>${escapeIncHtml(v)}</option>`,
      )
      .join("");
  return `<div class="min-w-0">
  <label for="${opts.id}" class="${RH_LISTADO_LABEL}">${escapeIncHtml(opts.label)}</label>
  <div class="grid grid-cols-1">
    <select
      id="${opts.id}"
      name="${opts.field}"
      data-rh-inc-filter-field="${opts.field}"
      class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}"
    >
      ${optionHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function tipoSelectField(f: RhIncidenciaListFilters, tiposApi: readonly string[]): string {
  const selected = f.tipo.trim();
  const seen = new Set(tiposApi);
  const merged = selected && !seen.has(selected) ? [selected, ...tiposApi] : [...tiposApi];
  const opts =
    `<option value="" ${selected === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optTodosTipos)}</option>` +
    merged
      .map(
        (t) =>
          `<option value="${escapeIncHtml(t)}" ${selected === t ? "selected" : ""}>${escapeIncHtml(labelTipoIncidenciaUi(t))}</option>`,
      )
      .join("");
  return `<div class="min-w-0">
  <label for="rh-inc-f-tipo" class="${RH_LISTADO_LABEL}">${escapeIncHtml(INC_COPY.filtroTipo)}</label>
  <div class="grid grid-cols-1">
    <select
      id="rh-inc-f-tipo"
      name="tipo"
      data-rh-inc-filter-field="tipo"
      class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}"
    >
      ${opts}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function renderFilters(vm: RhIncidenciasAdminViewModel, opts?: { resultCount?: number | null }): string {
  const countHtml =
    opts?.resultCount !== null && opts?.resultCount !== undefined
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[color:var(--color-text-secondary)]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[color:var(--color-text-primary)]">${escapeIncHtml(String(opts.resultCount))}</span> incidencias</p>`
      : "";

  const f = vm.filterDraft;
  const clearVisible = filtrosDraftActivos(f) || filtrosAppliedActivos(vm.appliedFilters);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto">
        <button type="button" data-rh-inc-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">
          ${escapeIncHtml(INC_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const applyBtn = `<div class="w-full shrink-0 sm:w-auto">
      <button type="button" data-rh-inc-apply-filters class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 w-full justify-center sm:w-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 1 0 2.545 7.086l3.684 3.684a.75.75 0 1 0 1.06-1.06l-3.683-3.685A4 4 0 0 0 8 4ZM5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" clip-rule="evenodd" /></svg>
        ${escapeIncHtml(INC_COPY.aplicarFiltros)}
      </button>
    </div>`;

  const wrapCls = FILTER_FIELD_WRAP;
  const grid = `
    <div class="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <div class="${wrapCls}">${tipoSelectField(f, vm.tiposRegistrados)}</div>
      <div class="${wrapCls}">${textField("rh-inc-f-noemp", INC_COPY.filtroNoEmpleado, "no_empleado", f, "text")}</div>
      <div class="${wrapCls}">${textField("rh-inc-f-fi", INC_COPY.filtroFechaDesde, "fecha_inicio", f, "date")}</div>
      <div class="${wrapCls}">${textField("rh-inc-f-ff", INC_COPY.filtroFechaHasta, "fecha_fin", f, "date")}</div>
      <div class="${wrapCls}">${catalogSelectField({
        id: "rh-inc-f-area",
        label: INC_COPY.filtroArea,
        field: "area",
        f,
        items: vm.areasRegistradas,
        emptyLabel: INC_COPY.optTodasAreas,
      })}</div>
      <div class="${wrapCls}">${catalogSelectField({
        id: "rh-inc-f-sub",
        label: INC_COPY.filtroSubarea,
        field: "subarea",
        f,
        items: vm.subareasRegistradas,
        emptyLabel: INC_COPY.optTodasSubareas,
      })}</div>
    </div>`;

  const inner = `
      <div class="flex flex-col gap-4">
        ${grid}
        <div class="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="max-w-2xl text-xs leading-relaxed text-[color:var(--color-text-secondary)] lg:hidden">${escapeIncHtml(INC_COPY.filtrosAplicadosHint)}</p>
          <div class="flex flex-wrap items-end gap-2 sm:justify-end sm:gap-3">
            ${applyBtn}
            ${clearBtn}
          </div>
        </div>
      </div>`;

  const desktopTitle = `
      <div class="mb-4 hidden flex-col gap-2 sm:flex-row sm:items-start sm:justify-between lg:flex">
        <div class="min-w-0">
          <h2 class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)]">${escapeIncHtml(INC_COPY.filtrosTitulo)}</h2>
          <p class="mt-1 text-xs font-medium text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.filtrosAplicadosHint)}</p>
        </div>
        ${countHtml}
      </div>`;

  const mobileCountBadge =
    opts?.resultCount !== null && opts?.resultCount !== undefined
      ? `<span class="text-xs text-[color:var(--color-text-muted)]"><span class="font-semibold tabular-nums text-[color:var(--color-text-primary)]">${escapeIncHtml(String(opts.resultCount))}</span> en listado</span>`
      : "";

  const mobileSummary = `
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:hidden [&::-webkit-details-marker]:hidden">
        <span class="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--color-text-primary)]">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 text-[#2563eb]" aria-hidden="true"><path fill-rule="evenodd" d="M2.628 1.601C5.028 1.222 7.49 1 10 1s4.973.222 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.591l-4.682 4.683a.75.75 0 0 0-.22.53v3.935a2.25 2.25 0 0 1-1.244 2.013l-2 1a.75.75 0 0 1-1.085-.671v-6.277a.75.75 0 0 0-.22-.53L3.21 6.22a2.25 2.25 0 0 1-.659-1.591V2.34a.75.75 0 0 1 .078-.74Z" clip-rule="evenodd" /></svg>
          ${escapeIncHtml(INC_COPY.filtrosToggleMobile)}
        </span>
        <div class="flex items-center gap-2">
          ${mobileCountBadge}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-[color:var(--color-text-muted)] transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
        </div>
      </summary>`;

  return `
    <details class="${RH_LISTADO_SURFACE} rh-sol-filters-card rh-inc-filters-card group rounded-2xl border border-[rgba(148,163,184,0.24)] shadow-sm open:shadow-sm" open aria-label="${escapeIncHtml(INC_COPY.filtrosSeccionAria)}">
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
  const slots = Array.from({ length: 6 }, () => `<div class="${wrapCls}">${cell}</div>`).join("");
  return `
    <div class="${RH_LISTADO_SURFACE} rh-sol-filters-card rh-inc-filters-card rounded-2xl border border-[rgba(148,163,184,0.24)] shadow-sm" aria-hidden="true" aria-label="Cargando filtros">
      <div class="px-4 py-3 sm:px-5">
        <div class="mb-3 h-5 w-48 animate-pulse rounded-md bg-[color:var(--color-surface-container-high)]"></div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${slots}
        </div>
      </div>
    </div>`;
}

export type RhIncidenciasFiltersContext = "listado" | "metricas";

/** Barra de filtros o skeleton según estado de carga (patrón Solicitudes). */
export function renderRhIncidenciasFiltersSection(
  vm: RhIncidenciasAdminViewModel,
  opts?: { context?: RhIncidenciasFiltersContext },
): string {
  const context = opts?.context ?? "listado";
  if (context === "listado" && vm.tableStatus === "error") {
    return "";
  }
  const filtersLoading =
    context === "metricas"
      ? vm.estadisticasStatus === "loading"
      : vm.estadisticasStatus === "loading" && vm.tableStatus === "loading";
  if (filtersLoading) {
    return renderFiltersSkeleton();
  }
  const resultCount =
    context === "metricas" ? null
    : vm.table && vm.tableStatus !== "loading" ? vm.table.total
    : null;
  return renderFilters(vm, { resultCount });
}

/** Actualiza solo las opciones del select de subárea (sin re-render completo). */
export function patchRhIncidenciaSubareaSelect(
  root: ParentNode,
  f: RhIncidenciaListFilters,
  subareas: readonly string[],
): void {
  const sel = root.querySelector<HTMLSelectElement>('[data-rh-inc-filter-field="subarea"]');
  if (!sel) return;
  const selected = f.subarea.trim();
  const seen = new Set(subareas);
  const merged =
    selected && !seen.has(selected) ? [selected, ...subareas] : [...subareas];
  const html =
    `<option value="">${escapeIncHtml(INC_COPY.optTodasSubareas)}</option>` +
    merged
      .map(
        (v) =>
          `<option value="${escapeIncHtml(v)}">${escapeIncHtml(v)}</option>`,
      )
      .join("");
  sel.innerHTML = html;
  sel.value = merged.includes(selected) ? selected : "";
}
