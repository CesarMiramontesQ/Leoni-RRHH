import { RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../../ui/uiTokens.ts";
import { renderConciliacionFilterBar } from "./components/conciliacionFilterBar.ts";
import { renderConciliacionPageHeader } from "./components/conciliacionPageHeader.ts";
import { renderConciliacionSummaryCards } from "./components/conciliacionSummaryCards.ts";
import { renderConciliacionTableContainer } from "./components/conciliacionTableContainer.ts";
import type { ConciliacionPageViewModel } from "./types.ts";

export function renderConciliacionPage(vm: ConciliacionPageViewModel): string {
  return `
    <div id="conciliacion-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderConciliacionPageHeader(vm)}
        ${renderConciliacionFilterBar(vm.filtros)}
        ${renderConciliacionSummaryCards(vm.summaryCards)}
        ${renderConciliacionTableContainer(vm)}
      </div>
    </div>`;
}
