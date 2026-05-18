import { canAccessRhIncidenciasPage, getRolFromAccessToken } from "../auth/jwt.ts";
import {
  fetchIncidenciasEstadisticas,
  fetchIncidenciasListPage,
  fetchIncidenciasTiposRegistrados,
  incidenciaApiItemToTablaFila,
  type IncidenciasFetchError,
} from "../api/incidencias.ts";
import { clearAuth } from "../auth/session.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountIncidenciasTendenciaPorMesChart } from "../components/incidencias/rhIncidenciasCharts.ts";
import { renderRhIncidenciasAdminView } from "../components/incidencias/rhIncidenciasAdminView.ts";
import { destroyChartsIn } from "../charts/index.ts";
import {
  mountRhIncidenciaDetalleModal,
  type RhIncidenciaDetalleModalHandle,
} from "../components/incidencias/rhIncidenciaDetalleModal.ts";
import {
  mountSolicitudesNuevaIncidenciaModal,
  type SolicitudesNuevaIncidenciaModalHandle,
} from "../components/solicitudes/solicitudesNuevaIncidenciaModal.ts";
import { INC_COPY } from "../incidencias/rh/incidenciasCopy.ts";
import { buildRhIncidenciaFilterOptions } from "../incidencias/rh/buildRhIncidenciaFilterOptions.ts";
import { buildRhIncidenciasAdminViewModelFromApi } from "../incidencias/rh/fetchRhIncidenciasAdminMock.ts";
import {
  emptyRhIncidenciaListFilters,
  type RhIncidenciaListFilters,
  type RhIncidenciasAdminViewModel,
  type RhIncidenciasEstadisticasData,
  type RhIncidenciasUiConfig,
  type RhIncidenciaTablaFila,
} from "../incidencias/rh/types.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: INC_COPY.accesoDenegadoTitulo,
    description: INC_COPY.accesoDenegadoTexto,
    linkHref: "#/",
    linkLabel: INC_COPY.volverDashboard,
  });
}

function incidenciasUiConfig(): RhIncidenciasUiConfig {
  const rol = getRolFromAccessToken();
  if (rol === "rh") return { modoFiltros: "rh", mostrarFiltroSupervisor: true };
  if (rol === "gerente" || rol === "supervisor") return { modoFiltros: "rh", mostrarFiltroSupervisor: false };
  return { modoFiltros: "estandar", mostrarFiltroSupervisor: true };
}

function cloneFilters(f: RhIncidenciaListFilters): RhIncidenciaListFilters {
  return { ...f };
}

/** Solo los criterios expuestos en la UI de filtros (resto en blanco para la petición). */
function filtrosVisiblesAplicados(d: RhIncidenciaListFilters): RhIncidenciaListFilters {
  return {
    ...emptyRhIncidenciaListFilters(),
    tipo: d.tipo,
    no_empleado: d.no_empleado,
    nombre: d.nombre,
    fecha_inicio: d.fecha_inicio,
    fecha_fin: d.fecha_fin,
    area: d.area,
    subarea: d.subarea,
    estatus_id: d.estatus_id,
  };
}

type ChartsHold =
  | { kind: "ready"; data: RhIncidenciasEstadisticasData }
  | { kind: "error"; message: string };

function loadingViewModel(
  filterDraft: RhIncidenciaListFilters,
  appliedFilters: RhIncidenciaListFilters,
  ui: RhIncidenciasUiConfig,
  tiposRegistrados: readonly string[],
  chartsHold?: ChartsHold,
): RhIncidenciasAdminViewModel {
  if (!chartsHold) {
    return {
      estadisticas: null,
      estadisticasStatus: "loading",
      estadisticasErrorMessage: undefined,
      resumenListado: null,
      filterOptions: buildRhIncidenciaFilterOptions([]),
      tiposRegistrados,
      filterDraft: cloneFilters(filterDraft),
      appliedFilters: cloneFilters(appliedFilters),
      ui,
      tableStatus: "loading",
      table: null,
      tableErrorMessage: undefined,
    };
  }
  if (chartsHold.kind === "ready") {
    return {
      estadisticas: chartsHold.data,
      estadisticasStatus: "ready",
      estadisticasErrorMessage: undefined,
      resumenListado: null,
      filterOptions: buildRhIncidenciaFilterOptions([]),
      tiposRegistrados,
      filterDraft: cloneFilters(filterDraft),
      appliedFilters: cloneFilters(appliedFilters),
      ui,
      tableStatus: "loading",
      table: null,
      tableErrorMessage: undefined,
    };
  }
  return {
    estadisticas: null,
    estadisticasStatus: "error",
    estadisticasErrorMessage: chartsHold.message,
    resumenListado: null,
    filterOptions: buildRhIncidenciaFilterOptions([]),
    tiposRegistrados,
    filterDraft: cloneFilters(filterDraft),
    appliedFilters: cloneFilters(appliedFilters),
    ui,
    tableStatus: "loading",
    table: null,
    tableErrorMessage: undefined,
  };
}

