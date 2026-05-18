import { canAccessRhIncidenciasPage, getRolFromAccessToken } from "../auth/jwt.ts";
import {
  fetchIncidenciasAreasRegistradas,
  fetchIncidenciasEstadisticas,
  fetchIncidenciasListPage,
  fetchIncidenciasSubareasRegistradas,
  fetchIncidenciasTiposRegistrados,
  incidenciaApiItemToTablaFila,
  type IncidenciasFetchError,
} from "../api/incidencias.ts";
import { patchRhIncidenciaSubareaSelect } from "../components/incidencias/rhIncidenciasFilters.ts";
import { clearAuth } from "../auth/session.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import {
  mountIncidenciasAreasBarChart,
  mountIncidenciasDonutPorTipoChart,
  mountIncidenciasSubareasBarChart,
  mountIncidenciasTendenciaPorMesChart,
  RH_INC_AREAS_BAR_CHART_ID,
  RH_INC_SUBAREAS_BAR_CHART_ID,
  RH_INC_TENDENCIA_CHART_ID,
  RH_INC_TIPO_DOUGHNUT_CHART_ID,
} from "../components/incidencias/rhIncidenciasCharts.ts";
import { renderRhIncidenciasAdminView } from "../components/incidencias/rhIncidenciasAdminView.ts";
import { destroyChart, destroyChartsIn } from "../charts/index.ts";
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
import {
  buildRhIncidenciasAdminViewModelFromApi,
  type RhIncidenciasFilterCatalog,
} from "../incidencias/rh/fetchRhIncidenciasAdminMock.ts";
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

