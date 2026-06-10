import { RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../../ui/uiTokens.ts";
import { renderHorasExtraFiltersBar } from "./components/horasExtraFiltersBar.ts";
import { renderHorasExtraPageHeader } from "./components/horasExtraPageHeader.ts";
import { renderHorasExtraSummaryCards } from "./components/horasExtraSummaryCards.ts";
import { renderHorasExtraTableContainer } from "./components/horasExtraTableContainer.ts";
import type { HorasExtraPageViewModel } from "./types.ts";

export function renderHorasExtraPage(vm: HorasExtraPageViewModel): string {
  return `
    <div id="horas-extra-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderHorasExtraPageHeader(vm)}
        ${renderHorasExtraSummaryCards(vm.summaryCards)}
        <div class="flex flex-col gap-5">
          ${renderHorasExtraFiltersBar(vm)}
          ${renderHorasExtraTableContainer(vm)}
        </div>
      </div>
    </div>`;
}
