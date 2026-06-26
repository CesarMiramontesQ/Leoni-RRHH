import { canAccessMetricasPage } from "../auth/jwt.ts";
import { fetchIncidenciasEstadisticas, type IncidenciasFetchError } from "../api/incidencias.ts";
import { getFaltasRetardosEstadisticas } from "../api/faltasRetardos.ts";
import { getSolicitudesRows, type SolicitudesFetchError } from "../api/solicitudes.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountRhIncidenciasAnalyticsCharts } from "../components/incidencias/rhIncidenciasAnalyticsSection.ts";
import { mountRhFaltasRetardosMetricasCharts } from "../components/faltasRetardos/rhFaltasRetardosMetricasSection.ts";
import { renderRhMetricasView } from "../components/solicitudes/rhSolicitudesAdminView.ts";
import { mountRhSolicitudesAnalyticsFromRows } from "../components/solicitudes/rhSolicitudesAnalyticsSection.ts";
import { clearAuth } from "../auth/session.ts";
import { destroyChart, destroyChartsIn, runChartsAfterLayout } from "../charts/index.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import {
  cloneRhIncidenciaListFilters,
  incidenciasFiltersFromSolicitudesMetricas,
} from "../incidencias/rh/incidenciaListFilterHelpers.ts";
import { incidenciasUiConfig } from "../incidencias/rh/incidenciasUiConfig.ts";
import { buildRhSolicitudFilterOptions } from "../solicitudes/rh/buildRhSolicitudFilterOptions.ts";
import { aggregateEmpleadosRetardosTop } from "../incidencias/rh/aggregateEmpleadosRetardosTop.ts";
import {
  buildMetricasIncidenciasViewModel,
  type RhIncidenciasFilterCatalog,
} from "../incidencias/rh/fetchRhIncidenciasAdminMock.ts";
import type { SolicitudRankingRow } from "../solicitudes/rh/computeSolicitudesAnalytics.ts";
import { buildRhSolicitudesAdminViewModel } from "../solicitudes/rh/fetchRhSolicitudesAdminMock.ts";
import { filterRhSolicitudRows } from "../solicitudes/rh/filterAndPaginateRhSolicitudes.ts";
import {
  fechasRangoMetricasValido,
  metricasFiltrosAplicados,
  readMetricasFiltersFromDom,
} from "../solicitudes/rh/metricasFilterHelpers.ts";
import {
  emptyRhIncidenciaListFilters,
  type RhIncidenciasAdminViewModel,
  type RhIncidenciasEstadisticasData,
} from "../incidencias/rh/types.ts";
import { faltasRetardosFiltersFromSolicitudesMetricas } from "../faltasRetardos/rh/faltasRetardosMetricasFilterHelpers.ts";
import type {
  FaltasRetardosEstadisticasData,
  FaltasRetardosMetricasViewModel,
} from "../faltasRetardos/rh/types.ts";
import type {
  RhSolicitudFilterState,
  RhSolicitudesAdminViewModel,
  RhSolicitudTablaFila,
} from "../solicitudes/rh/types.ts";
import { buildMetricasPageUiConfig } from "../solicitudes/solicitudesPageFilterConfig.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SHELL_CLASS =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

const EMPTY_INC_CATALOG: RhIncidenciasFilterCatalog = {
  tiposRegistrados: [],
  areasRegistradas: [],
  subareasRegistradas: [],
};

function emptySolicitudFilterState(): RhSolicitudFilterState {
  return {
    tipo: "",
    area_id: "",
    supervisor_id: "",
    empleado_id: "",
    empleado_busqueda: "",
    no_empleado: "",
    fecha_inicio: "",
    fecha_fin: "",
    estado: "",
    page: 1,
    page_size: 10,
  };
}

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description:
      "La analítica de métricas está disponible solo para usuarios con rol Recursos Humanos, supervisor o gerente.",
  });
}

function loadingSolicitudesViewModel(ui: RhSolicitudesAdminViewModel["ui"]): RhSolicitudesAdminViewModel {
  const filters = emptySolicitudFilterState();
  return {
    stats: null,
    statsStatus: "ready",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: "ready",
    filterOptions: buildRhSolicitudFilterOptions([]),
    filters,
    tableStatus: "loading",
    table: null,
    tableErrorMessage: undefined,
    profileResumen: null,
    ui,
    personasDiaChartRows: [],
  };
}