/** Lee valores actuales del DOM (el date picker suele disparar `change`, no `input`). */
function readFiltersFromDom(root: ParentNode, base: RhIncidenciaListFilters): RhIncidenciaListFilters {
  const next = { ...base };
  for (const field of FILTER_FIELDS) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-rh-inc-filter-field="${field}"]`,
    );
    if (el) next[field] = el.value;
  }
  return next;
}

function fechasRangoListo(f: RhIncidenciaListFilters): boolean {
  const fi = f.fecha_inicio.trim();
  const ff = f.fecha_fin.trim();
  if (!fi || !ff) return false;
  return fi <= ff;
}

type ChartsHold =
  | { kind: "ready"; data: RhIncidenciasEstadisticasData }
  | { kind: "error"; message: string };

const EMPTY_CATALOG: RhIncidenciasFilterCatalog = {
  tiposRegistrados: [],
  areasRegistradas: [],
  subareasRegistradas: [],
};

function loadingViewModel(
  filterDraft: RhIncidenciaListFilters,
  appliedFilters: RhIncidenciaListFilters,
  ui: RhIncidenciasUiConfig,
  catalog: RhIncidenciasFilterCatalog,
  chartsHold?: ChartsHold,
): RhIncidenciasAdminViewModel {
  if (!chartsHold) {
    return {
      estadisticas: null,
      estadisticasStatus: "loading",
      estadisticasErrorMessage: undefined,
      resumenListado: null,
      filterOptions: buildRhIncidenciaFilterOptions([]),
      tiposRegistrados: catalog.tiposRegistrados,
      areasRegistradas: catalog.areasRegistradas,
      subareasRegistradas: catalog.subareasRegistradas,
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
      tiposRegistrados: catalog.tiposRegistrados,
      areasRegistradas: catalog.areasRegistradas,
      subareasRegistradas: catalog.subareasRegistradas,
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
    tiposRegistrados: catalog.tiposRegistrados,
    areasRegistradas: catalog.areasRegistradas,
    subareasRegistradas: catalog.subareasRegistradas,
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
  catalog: RhIncidenciasFilterCatalog,
): RhIncidenciasAdminViewModel {
  return {
    estadisticas: null,
    estadisticasStatus: "error",
    estadisticasErrorMessage: message,
    resumenListado: null,
    filterOptions: buildRhIncidenciaFilterOptions([]),
    tiposRegistrados: catalog.tiposRegistrados,
    areasRegistradas: catalog.areasRegistradas,
    subareasRegistradas: catalog.subareasRegistradas,
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
  let filterCatalog: RhIncidenciasFilterCatalog = { ...EMPTY_CATALOG };
  let page = 1;
  let currentRows: RhIncidenciaTablaFila[] = [];
  let lastEstadisticas: RhIncidenciasEstadisticasData | null = null;
  let lastEstadisticasStatus: "ready" | "error" = "ready";
  let lastEstadisticasError: string | undefined;
  let loadSeq = 0;

  function destroyIncidenciasChartRegistry(): void {
    destroyChart(RH_INC_TENDENCIA_CHART_ID);
    destroyChart(RH_INC_TIPO_DOUGHNUT_CHART_ID);
    destroyChart(RH_INC_AREAS_BAR_CHART_ID);
    destroyChart(RH_INC_SUBAREAS_BAR_CHART_ID);
  }

  function paintVm(vm: RhIncidenciasAdminViewModel): void {
    const inner = container.querySelector("#rh-incidencias-inner");
    if (!inner) return;
    destroyIncidenciasChartRegistry();
    destroyChartsIn(inner);
    inner.innerHTML = renderRhIncidenciasAdminView(vm);
    if (vm.estadisticasStatus === "ready" && vm.estadisticas) {
      mountIncidenciasTendenciaPorMesChart(inner, vm.estadisticas.incidencias_por_mes ?? []);
      mountIncidenciasDonutPorTipoChart(inner, vm.estadisticas.incidencias_por_tipo ?? []);
      mountIncidenciasAreasBarChart(
        inner,
        vm.estadisticas.areas_con_mas_incidencias ?? [],
        vm.estadisticas.total_incidencias ?? 0,
      );
      mountIncidenciasSubareasBarChart(
        inner,
        vm.estadisticas.subareas_con_mas_incidencias ?? [],
        vm.estadisticas.total_incidencias ?? 0,
      );
    }
  }

  async function loadSubareasCatalog(area: string): Promise<void> {
    try {
      const items = await fetchIncidenciasSubareasRegistradas(area.trim() || undefined);
      filterCatalog = { ...filterCatalog, subareasRegistradas: items };
    } catch {
      filterCatalog = { ...filterCatalog, subareasRegistradas: [] };
    }
  }

  async function ensureFilterCatalog(): Promise<void> {
    const needTipos = filterCatalog.tiposRegistrados.length === 0;
    const needAreas = filterCatalog.areasRegistradas.length === 0;
    const needSubareas = filterCatalog.subareasRegistradas.length === 0;
    if (!needTipos && !needAreas && !needSubareas) return;

    const [tipos, areas, subareas] = await Promise.all([
      needTipos ? fetchIncidenciasTiposRegistrados().catch(() => [] as string[]) : Promise.resolve(filterCatalog.tiposRegistrados),
      needAreas ? fetchIncidenciasAreasRegistradas().catch(() => [] as string[]) : Promise.resolve(filterCatalog.areasRegistradas),
      needSubareas
        ? fetchIncidenciasSubareasRegistradas(filterDraft.area.trim() || undefined).catch(
            () => [] as string[],
          )
        : Promise.resolve(filterCatalog.subareasRegistradas),
    ]);
    filterCatalog = {
      tiposRegistrados: [...tipos],
      areasRegistradas: [...areas],
      subareasRegistradas: [...subareas],
    };
  }

  async function load(refreshEstadisticas: boolean): Promise<void> {
    const seq = ++loadSeq;
    const isStale = (): boolean => seq !== loadSeq;

    await ensureFilterCatalog();
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
    if (isStale()) return;
    paintVm(loadingViewModel(filterDraft, appliedFilters, uiConfig, filterCatalog, chartsHold));
    try {
      const pageData = await fetchIncidenciasListPage(appliedFilters, page, 10);
      if (isStale()) return;
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
      if (isStale()) return;
      paintVm(
        buildRhIncidenciasAdminViewModelFromApi(
          pageData,
          lastEstadisticas,
          lastEstadisticasStatus,
          lastEstadisticasError,
          filterDraft,
          appliedFilters,
          uiConfig,
          filterCatalog,
        ),
      );
    } catch (error) {
      if (isStale()) return;
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
          filterCatalog,
        ),
      );
    }
  }

  mountAppShell(container, {
    pageTitle: INC_COPY.tituloPagina,
    activeNav: "incidencias",
    mainClass: incidenciasMainClass,
    mainHtml: `<div id="rh-incidencias-page" class="${INCIDENCIAS_PAGE_SHELL_CLASS}">
      <div id="rh-incidencias-inner" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasAdminView(loadingViewModel(filterDraft, appliedFilters, uiConfig, EMPTY_CATALOG))}</div>
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
        void (async () => {
          await loadSubareasCatalog("");
          void load(true);
        })();
        return;
      }
      if (t.closest("[data-rh-inc-apply-filters]")) {
        if (!pageRoot) return;
        filterDraft = readFiltersFromDom(pageRoot, filterDraft);
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

  function syncFilterFieldFromDom(el: HTMLInputElement | HTMLSelectElement): void {
    const name = el.getAttribute("data-rh-inc-filter-field");
    if (!name) return;
    if (!FILTER_FIELDS.includes(name as keyof RhIncidenciaListFilters)) return;
    filterDraft = { ...filterDraft, [name]: el.value } as RhIncidenciaListFilters;
  }

  function maybeAutoApplyFechaRango(field: string): void {
    if (field !== "fecha_inicio" && field !== "fecha_fin") return;
    if (!fechasRangoListo(filterDraft)) return;
    const next = filtrosVisiblesAplicados(filterDraft);
    filterDraft = cloneFilters(next);
    appliedFilters = cloneFilters(next);
    page = 1;
    void load(true);
  }

  pageRoot?.addEventListener(
    "change",
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>(
        "[data-rh-inc-filter-field]",
      );
      if (!el) return;
      syncFilterFieldFromDom(el);
      const name = el.getAttribute("data-rh-inc-filter-field") ?? "";
      if (name === "area") {
        filterDraft = { ...filterDraft, subarea: "" };
        void (async () => {
          await loadSubareasCatalog(filterDraft.area);
          if (pageRoot) {
            patchRhIncidenciaSubareaSelect(pageRoot, filterDraft, filterCatalog.subareasRegistradas);
          }
        })();
        return;
      }
      maybeAutoApplyFechaRango(name);
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-inc-filter-field]");
      if (!inp) return;
      syncFilterFieldFromDom(inp);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    nuevaIncidenciaModal?.destroy();
    detalleModal?.destroy();
  });

  void load(true);
}
