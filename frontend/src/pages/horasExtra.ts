import { getHorasExtraList, type HorasExtraFetchError } from "../api/horasExtra.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { buildHorasExtraViewModel } from "../nominas/horasExtra/buildHorasExtraViewModel.ts";
import { renderHorasExtraPage } from "../nominas/horasExtra/renderHorasExtraPage.ts";
import type { HorasExtraPageViewModel } from "../nominas/horasExtra/types.ts";

const SHELL_OPTS = {
  pageTitle: "Horas Extra",
  activeNav: "horas-extra" as const,
  mainClass: "py-0",
};

function loadingViewModel(): HorasExtraPageViewModel {
  return {
    semanaLabel: "Semana —",
    summaryCards: [
      { id: "s1", label: "Total de horas extras", value: "—", footer: "Cargando…" },
      { id: "s2", label: "Empleados con horas extras", value: "—", footer: "Cargando…" },
      { id: "s3", label: "Solicitudes pendientes", value: "—", footer: "Cargando…" },
      { id: "s4", label: "Solicitudes aprobadas", value: "—", footer: "Cargando…" },
    ],
    tabs: [
      { id: "todos", label: "Todos", count: 0 },
      { id: "pendientes", label: "Pendientes", count: 0 },
      { id: "aprobados", label: "Aprobados", count: 0 },
      { id: "rechazados", label: "Rechazados", count: 0 },
    ],
    activeTabId: "todos",
    filas: [],
    totalRegistros: 0,
    pageSize: 10,
    currentPage: 1,
    totalPages: 1,
    tableStatus: "loading",
  };
}

function errorViewModel(message: string): HorasExtraPageViewModel {
  return { ...loadingViewModel(), tableStatus: "error", tableErrorMessage: message };
}

/** Monta la vista de Gestión de Horas Extra (empleados reales + campos simulados). */
export function mountHorasExtra(container: HTMLElement): void {
  mountAppShell(container, {
    ...SHELL_OPTS,
    mainHtml: renderHorasExtraPage(loadingViewModel()),
  });

  void (async () => {
    try {
      const data = await getHorasExtraList({ page: 1, page_size: 10, tab: "todos" });
      const vm = buildHorasExtraViewModel(data);
      const page = container.querySelector("#horas-extra-page");
      if (page) {
        page.outerHTML = renderHorasExtraPage(vm);
      }
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as HorasExtraFetchError).detail)
          : "Error al cargar horas extra.";
      const page = container.querySelector("#horas-extra-page");
      if (page) {
        page.outerHTML = renderHorasExtraPage(errorViewModel(detail));
      }
    }
  })();
}