function errorViewModel(
  message: string,
  filterDraft: RhIncidenciaListFilters,
  appliedFilters: RhIncidenciaListFilters,
  ui: RhIncidenciasUiConfig,
  tiposRegistrados: readonly string[],
): RhIncidenciasAdminViewModel {
  return {
    estadisticas: null,
    estadisticasStatus: "error",
    estadisticasErrorMessage: message,
    resumenListado: null,
    filterOptions: buildRhIncidenciaFilterOptions([]),
    tiposRegistrados,
    filterDraft: cloneFilters(filterDraft),
    appliedFilters: cloneFilters(appliedFilters),
    ui,
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
  };
}

const INCIDENCIAS_PAGE_SHELL_CLASS =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

const FILTER_FIELDS: (keyof RhIncidenciaListFilters)[] = [
  "tipo",
  "no_empleado",
  "nombre",
  "fecha_inicio",
  "fecha_fin",
  "area",
  "subarea",
  "estatus_id",
];

export function mountIncidencias(container: HTMLElement, signal: AbortSignal): void {
  const incidenciasMainClass = "pt-0 pb-5 sm:pb-6";

  if (!canAccessRhIncidenciasPage()) {
    mountAppShell(container, {
      pageTitle: INC_COPY.tituloPagina,
      activeNav: "incidencias",
      mainClass: incidenciasMainClass,
      mainHtml: `<div id="rh-incidencias-page" class="${INCIDENCIAS_PAGE_SHELL_CLASS}">${forbiddenHtml()}</div>`,
    });
    return;
  }

  const uiConfig = incidenciasUiConfig();
  let filterDraft = emptyRhIncidenciaListFilters();
  let appliedFilters = emptyRhIncidenciaListFilters();
  let tiposRegistrados: string[] = [];
  let page = 1;
  let currentRows: RhIncidenciaTablaFila[] = [];
  let lastEstadisticas: RhIncidenciasEstadisticasData | null = null;
  let lastEstadisticasStatus: "ready" | "error" = "ready";
  let lastEstadisticasError: string | undefined;

  function paintVm(vm: RhIncidenciasAdminViewModel): void {
    const inner = container.querySelector("#rh-incidencias-inner");
    if (!inner) return;
    destroyChartsIn(inner);
    inner.innerHTML = renderRhIncidenciasAdminView(vm);
    if (vm.estadisticasStatus === "ready" && vm.estadisticas) {
      mountIncidenciasTendenciaPorMesChart(inner, vm.estadisticas.incidencias_por_mes ?? []);
    }
  }

  async function load(refreshEstadisticas: boolean): Promise<void> {
    if (tiposRegistrados.length === 0) {
      try {
        tiposRegistrados = await fetchIncidenciasTiposRegistrados();
      } catch {
        tiposRegistrados = [];
      }
    }
    let chartsHold: ChartsHold | undefined;
    if (!refreshEstadisticas) {
      if (lastEstadisticasStatus === "ready" && lastEstadisticas !== null) {
        chartsHold = { kind: "ready", data: lastEstadisticas };
      } else if (lastEstadisticasStatus === "error") {
        chartsHold = {
          kind: "error",
          message: lastEstadisticasError || "No se pudieron cargar las estadísticas de incidencias.",
        };
      }
    }
    paintVm(loadingViewModel(filterDraft, appliedFilters, uiConfig, tiposRegistrados, chartsHold));
    try {
      const pageData = await fetchIncidenciasListPage(appliedFilters, page, 10);
      currentRows = pageData.items.map(incidenciaApiItemToTablaFila);
      if (refreshEstadisticas) {
        try {
          lastEstadisticas = await fetchIncidenciasEstadisticas(appliedFilters);
          lastEstadisticasStatus = "ready";
          lastEstadisticasError = undefined;
        } catch (err) {
          const fetchError = err as IncidenciasFetchError;
          lastEstadisticas = null;
          lastEstadisticasStatus = "error";
          lastEstadisticasError =
            fetchError?.detail || "No se pudieron cargar las estadísticas de incidencias.";
        }
      }
      paintVm(
        buildRhIncidenciasAdminViewModelFromApi(
          pageData,
          lastEstadisticas,
          lastEstadisticasStatus,
          lastEstadisticasError,
          filterDraft,
          appliedFilters,
          uiConfig,
          tiposRegistrados,
        ),
      );
    } catch (error) {
      const fetchError = error as IncidenciasFetchError;
      if (fetchError?.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      currentRows = [];
      paintVm(
        errorViewModel(
          fetchError?.detail || "Error inesperado al cargar incidencias.",
          filterDraft,
          appliedFilters,
          uiConfig,
          tiposRegistrados,
        ),
      );
    }
  }

  mountAppShell(container, {
    pageTitle: INC_COPY.tituloPagina,
    activeNav: "incidencias",
    mainClass: incidenciasMainClass,
    mainHtml: `<div id="rh-incidencias-page" class="${INCIDENCIAS_PAGE_SHELL_CLASS}">
      <div id="rh-incidencias-inner" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasAdminView(loadingViewModel(filterDraft, appliedFilters, uiConfig, []))}</div>
      <div id="rh-inc-detalle-modal-host" class="shrink-0"></div>
      <div id="rh-inc-nueva-incidencia-modal-host" class="shrink-0"></div>
    </div>`,
  });

  const detalleModalHost = container.querySelector("#rh-inc-detalle-modal-host");
  const detalleModal: RhIncidenciaDetalleModalHandle | null =
    detalleModalHost ?
      mountRhIncidenciaDetalleModal(detalleModalHost as HTMLElement, { signal })
    : null;

  const nuevaIncidenciaModalHost = container.querySelector("#rh-inc-nueva-incidencia-modal-host");
  const nuevaIncidenciaModal: SolicitudesNuevaIncidenciaModalHandle | null =
    nuevaIncidenciaModalHost ?
      mountSolicitudesNuevaIncidenciaModal(nuevaIncidenciaModalHost as HTMLElement, {
        signal,
        toastContainer: container,
        onSessionExpired: () => {
          clearAuth();
          void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
            abortAuthenticatedShell();
            void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
          });
        },
      })
    : null;

  const pageRoot = container.querySelector("#rh-incidencias-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#rh-inc-export")) {
        showEmpleadosToast(container, "Exportacion no disponible hasta integrar backend.", "error");
        return;
      }
      if (t.closest("#rh-inc-nueva") || t.closest("#rh-inc-nueva-empty")) {
        nuevaIncidenciaModal?.open();
        return;
      }
      if (t.closest("[data-rh-inc-clear-filters]")) {
        filterDraft = emptyRhIncidenciaListFilters();
        appliedFilters = emptyRhIncidenciaListFilters();
        page = 1;
        void load(true);
        return;
      }
      if (t.closest("[data-rh-inc-apply-filters]")) {
        const next = filtrosVisiblesAplicados(filterDraft);
        filterDraft = cloneFilters(next);
        appliedFilters = cloneFilters(next);
        page = 1;
        void load(true);
        return;
      }
      const verBtn = t.closest<HTMLElement>("[data-rh-inc-ver]");
      if (verBtn) {
        const raw = verBtn.getAttribute("data-rh-inc-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        const fila = Number.isFinite(id) ? currentRows.find((r) => r.id === id) : undefined;
        if (fila) detalleModal?.open(fila);
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-inc-page]");
      if (pageBtn) {
        const raw = pageBtn.getAttribute("data-rh-inc-page");
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n)) {
          page = n;
          void load(false);
        }
      }
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "change",
    (e) => {
      const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-inc-filter-field]");
      if (!sel) return;
      const name = sel.getAttribute("data-rh-inc-filter-field");
      if (!name) return;
      if (!FILTER_FIELDS.includes(name as keyof RhIncidenciaListFilters)) return;
      filterDraft = { ...filterDraft, [name]: sel.value } as RhIncidenciaListFilters;
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-inc-filter-field]");
      if (!inp) return;
      const name = inp.getAttribute("data-rh-inc-filter-field");
      if (!name) return;
      if (!FILTER_FIELDS.includes(name as keyof RhIncidenciaListFilters)) return;
      filterDraft = { ...filterDraft, [name]: inp.value } as RhIncidenciaListFilters;
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    nuevaIncidenciaModal?.destroy();
    detalleModal?.destroy();
  });

  void load(true);
}
