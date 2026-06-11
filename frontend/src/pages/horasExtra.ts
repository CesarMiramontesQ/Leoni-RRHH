import { getEmpleadosCatalogoFiltros } from "../api/empleados.ts";
import {
  getHorasExtraDetalle,
  getHorasExtraList,
  type HorasExtraFetchError,
  type HorasExtraTabFiltro,
} from "../api/horasExtra.ts";
import type { HorasExtraDetalleModalState } from "../horasExtra/shared/renderHorasExtraDetalleModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { buildHorasExtraViewModel } from "../nominas/horasExtra/buildHorasExtraViewModel.ts";
import {
  renderHorasExtraDetalleModalSlot,
  renderHorasExtraListado,
  renderHorasExtraPage,
} from "../nominas/horasExtra/renderHorasExtraPage.ts";
import type {
  HorasExtraFilterOptions,
  HorasExtraFilters,
  HorasExtraPageViewModel,
} from "../nominas/horasExtra/types.ts";
import {
  EMPTY_HORAS_EXTRA_FILTER_OPTIONS,
  EMPTY_HORAS_EXTRA_FILTERS,
} from "../nominas/horasExtra/types.ts";

const PAGE_SIZE = 10;

const SHELL_OPTS = {
  pageTitle: "Horas Extra",
  activeNav: "horas-extra" as const,
  mainClass: "py-0",
};

const EMPTY_DETALLE_MODAL: HorasExtraDetalleModalState = {
  detalle: null,
  status: "idle",
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
    filters: EMPTY_HORAS_EXTRA_FILTERS,
    filterOptions: EMPTY_HORAS_EXTRA_FILTER_OPTIONS,
    filtersStatus: "loading",
    estadoCounts: { todos: 0, pendientes: 0, aprobados: 0, rechazados: 0 },
    filas: [],
    totalRegistros: 0,
    pageSize: PAGE_SIZE,
    currentPage: 1,
    totalPages: 1,
    tableStatus: "loading",
  };
}

function errorViewModel(message: string): HorasExtraPageViewModel {
  return { ...loadingViewModel(), filtersStatus: "ready", tableStatus: "error", tableErrorMessage: message };
}

