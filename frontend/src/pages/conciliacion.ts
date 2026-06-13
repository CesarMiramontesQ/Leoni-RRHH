import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { buildConciliacionViewModel } from "../nominas/conciliacion/buildConciliacionViewModel.ts";
import { renderConciliacionPage } from "../nominas/conciliacion/renderConciliacionPage.ts";

const SHELL_OPTS = {
  pageTitle: "Conciliación",
  activeNav: "conciliacion" as const,
  mainClass: "py-0",
};

const PLACEHOLDER_MESSAGES: Record<string, string> = {
  refresh: "Actualización de conciliación disponible próximamente.",
  "export-excel": "Exportación a Excel disponible próximamente.",
  "export-pdf": "Exportación a PDF disponible próximamente.",
  "conciliar-periodo": "Conciliación de periodo disponible próximamente.",
  "filter-estatus": "Filtro por estatus disponible próximamente.",
  "filter-agrupado": "Agrupación por categoría disponible próximamente.",
};

function bindConciliacionInteractions(container: HTMLElement): void {
  const page = container.querySelector("#conciliacion-page");
  if (!page) return;

  page.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const actionEl = target?.closest<HTMLElement>("[data-conciliacion-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.conciliacionAction;
    if (!action) return;

    if (action === "toggle-category") {
      const categoryId = actionEl.dataset.conciliacionCategoryId;
      if (!categoryId) return;

      const categoryRow = page.querySelector<HTMLElement>(`[data-conciliacion-category="${categoryId}"]`);
      const childRows = page.querySelectorAll<HTMLElement>(`[data-conciliacion-child="${categoryId}"]`);
      if (!categoryRow) return;

      const expanded = categoryRow.dataset.conciliacionExpanded === "1";
      const nextExpanded = !expanded;
      categoryRow.dataset.conciliacionExpanded = nextExpanded ? "1" : "0";
      actionEl.setAttribute("aria-expanded", nextExpanded ? "true" : "false");

      const chevron = actionEl.querySelector("svg");
      if (chevron) {
        chevron.classList.toggle("rotate-90", nextExpanded);
      }

      childRows.forEach((row) => {
        if (nextExpanded) {
          row.hidden = false;
          row.removeAttribute("data-conciliacion-collapsed");
        } else {
          row.hidden = true;
          row.setAttribute("data-conciliacion-collapsed", "1");
        }
      });
      return;
    }

    const message = PLACEHOLDER_MESSAGES[action] ?? "Acción disponible próximamente.";
    showEmpleadosToast(container, message, "success");
  });
}

/** Monta la vista de Conciliación de Nómina con datos simulados. */
export function mountConciliacion(container: HTMLElement): void {
  const vm = buildConciliacionViewModel();

  mountAppShell(container, {
    ...SHELL_OPTS,
    mainHtml: renderConciliacionPage(vm),
  });

  bindConciliacionInteractions(container);
}
