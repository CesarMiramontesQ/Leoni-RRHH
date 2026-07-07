import type { ViajeLaboralEstadoOption } from "../../api/viajesLaborales.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import { filtrosViajesLaboralesActivos } from "../../viajesLaborales/rh/viajesLaboralesFilterHelpers.ts";
import type { ViajesLaboralesAdminViewModel, ViajesLaboralesListFilters } from "../../viajesLaborales/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhViajesLaboralesPageStyles.ts";

const VL_FILTER_CONTROL =
  "rh-sol-filter-input min-h-11 w-full rounded-[12px] border border-[rgba(148,163,184,0.34)] bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-11 rounded-[12px] border-[rgba(148,163,184,0.34)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]";

function textField(
  id: string,
  label: string,
  field: keyof ViajesLaboralesListFilters,
  f: ViajesLaboralesListFilters,
  inputType: "text" | "search" | "date" = "text",
  placeholder = "",
): string {
  const val = f[field];
  const v = typeof val === "string" ? val : "";
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(label)}</label>
  <input type="${inputType}" id="${id}" name="${field}" data-rh-vl-filter-field="${field}" autocomplete="off" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(v)}" class="${VL_FILTER_CONTROL} ${FIELD_FOCUS}" />
</div>`;
}

function estadoSelect(f: ViajesLaboralesListFilters, estados: ViajeLaboralEstadoOption[]): string {
  const selected = f.estado;
  const opts =
    `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(VL_COPY.optTodosEstados)}</option>` +
    estados
      .map(
        (e) =>
          `<option value="${e.value}" ${selected === e.value ? "selected" : ""}>${escapeHtml(e.label)}</option>`,
      )
      .join("");
  return `<div class="min-w-0">
  <label for="rh-vl-f-estado" class="${RH_LISTADO_LABEL}">${escapeHtml(VL_COPY.filtroEstado)}</label>
  <div class="grid grid-cols-1">
    <select id="rh-vl-f-estado" name="estado" data-rh-vl-filter-field="estado" class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}">${opts}</select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

export function renderRhViajesLaboralesFiltersSection(
  vm: ViajesLaboralesAdminViewModel,
  estados: ViajeLaboralEstadoOption[],
): string {
  const f = vm.filterDraft;
  const clearVisible =
    filtrosViajesLaboralesActivos(f) || filtrosViajesLaboralesActivos(vm.appliedFilters);
  const resultCount = vm.table?.total ?? null;
  const countHtml =
    resultCount !== null
      ? `<p class="text-xs font-medium text-[color:var(--color-text-secondary)]">Mostrando <span class="tabular-nums font-semibold">${escapeHtml(String(resultCount))}</span> viajes</p>`
      : "";

  return `
  <section class="${RH_LISTADO_SURFACE} shrink-0 overflow-hidden" aria-label="${escapeHtml(VL_COPY.filtrosTitulo)}">
    <div class="border-b border-slate-100/90 px-4 py-3 sm:px-5">
      <h2 class="text-sm font-bold text-[color:var(--color-text-primary)]">${escapeHtml(VL_COPY.filtrosTitulo)}</h2>
      ${countHtml}
    </div>
    <div class="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:px-5">
      ${textField("rh-vl-f-busqueda", VL_COPY.filtroBusqueda, "busqueda", f, "search", VL_COPY.placeholderBusqueda)}
      ${textField("rh-vl-f-destino", VL_COPY.filtroDestino, "destino", f, "text", VL_COPY.placeholderDestino)}
      ${estadoSelect(f, estados)}
      ${textField("rh-vl-f-fecha-inicio", VL_COPY.filtroFechaDesde, "fecha_inicio", f, "date")}
      ${textField("rh-vl-f-fecha-fin", VL_COPY.filtroFechaHasta, "fecha_fin", f, "date")}
    </div>
    <div class="flex flex-wrap items-center gap-2 border-t border-slate-100/90 px-4 py-3 sm:px-5">
      ${clearVisible ? `<button type="button" data-rh-vl-clear-filters class="${RH_LISTADO_BTN_GHOST}">${escapeHtml(VL_COPY.limpiarFiltros)}</button>` : ""}
      <button type="button" data-rh-vl-apply-filters class="${RH_SOLICITUDES_BTN_PRIMARY} min-h-11">${escapeHtml(VL_COPY.aplicarFiltros)}</button>
      <button type="button" id="rh-vl-nuevo" class="${RH_SOLICITUDES_BTN_PRIMARY} min-h-11">${escapeHtml(VL_COPY.nuevo)}</button>
    </div>
  </section>`;
}