function parseOptionalInt(value: string): number | undefined {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

function listParamsFromFilters(filters: HorasExtraFilters, page = 1) {
  return {
    page,
    page_size: PAGE_SIZE,
    tab: filters.estado as HorasExtraTabFiltro,
    area_id: parseOptionalInt(filters.area_id),
    centrocosto_id: parseOptionalInt(filters.centrocosto_id),
  };
}

function mergeFilterOptions(
  catalogAreas: HorasExtraFilterOptions["areas"],
  centrosCosto: HorasExtraFilterOptions["centrosCosto"],
): HorasExtraFilterOptions {
  return { areas: catalogAreas, centrosCosto };
}

/** Monta la vista de Gestión de Horas Extra (solicitudes reales desde la API). */
export function mountHorasExtra(container: HTMLElement): void {
  let filters: HorasExtraFilters = { ...EMPTY_HORAS_EXTRA_FILTERS };
  let filterOptions: HorasExtraFilterOptions = { ...EMPTY_HORAS_EXTRA_FILTER_OPTIONS };
  let currentPage = 1;
  let detalleModal: HorasExtraDetalleModalState = { ...EMPTY_DETALLE_MODAL };

  const renderDetalleModal = (pageRoot: HTMLElement) => {
    const slot = pageRoot.querySelector("#horas-extra-detalle-modal");
    if (slot) slot.outerHTML = renderHorasExtraDetalleModalSlot(detalleModal);
  };

  const closeDetalleModal = (pageRoot: HTMLElement) => {
    detalleModal = { ...EMPTY_DETALLE_MODAL };
    renderDetalleModal(pageRoot);
  };

  mountAppShell(container, {
    ...SHELL_OPTS,
    mainHtml: renderHorasExtraPage(loadingViewModel(), EMPTY_DETALLE_MODAL),
  });

  const refreshListado = async (pageRoot: HTMLElement, page = currentPage) => {
    currentPage = page;
    const listado = pageRoot.querySelector("#horas-extra-listado");
    if (listado) {
      listado.outerHTML = renderHorasExtraListado({
        ...loadingViewModel(),
        filters,
        filterOptions,
        filtersStatus: "ready",
        currentPage,
        tableStatus: "loading",
      });
    }

    try {
      const data = await getHorasExtraList(listParamsFromFilters(filters, currentPage));
      filterOptions = mergeFilterOptions(
        filterOptions.areas,
        data.filter_options.centros_costo.map((cc) => ({ id: cc.id, label: cc.label })),
      );
      const vm = buildHorasExtraViewModel(data, { filters, filterOptions, filtersStatus: "ready" });
      const target = pageRoot.querySelector("#horas-extra-listado");
      if (target) target.outerHTML = renderHorasExtraListado(vm);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as HorasExtraFetchError).detail)
          : "Error al cargar horas extra.";
      const target = pageRoot.querySelector("#horas-extra-listado");
      if (target) {
        target.outerHTML = renderHorasExtraListado({
          ...errorViewModel(detail),
          filters,
          filterOptions,
          currentPage,
        });
      }
    }
  };

  const bindListadoEvents = (pageRoot: HTMLElement) => {
    pageRoot.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const key = target.dataset.heFilter as keyof HorasExtraFilters | undefined;
      if (!key) return;

      filters = { ...filters, [key]: target.value };
      void refreshListado(pageRoot, 1);
    });

    pageRoot.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const verBtn = target.closest<HTMLButtonElement>("[data-he-rh-ver-id]");
      if (verBtn) {
        const id = Number.parseInt(verBtn.dataset.heRhVerId ?? "0", 10);
        if (!id) return;
        detalleModal = { detalle: null, status: "loading" };
        renderDetalleModal(pageRoot);
        try {
          const detalle = await getHorasExtraDetalle(id);
          detalleModal = { detalle, status: "idle" };
        } catch (err) {
          const detail =
            err && typeof err === "object" && "detail" in err
              ? String((err as HorasExtraFetchError).detail)
              : "No se pudo cargar el detalle.";
          detalleModal = { detalle: null, status: "error", error: detail };
        }
        renderDetalleModal(pageRoot);
        return;
      }

      if (target.closest("[data-he-rh-detalle-cerrar]")) {
        closeDetalleModal(pageRoot);
        return;
      }

      const backdrop = pageRoot.querySelector("#he-rh-detalle-backdrop");
      if (backdrop && target === backdrop) {
        closeDetalleModal(pageRoot);
        return;
      }

      const pageBtn = target.closest<HTMLButtonElement>("[data-he-page]");
      if (!pageBtn || pageBtn.disabled) return;

      const nextPage = Number.parseInt(pageBtn.dataset.hePage ?? "", 10);
      if (Number.isNaN(nextPage) || nextPage < 1 || nextPage === currentPage) return;

      void refreshListado(pageRoot, nextPage);
    });
  };

  void (async () => {
    try {
      const [catalog, data] = await Promise.all([
        getEmpleadosCatalogoFiltros(),
        getHorasExtraList(listParamsFromFilters(filters)),
      ]);

      filterOptions = mergeFilterOptions(
        catalog.areas,
        data.filter_options.centros_costo.map((cc) => ({ id: cc.id, label: cc.label })),
      );
      const vm = buildHorasExtraViewModel(data, { filters, filterOptions, filtersStatus: "ready" });
      const page = container.querySelector("#horas-extra-page");
      if (page) {
        page.outerHTML = renderHorasExtraPage(vm, EMPTY_DETALLE_MODAL);
        const pageRoot = container.querySelector("#horas-extra-page");
        if (pageRoot instanceof HTMLElement) bindListadoEvents(pageRoot);
      }
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as HorasExtraFetchError).detail)
          : "Error al cargar horas extra.";
      const page = container.querySelector("#horas-extra-page");
      if (page) page.outerHTML = renderHorasExtraPage(errorViewModel(detail), EMPTY_DETALLE_MODAL);
    }
  })();
}
