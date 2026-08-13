import {
  createFaltaRetardo,
  getFaltasRetardosEstadisticas,
  getFaltasRetardosPage,
  type FaltaRetardoListItem,
  type FaltasRetardosPageResponse,
} from "../api/faltasRetardos.ts";
import { canAccessFaltasRetardosPage, canCrearFaltaRetardo } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import {
  mountFaltaRetardoDetalleModal,
  type FaltaRetardoDetalleModalHandle,
} from "../components/faltasRetardos/faltaRetardoDetalleModal.ts";
import { renderRhFaltasRetardosAdminView } from "../components/faltasRetardos/rhFaltasRetardosAdminView.ts";
import {
  mountNuevaFaltaRetardoModal,
  type NuevaFaltaRetardoModalHandle,
} from "../components/faltasRetardos/nuevaFaltaRetardoModal.ts";
import { FR_COPY } from "../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  cloneFaltasRetardosListFilters,
  emptyFaltasRetardosListFilters,
  faltasRetardosFiltersFromHash,
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
    puedeCrear: canCrearFaltaRetardo(),
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
    puedeCrear: canCrearFaltaRetardo(),
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
    puedeCrear: canCrearFaltaRetardo(),
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

  // Filtros iniciales desde el deep-link del hash (p. ej. al llegar desde las
  // gráficas del dashboard con periodo + tipo ya seleccionados).
  const initialFilters = faltasRetardosFiltersFromHash();
  let filterDraft = initialFilters;
  let appliedFilters = cloneFaltasRetardosListFilters(initialFilters);
  let page = 1;
  let loadSeq = 0;
  let currentRows: FaltaRetardoListItem[] = [];
  let lastEstadisticas: FaltasRetardosEstadisticasData | null = null;
  let lastEstadisticasStatus: FaltasRetardosAdminViewModel["estadisticasStatus"] = "loading";
  let lastEstadisticasError: string | undefined;
  let lastVm: FaltasRetardosAdminViewModel | null = null;

  function queryFromAppliedFilters() {
    return {
      busqueda: appliedFilters.busqueda || undefined,
      tipo: appliedFilters.tipo || undefined,
      fecha_inicio: appliedFilters.fecha_inicio || undefined,
      fecha_fin: appliedFilters.fecha_fin || undefined,
    };
  }

  function paintVm(vm: FaltasRetardosAdminViewModel): void {
    lastVm = vm;
    const inner = container.querySelector("#rh-faltas-retardos-inner");
    if (inner) inner.innerHTML = renderRhFaltasRetardosAdminView(lastVm);
  }

  mountAppShell(container, {
    pageTitle: FR_COPY.tituloPagina,
    activeNav: "faltas-retardos",
    mainClass,
    mainHtml: `<div id="rh-faltas-retardos-page" class="${FALTAS_RETARDOS_PAGE_SHELL_CLASS}">
      ${renderLaboralesBackBar()}
      <div id="rh-faltas-retardos-inner" class="flex min-h-0 flex-1 flex-col">${renderRhFaltasRetardosAdminView(loadingViewModel(filterDraft, appliedFilters))}</div>
      <div id="rh-fr-modal-host" class="shrink-0"></div>
      <div id="rh-fr-detalle-modal-host" class="shrink-0"></div>
    </div>`,
  });

  const modalHost = container.querySelector("#rh-fr-modal-host");
  let modal: NuevaFaltaRetardoModalHandle | null =
    modalHost instanceof HTMLElement
      ? mountNuevaFaltaRetardoModal(modalHost, {
          toastContainer: container,
          onSubmit: async (payload) => {
            await createFaltaRetardo(payload);
            page = 1;
            await load(true);
          },
        })
      : null;

  const detalleHost = container.querySelector("#rh-fr-detalle-modal-host");
  const detalleModal: FaltaRetardoDetalleModalHandle | null =
    detalleHost instanceof HTMLElement
      ? mountFaltaRetardoDetalleModal(detalleHost, { signal })
      : null;

  function openDetalleFromTarget(t: HTMLElement): boolean {
    const rowEl = t.closest<HTMLElement>("[data-rh-fr-detalle-id]");
    if (!rowEl) return false;
    const raw = rowEl.getAttribute("data-rh-fr-detalle-id");
    const id = raw ? Number.parseInt(raw, 10) : NaN;
    const fila = Number.isFinite(id) ? currentRows.find((r) => r.id === id) : undefined;
    if (!fila) return false;
    detalleModal?.open(fila);
    return true;
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
      currentRows = pageData.items;
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
      currentRows = [];
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
        // Los botones no se pintan sin permiso; el guard evita abrir el modal si
        // alguien los reinyecta en el DOM. El POST lo cierra el backend.
        if (canCrearFaltaRetardo()) modal?.open();
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
        return;
      }
      if (openDetalleFromTarget(t)) return;
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "keydown",
    (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== "Enter" && ke.key !== " ") return;
      const t = ke.target as HTMLElement;
      if (!t.closest("[data-rh-fr-detalle-id]")) return;
      ke.preventDefault();
      openDetalleFromTarget(t);
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
    detalleModal?.destroy();
  });

  void load(true);
}
