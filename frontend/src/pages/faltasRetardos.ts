import { fetchAllEmpleadosForExport } from "../api/empleados.ts";
import {
  createFaltaRetardo,
  getFaltasRetardosEstadisticas,
  getFaltasRetardosPage,
  type FaltasRetardosPageResponse,
} from "../api/faltasRetardos.ts";
import { canAccessFaltasRetardosPage } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { renderRhFaltasRetardosAdminView } from "../components/faltasRetardos/rhFaltasRetardosAdminView.ts";
import {
  mountNuevaFaltaRetardoModal,
  type FaltaRetardoEmpleadoOption,
  type NuevaFaltaRetardoModalHandle,
} from "../components/faltasRetardos/nuevaFaltaRetardoModal.ts";
import { FR_COPY } from "../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  cloneFaltasRetardosListFilters,
  emptyFaltasRetardosListFilters,
  fechasRangoFaltasRetardosListo,
  readFaltasRetardosFiltersFromDom,
  RH_FR_FILTER_FIELDS,
} from "../faltasRetardos/rh/faltasRetardosFilterHelpers.ts";
import type {
  FaltasRetardosAdminViewModel,
  FaltasRetardosEstadisticasData,
  FaltasRetardosListFilters,
} from "../faltasRetardos/rh/types.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SIZE = 10;

const FALTAS_RETARDOS_PAGE_SHELL_CLASS =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: FR_COPY.accesoDenegadoTitulo,
    description: FR_COPY.accesoDenegadoTexto,
  });
}

type EstadisticasHold =
  | { kind: "ready"; data: FaltasRetardosEstadisticasData }
  | { kind: "error"; message: string };

function estadisticasFields(hold?: EstadisticasHold): Pick<
  FaltasRetardosAdminViewModel,
  "estadisticas" | "estadisticasStatus" | "estadisticasErrorMessage"
> {
  if (!hold) {
    return {
      estadisticas: null,
      estadisticasStatus: "loading",
      estadisticasErrorMessage: undefined,
    };
  }
  if (hold.kind === "error") {
    return {
      estadisticas: null,
      estadisticasStatus: "error",
      estadisticasErrorMessage: hold.message,
    };
  }
  return {
    estadisticas: hold.data,
    estadisticasStatus: "ready",
    estadisticasErrorMessage: undefined,
  };
}

function loadingViewModel(
  filterDraft: FaltasRetardosListFilters,
  appliedFilters: FaltasRetardosListFilters,
  kpisHold?: EstadisticasHold,
): FaltasRetardosAdminViewModel {
  return {
    filterDraft: cloneFaltasRetardosListFilters(filterDraft),
    appliedFilters: cloneFaltasRetardosListFilters(appliedFilters),
    ...estadisticasFields(kpisHold),
    tableStatus: "loading",
    table: null,
  };
}

function viewModelFromPage(
  pageData: FaltasRetardosPageResponse,
  filterDraft: FaltasRetardosListFilters,
  appliedFilters: FaltasRetardosListFilters,
  estadisticas: FaltasRetardosEstadisticasData | null,
  estadisticasStatus: FaltasRetardosAdminViewModel["estadisticasStatus"],
  estadisticasErrorMessage?: string,
): FaltasRetardosAdminViewModel {
  const table = {
    items: pageData.items,
    total: pageData.total,
    page: pageData.page,
    page_size: pageData.page_size,
  };
  return {
    filterDraft: cloneFaltasRetardosListFilters(filterDraft),
    appliedFilters: cloneFaltasRetardosListFilters(appliedFilters),
    estadisticas,
    estadisticasStatus,
    estadisticasErrorMessage,
    tableStatus: pageData.total === 0 ? "empty" : "ready",
    table,
  };
}

function errorViewModel(
  message: string,
  filterDraft: FaltasRetardosListFilters,
  appliedFilters: FaltasRetardosListFilters,
  kpisHold?: EstadisticasHold,
): FaltasRetardosAdminViewModel {
  return {
    filterDraft: cloneFaltasRetardosListFilters(filterDraft),
    appliedFilters: cloneFaltasRetardosListFilters(appliedFilters),
    ...estadisticasFields(kpisHold),
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
  };
}