function errorSolicitudesViewModel(
  message: string,
  ui: RhSolicitudesAdminViewModel["ui"],
): RhSolicitudesAdminViewModel {
  const filters = emptySolicitudFilterState();
  return {
    stats: null,
    statsStatus: "ready",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: "ready",
    filterOptions: buildRhSolicitudFilterOptions([]),
    filters,
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
    profileResumen: null,
    ui,
    personasDiaChartRows: [],
  };
}

function loadingIncidenciasViewModel(): RhIncidenciasAdminViewModel {
  const empty = emptyRhIncidenciaListFilters();
  return buildMetricasIncidenciasViewModel(
    null,
    "loading",
    undefined,
    empty,
    empty,
    incidenciasUiConfig(),
    EMPTY_INC_CATALOG,
  );
}

function loadingFaltasRetardosViewModel(): FaltasRetardosMetricasViewModel {
  return {
    estadisticas: null,
    estadisticasStatus: "loading",
    estadisticasErrorMessage: undefined,
    empleadosRetardosRanking: [],
  };
}

export function mountMetricas(container: HTMLElement, signal: AbortSignal): void {
  const mainClass = "py-0";

  if (!canAccessMetricasPage()) {
    mountAppShell(container, {
      pageTitle: "Métricas",
      activeNav: "metricas",
      mainClass,
      mainHtml: `<div id="rh-metricas-page" class="${PAGE_SHELL_CLASS}">${renderLaboralesBackBar()}${forbiddenHtml()}</div>`,
    });
    return;
  }

  const pageUi = buildMetricasPageUiConfig();
  const incUi = incidenciasUiConfig();

  let allRows: RhSolicitudTablaFila[] = [];
  let filterOpts = buildRhSolicitudFilterOptions([]);
  let filterDraft = emptySolicitudFilterState();
  let appliedFilters = emptySolicitudFilterState();

  let incEstadisticas: RhIncidenciasEstadisticasData | null = null;
  let incEstadisticasStatus: "loading" | "ready" | "error" = "loading";
  let incEstadisticasError: string | undefined;
  let incLoadSeq = 0;

  let frEstadisticas: FaltasRetardosEstadisticasData | null = null;
  let frEstadisticasStatus: FaltasRetardosMetricasViewModel["estadisticasStatus"] = "loading";
  let frEstadisticasError: string | undefined;
  let frEmpleadosRetardosRanking: readonly SolicitudRankingRow[] = [];
  let frLoadSeq = 0;

  function buildFaltasRetardosMetricasVm(): FaltasRetardosMetricasViewModel {
    return {
      estadisticas: frEstadisticas,
      estadisticasStatus: frEstadisticasStatus,
      estadisticasErrorMessage: frEstadisticasError,
      empleadosRetardosRanking: frEmpleadosRetardosRanking,
    };
  }

  function appliedIncidenciasFilters() {
    return incidenciasFiltersFromSolicitudesMetricas(appliedFilters);
  }

  function buildIncidenciasVm(): RhIncidenciasAdminViewModel {
    const applied = appliedIncidenciasFilters();
    return buildMetricasIncidenciasViewModel(
      incEstadisticas,
      incEstadisticasStatus,
      incEstadisticasError,
      cloneRhIncidenciaListFilters(applied),
      cloneRhIncidenciaListFilters(incidenciasFiltersFromSolicitudesMetricas(filterDraft)),
      incUi,
      EMPTY_INC_CATALOG,
    );
  }

  function paint(): void {
    const solVm = buildRhSolicitudesAdminViewModel(
      allRows,
      filterOpts,
      { ...filterDraft },
      pageUi,
      null,
      null,
    );
    solVm.personasDiaChartRows = filterRhSolicitudRows(allRows, appliedFilters);
    const incVm = buildIncidenciasVm();
    const frVm = buildFaltasRetardosMetricasVm();
    const inner = container.querySelector("#rh-metricas-inner");
    if (inner) {
      destroyChartsIn(inner);
      inner.innerHTML = renderRhMetricasView(solVm, incVm, frVm);
      runChartsAfterLayout(inner, () => {
        mountRhSolicitudesAnalyticsFromRows(
          inner,
          solVm.personasDiaChartRows,
          solVm.tableStatus,
          destroyChart,
          destroyChartsIn,
        );
        const incSection = inner.querySelector("#rh-metricas-seccion-incidencias");
        mountRhIncidenciasAnalyticsCharts(incSection ?? inner, incVm, destroyChart, destroyChartsIn);
        const frSection = inner.querySelector("#rh-metricas-seccion-faltas-retardos");
        mountRhFaltasRetardosMetricasCharts(frSection ?? inner, frVm, destroyChart, destroyChartsIn);
      });
    }
  }

  async function loadFaltasRetardosEstadisticas(): Promise<void> {
    const seq = ++frLoadSeq;
    const isStale = (): boolean => seq !== frLoadSeq;

    frEstadisticasStatus = "loading";
    frEstadisticas = null;
    frEstadisticasError = undefined;
    frEmpleadosRetardosRanking = [];
    paint();

    try {
      const filters = faltasRetardosFiltersFromSolicitudesMetricas(appliedFilters);
      const filtersRetardo = { ...filters, tipo: "retardo" as const };
      const [estadisticas, retardosEstadisticas] = await Promise.all([
        getFaltasRetardosEstadisticas(filters),
        getFaltasRetardosEstadisticas(filtersRetardo).catch(() => null),
      ]);
      if (isStale()) return;
      frEstadisticas = estadisticas;
      frEmpleadosRetardosRanking = retardosEstadisticas
        ? aggregateEmpleadosRetardosTop(retardosEstadisticas.empleados_con_mas_eventos)
        : [];
      frEstadisticasStatus = "ready";
      frEstadisticasError = undefined;
    } catch (err) {
      if (isStale()) return;
      const fetchError = err as { status?: number; detail?: string };
      if (fetchError?.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      frEstadisticas = null;
      frEstadisticasStatus = "error";
      frEstadisticasError =
        fetchError?.detail || "No se pudieron cargar las estadísticas de faltas y retardos.";
      frEmpleadosRetardosRanking = [];
    }
    if (isStale()) return;
    paint();
  }

  async function loadIncidenciasEstadisticas(): Promise<void> {
    const seq = ++incLoadSeq;
    const isStale = (): boolean => seq !== incLoadSeq;

    incEstadisticasStatus = "loading";
    incEstadisticas = null;
    incEstadisticasError = undefined;
    paint();

    try {
      const applied = appliedIncidenciasFilters();
      incEstadisticas = await fetchIncidenciasEstadisticas(applied);
      if (isStale()) return;
      incEstadisticasStatus = "ready";
      incEstadisticasError = undefined;
    } catch (err) {
      if (isStale()) return;
      const fetchError = err as IncidenciasFetchError;
      if (fetchError?.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      incEstadisticas = null;
      incEstadisticasStatus = "error";
      incEstadisticasError =
        fetchError?.detail || "No se pudieron cargar las estadísticas de incidencias.";
    }
    if (isStale()) return;
    paint();
  }

  function refreshMetricas(): void {
    paint();
    void loadIncidenciasEstadisticas();
    void loadFaltasRetardosEstadisticas();
  }

  function applyMetricasFilters(): void {
    const pageRoot = container.querySelector("#rh-metricas-page");
    if (!pageRoot) return;
    filterDraft = readMetricasFiltersFromDom(pageRoot, filterDraft);
    if (!fechasRangoMetricasValido(filterDraft.fecha_inicio, filterDraft.fecha_fin)) {
      showEmpleadosToast(
        container,
        "La fecha final no puede ser anterior a la fecha inicial.",
        "error",
      );
      return;
    }
    filterDraft = metricasFiltrosAplicados(filterDraft);
    appliedFilters = { ...filterDraft };
    refreshMetricas();
  }

  mountAppShell(container, {
    pageTitle: "Métricas",
    activeNav: "metricas",
    mainClass,
    mainHtml: `<div id="rh-metricas-page" class="${PAGE_SHELL_CLASS}">
      ${renderLaboralesBackBar()}
      <div id="rh-metricas-inner" class="flex min-h-0 flex-1 flex-col">${renderRhMetricasView(loadingSolicitudesViewModel(pageUi), loadingIncidenciasViewModel(), loadingFaltasRetardosViewModel())}</div>
    </div>`,
  });

  const pageRoot = container.querySelector("#rh-metricas-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-rh-metricas-apply-filters]")) {
        applyMetricasFilters();
        return;
      }
    },
    { signal },
  );

  void (async () => {
    try {
      allRows = await getSolicitudesRows();
      filterOpts = buildRhSolicitudFilterOptions(allRows);
      refreshMetricas();
    } catch (error) {
      const fetchError = error as SolicitudesFetchError;
      if (fetchError?.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      allRows = [];
      filterOpts = buildRhSolicitudFilterOptions([]);
      const inner = container.querySelector("#rh-metricas-inner");
      if (inner) {
        inner.innerHTML = renderRhMetricasView(
          errorSolicitudesViewModel(fetchError?.detail || "Error inesperado al cargar métricas.", pageUi),
          buildIncidenciasVm(),
          buildFaltasRetardosMetricasVm(),
        );
      }
    }
  })();
}
