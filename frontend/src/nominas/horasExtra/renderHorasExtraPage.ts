import { RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../../ui/uiTokens.ts";
import {
  renderHorasExtraDetalleModal,
  type HorasExtraDetalleModalState,
} from "../../horasExtra/shared/renderHorasExtraDetalleModal.ts";
import { renderHorasExtraFiltersBar } from "./components/horasExtraFiltersBar.ts";
import { renderHorasExtraPageHeader } from "./components/horasExtraPageHeader.ts";
import { renderHorasExtraSummaryCards } from "./components/horasExtraSummaryCards.ts";
import { renderHorasExtraTableContainer } from "./components/horasExtraTableContainer.ts";
import type { HorasExtraPageViewModel } from "./types.ts";

const HE_RH_DETALLE_MODAL_CONFIG = {
  backdropId: "he-rh-detalle-backdrop",
  titleId: "he-rh-detalle-title",
  closeDataAttr: "he-rh-detalle-cerrar",
} as const;

export function renderHorasExtraDetalleModalSlot(state: HorasExtraDetalleModalState): string {
  return `<div id="horas-extra-detalle-modal">${renderHorasExtraDetalleModal(state, HE_RH_DETALLE_MODAL_CONFIG)}</div>`;
}

export function renderHorasExtraListado(vm: HorasExtraPageViewModel): string {
  return `
    <div id="horas-extra-listado" class="flex flex-col gap-5">
      ${renderHorasExtraFiltersBar(vm)}
      ${renderHorasExtraTableContainer(vm)}
    </div>`;
}

export function renderHorasExtraPage(
  vm: HorasExtraPageViewModel,
  detalleModal: HorasExtraDetalleModalState = { detalle: null, status: "idle" },
): string {
  return `
    <div id="horas-extra-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderHorasExtraPageHeader(vm)}
        ${renderHorasExtraSummaryCards(vm.summaryCards)}
        ${renderHorasExtraListado(vm)}
      </div>
      ${renderHorasExtraDetalleModalSlot(detalleModal)}
    </div>`;
}