export function mountFaltasRetardos(container: HTMLElement, signal: AbortSignal): void {
  const mainClass = "pt-0 pb-5 sm:pb-6";

  if (!canAccessFaltasRetardosPage()) {
    mountAppShell(container, {
      pageTitle: FR_COPY.tituloPagina,
      activeNav: "faltas-retardos",
      mainClass,
      mainHtml: `<div id="rh-faltas-retardos-page" class="${FALTAS_RETARDOS_PAGE_SHELL_CLASS}">${renderLaboralesBackBar()}${forbiddenHtml()}</div>`,
    });
    return;
  }

  let filterDraft = emptyFaltasRetardosListFilters();
  let appliedFilters = emptyFaltasRetardosListFilters();
  let page = 1;
  let loadSeq = 0;
  let empleadoOptions: FaltaRetardoEmpleadoOption[] = [];
  let lastEstadisticas: FaltasRetardosEstadisticasData | null = null;
  let lastEstadisticasStatus: FaltasRetardosAdminViewModel["estadisticasStatus"] = "loading";
  let lastEstadisticasError: string | undefined;

  function queryFromAppliedFilters() {
    return {
      busqueda: appliedFilters.busqueda || undefined,
      tipo: appliedFilters.tipo || undefined,
      fecha_inicio: appliedFilters.fecha_inicio || undefined,
      fecha_fin: appliedFilters.fecha_fin || undefined,
    };
  }

  function paintVm(vm: FaltasRetardosAdminViewModel): void {
    const inner = container.querySelector("#rh-faltas-retardos-inner");
    if (inner) inner.innerHTML = renderRhFaltasRetardosAdminView(vm);
  }

  mountAppShell(container, {
    pageTitle: FR_COPY.tituloPagina,
    activeNav: "faltas-retardos",
    mainClass,
    mainHtml: `<div id="rh-faltas-retardos-page" class="${FALTAS_RETARDOS_PAGE_SHELL_CLASS}">
      ${renderLaboralesBackBar()}
      <div id="rh-faltas-retardos-inner" class="flex min-h-0 flex-1 flex-col">${renderRhFaltasRetardosAdminView(loadingViewModel(filterDraft, appliedFilters))}</div>
      <div id="rh-fr-modal-host" class="shrink-0"></div>
    </div>`,
  });

  const modalHost = container.querySelector("#rh-fr-modal-host");
  let modal: NuevaFaltaRetardoModalHandle | null =
    modalHost instanceof HTMLElement
      ? mountNuevaFaltaRetardoModal(modalHost, {
          empleados: empleadoOptions,
          toastContainer: container,
          onSubmit: async (payload) => {
            await createFaltaRetardo(payload);
            page = 1;
            await load(true);
          },
        })
      : null;

  async function refreshEmpleadoOptions(): Promise<void> {
    try {
      const items = await fetchAllEmpleadosForExport({ activo: true });
      empleadoOptions = items.map((e) => ({
        empleado_id: e.empleado_id,
        nombre: formatNombreEmpleadoUi(e.nombre),
        no_empleado: formatNoEmpleadoDisplay(e.no_empleado),
      }));
      if (modalHost instanceof HTMLElement) {
        modal?.destroy();
        modal = mountNuevaFaltaRetardoModal(modalHost, {
          empleados: empleadoOptions,
          toastContainer: container,
          onSubmit: async (payload) => {
            await createFaltaRetardo(payload);
            page = 1;
            await load(true);
          },
        });
      }
    } catch {
      showEmpleadosToast(container, "No se pudo cargar la lista de empleados.", "error");
    }
  }

  async function load(refreshEstadisticas = true): Promise<void> {
    const seq = ++loadSeq;
    const isStale = (): boolean => seq !== loadSeq;

    let kpisHold: EstadisticasHold | undefined;
    if (!refreshEstadisticas) {
      if (lastEstadisticasStatus === "ready" && lastEstadisticas !== null) {
        kpisHold = { kind: "ready", data: lastEstadisticas };
      } else if (lastEstadisticasStatus === "error") {
        kpisHold = {
          kind: "error",
          message: lastEstadisticasError || FR_COPY.errorEstadisticas,
        };
      }
    }

    paintVm(loadingViewModel(filterDraft, appliedFilters, kpisHold));
    try {
      const filters = queryFromAppliedFilters();
      const pageData = await getFaltasRetardosPage({
        page,
        page_size: PAGE_SIZE,
        ...filters,
      });
      if (isStale()) return;

      if (refreshEstadisticas) {
        try {
          lastEstadisticas = await getFaltasRetardosEstadisticas(filters);
          lastEstadisticasStatus = "ready";
          lastEstadisticasError = undefined;
        } catch (error: unknown) {
          const fetchError = error as { detail?: string };
          lastEstadisticas = null;
          lastEstadisticasStatus = "error";
          lastEstadisticasError = fetchError?.detail || FR_COPY.errorEstadisticas;
        }
      }

      if (isStale()) return;
      paintVm(
        viewModelFromPage(
          pageData,
          filterDraft,
          appliedFilters,
          lastEstadisticas,
          lastEstadisticasStatus,
          lastEstadisticasError,
        ),
      );
    } catch (error: unknown) {
      if (isStale()) return;
      const fetchError = error as { status?: number; detail?: string };
      if (fetchError?.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      paintVm(
        errorViewModel(
          fetchError?.detail || "Error inesperado al cargar los eventos.",
          filterDraft,
          appliedFilters,
          kpisHold,
        ),
      );
    }
  }

  const pageRoot = container.querySelector("#rh-faltas-retardos-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#rh-fr-nuevo") || t.closest("#rh-fr-nueva-empty")) {
        modal?.open();
        return;
      }
      if (t.closest("[data-rh-fr-clear-filters]")) {
        filterDraft = emptyFaltasRetardosListFilters();
        appliedFilters = emptyFaltasRetardosListFilters();
        page = 1;
        void load();
        return;
      }
      if (t.closest("[data-rh-fr-apply-filters]")) {
        if (!pageRoot) return;
        filterDraft = readFaltasRetardosFiltersFromDom(pageRoot, filterDraft);
        appliedFilters = cloneFaltasRetardosListFilters(filterDraft);
        page = 1;
        void load();
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-fr-page]");
      if (pageBtn) {
        const raw = pageBtn.getAttribute("data-rh-fr-page");
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n) && n >= 1) {
          page = n;
          void load(false);
        }
      }
    },
    { signal },
  );

  function syncFilterFieldFromDom(el: HTMLInputElement | HTMLSelectElement): void {
    const name = el.getAttribute("data-rh-fr-filter-field");
    if (!name) return;
    if (!RH_FR_FILTER_FIELDS.includes(name as (typeof RH_FR_FILTER_FIELDS)[number])) return;
    filterDraft = { ...filterDraft, [name]: el.value } as FaltasRetardosListFilters;
  }

  function maybeAutoApplyFechaRango(field: string): void {
    if (field !== "fecha_inicio" && field !== "fecha_fin") return;
    if (!fechasRangoFaltasRetardosListo(filterDraft)) return;
    appliedFilters = cloneFaltasRetardosListFilters(filterDraft);
    page = 1;
    void load();
  }

  pageRoot?.addEventListener(
    "change",
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>(
        "[data-rh-fr-filter-field]",
      );
      if (!el) return;
      syncFilterFieldFromDom(el);
      const name = el.getAttribute("data-rh-fr-filter-field") ?? "";
      maybeAutoApplyFechaRango(name);
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-fr-filter-field]");
      if (!inp) return;
      syncFilterFieldFromDom(inp);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    modal?.destroy();
  });

  void (async () => {
    await refreshEmpleadoOptions();
    await load(true);
  })();
}
