import type { AreaResponse } from "../../../api/usuarios.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";
import type { HorasExtraCentroCostoOption, HorasExtraFilters, HorasExtraPageViewModel, HorasExtraTabId } from "../types.ts";

const HE_FILTER_SELECT = `${RH_LISTADO_SELECT} rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]`;

const ESTADO_OPTIONS: readonly { id: HorasExtraTabId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "aprobados", label: "Aprobados" },
  { id: "rechazados", label: "Rechazados" },
];

function renderAreaOptions(areas: readonly AreaResponse[], selected: string): string {
  const opts = areas
    .map(
      (area) =>
        `<option value="${area.area_id}" ${selected === String(area.area_id) ? "selected" : ""}>${escapeHtml(area.descripcion)}</option>`,
    )
    .join("");
  return `<option value="" ${selected === "" ? "selected" : ""}>Todas las áreas</option>${opts}`;
}

function renderCentroCostoOptions(
  centros: readonly HorasExtraCentroCostoOption[],
  selected: string,
): string {
  const opts = centros
    .map(
      (cc) =>
        `<option value="${cc.id}" ${selected === String(cc.id) ? "selected" : ""}>${escapeHtml(cc.label)}</option>`,
    )
    .join("");
  return `<option value="" ${selected === "" ? "selected" : ""}>Todos los centros</option>${opts}`;
}

function renderEstadoOptions(filters: HorasExtraFilters, counts: HorasExtraPageViewModel["estadoCounts"]): string {
  return ESTADO_OPTIONS.map(({ id, label }) => {
    const count = counts[id] ?? 0;
    const suffix = count > 0 ? ` (${count})` : "";
    return `<option value="${id}" ${filters.estado === id ? "selected" : ""}>${escapeHtml(label)}${suffix}</option>`;
  }).join("");
}

function renderSelectField(
  id: string,
  label: string,
  filterKey: keyof HorasExtraFilters,
  optionsHtml: string,
  disabled: boolean,
): string {
  return `
    <div class="${FILTER_FIELD_WRAP}">
      <label for="${id}" class="${RH_LISTADO_LABEL}">${label}</label>
      <div class="grid grid-cols-1">
        <select
          id="${id}"
          name="${filterKey}"
          data-he-filter="${filterKey}"
          class="${HE_FILTER_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
          ${disabled ? "disabled" : ""}
        >
          ${optionsHtml}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

export function renderHorasExtraFiltersBar(vm: HorasExtraPageViewModel): string {
  const disabled = vm.filtersStatus === "loading";
  const { filters, filterOptions } = vm;

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros del listado de horas extras">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3">
        ${renderSelectField(
          "he-filter-area",
          "Área",
          "area_id",
          renderAreaOptions(filterOptions.areas, filters.area_id),
          disabled,
        )}
        ${renderSelectField(
          "he-filter-centro",
          "Centro de costo",
          "centrocosto_id",
          renderCentroCostoOptions(filterOptions.centrosCosto, filters.centrocosto_id),
          disabled,
        )}
        ${renderSelectField(
          "he-filter-estado",
          "Estado",
          "estado",
          renderEstadoOptions(filters, vm.estadoCounts),
          disabled,
        )}
      </div>
    </section>`;
}
