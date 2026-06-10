import { mountAppShell } from "../layouts/appShell.ts";
import { HORAS_EXTRA_MOCK_VIEW_MODEL } from "../nominas/horasExtra/mockData.ts";
import { renderHorasExtraPage } from "../nominas/horasExtra/renderHorasExtraPage.ts";

/** Monta la vista estática de Gestión de Horas Extra (sin API). */
export function mountHorasExtra(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Horas Extra",
    activeNav: "horas-extra",
    mainClass: "py-0",
    mainHtml: renderHorasExtraPage(HORAS_EXTRA_MOCK_VIEW_MODEL),
  });
}
