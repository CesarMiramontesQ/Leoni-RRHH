import { canAccessMetricasPage } from "../auth/jwt.ts";
import { getSolicitudesRows, type SolicitudesFetchError } from "../api/solicitudes.ts";
import { clearAuth } from "../auth/session.ts";
import { renderRhMetricasView } from "../components/solicitudes/rhSolicitudesAdminView.ts";
import { mountRhSolicitudesAnalyticsFromRows } from "../components/solicitudes/rhSolicitudesAnalyticsSection.ts";
import { destroyChart, destroyChartsIn } from "../charts/index.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { buildRhSolicitudFilterOptions } from "../solicitudes/rh/buildRhSolicitudFilterOptions.ts";
import { buildRhSolicitudesAdminViewModel } from "../solicitudes/rh/fetchRhSolicitudesAdminMock.ts";
import { filterRhSolicitudRows } from "../solicitudes/rh/filterAndPaginateRhSolicitudes.ts";
import type {
  RhSolicitudEstadoCodigo,
  RhSolicitudFilterState,
  RhSolicitudTipoCodigo,
  RhSolicitudesAdminViewModel,
  RhSolicitudTablaFila,
} from "../solicitudes/rh/types.ts";
import { buildMetricasPageUiConfig } from "../solicitudes/solicitudesPageFilterConfig.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SHELL_CLASS =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "La analítica de métricas está disponible solo para usuarios con rol Recursos Humanos.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

function loadingViewModel(ui: RhSolicitudesAdminViewModel["ui"]): RhSolicitudesAdminViewModel {
  return {
    stats: null,
    statsStatus: "ready",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: "ready",
    filterOptions: buildRhSolicitudFilterOptions([]),
    filters: {
      tipo: "",
      area_id: "",
      supervisor_id: "",
      empleado_id: "",
      empleado_busqueda: "",
      estado: "",
      page: 1,
      page_size: 10,
    },
    tableStatus: "loading",
    table: null,
    tableErrorMessage: undefined,
    profileResumen: null,
    ui,
    personasDiaChartRows: [],
  };
}

function errorViewModel(message: string, ui: RhSolicitudesAdminViewModel["ui"]): RhSolicitudesAdminViewModel {
  return {
    stats: null,
    statsStatus: "ready",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: "ready",
    filterOptions: buildRhSolicitudFilterOptions([]),
    filters: {
      tipo: "",
      area_id: "",
      supervisor_id: "",
      empleado_id: "",
      empleado_busqueda: "",
      estado: "",
      page: 1,
      page_size: 10,
    },
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
    profileResumen: null,
    ui,
    personasDiaChartRows: [],
  };
}

function isTipo(v: string): v is RhSolicitudTipoCodigo {
  return (
    v === "vacaciones" ||
    v === "home_office" ||
    v === "permiso_sin_goce_sueldo" ||
    v === "matrimonio" ||
    v === "incapacidad_interna" ||
    v === "defuncion" ||
    v === "paternidad"
  );
}

function isEstado(v: string): v is RhSolicitudEstadoCodigo {
  return (
    v === "pending" ||
    v === "approved" ||
    v === "rejected" ||
    v === "changes_requested" ||
    v === "cancelled" ||
    v === "overridden"
  );
}

export function mountMetricas(container: HTMLElement, signal: AbortSignal): void {
  const mainClass = "py-0";

  if (!canAccessMetricasPage()) {
    mountAppShell(container, {
      pageTitle: "Métricas",
      activeNav: "metricas",
      mainClass,
      mainHtml: `<div id="rh-metricas-page" class="${PAGE_SHELL_CLASS}">${forbiddenHtml()}</div>`,
    });
    return;
  }

  const pageUi = buildMetricasPageUiConfig();
  let allRows: RhSolicitudTablaFila[] = [];
  let filterOpts = buildRhSolicitudFilterOptions([]);
  let state: RhSolicitudFilterState = {
    tipo: "",
    area_id: "",
    supervisor_id: "",
    empleado_id: "",
    empleado_busqueda: "",
    estado: "",
    page: 1,
    page_size: 10,
  };
  let empleadoBusquedaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function clampPage(): void {
    const filtered = filterRhSolicitudRows(allRows, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.page_size) || 1);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
  }

  function paint(): void {
    clampPage();
    const vm = buildRhSolicitudesAdminViewModel(allRows, filterOpts, state, pageUi, null, null);
    const inner = container.querySelector("#rh-metricas-inner");
    const active = document.activeElement;
    let restoreEmpSearch: { start: number; end: number; dir: "forward" | "backward" | "none" } | null = null;
    if (active instanceof HTMLInputElement && active.matches("[data-rh-sol-empleado-busqueda]")) {
      restoreEmpSearch = {
        start: active.selectionStart ?? active.value.length,
        end: active.selectionEnd ?? active.value.length,
        dir:
          active.selectionDirection === "backward" ? "backward"
          : active.selectionDirection === "none" ? "none"
          : "forward",
      };
    }
    if (inner) {
      inner.innerHTML = renderRhMetricasView(vm);
      mountRhSolicitudesAnalyticsFromRows(inner, vm.personasDiaChartRows, vm.tableStatus, destroyChart, destroyChartsIn);
    }
    if (restoreEmpSearch) {
      const el = container.querySelector<HTMLInputElement>('[data-rh-sol-empleado-busqueda][data-rh-sol-scope="main"]');
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(restoreEmpSearch.start, restoreEmpSearch.end, restoreEmpSearch.dir);
        } catch {
          /* algunos tipos de input restringen setSelectionRange */
        }
      }
    }
  }

  mountAppShell(container, {
    pageTitle: "Métricas",
    activeNav: "metricas",
    mainClass,
    mainHtml: `<div id="rh-metricas-page" class="${PAGE_SHELL_CLASS}">
      <div id="rh-metricas-inner" class="flex min-h-0 flex-1 flex-col">${renderRhMetricasView(loadingViewModel(pageUi))}</div>
    </div>`,
  });

  signal.addEventListener("abort", () => {
    if (empleadoBusquedaDebounceTimer != null) {
      window.clearTimeout(empleadoBusquedaDebounceTimer);
      empleadoBusquedaDebounceTimer = null;
    }
  });

  const pageRoot = container.querySelector("#rh-metricas-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-rh-sol-clear-filters]")) {
        state.tipo = "";
        state.area_id = "";
        state.supervisor_id = "";
        state.empleado_id = "";
        state.empleado_busqueda = "";
        state.estado = "";
        state.page = 1;
        paint();
      }
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-sol-empleado-busqueda]");
      if (!inp) return;
      state.empleado_busqueda = inp.value;
      state.page = 1;
      if (empleadoBusquedaDebounceTimer != null) window.clearTimeout(empleadoBusquedaDebounceTimer);
      empleadoBusquedaDebounceTimer = window.setTimeout(() => {
        empleadoBusquedaDebounceTimer = null;
        paint();
      }, 200);
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "change",
    (e) => {
      const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-sol-filter]");
      if (sel) {
        const name = sel.getAttribute("data-rh-sol-filter");
        const value = sel.value;
        state.page = 1;
        if (name === "tipo") state.tipo = value === "" ? "" : isTipo(value) ? value : "";
        else if (name === "area") state.area_id = value;
        else if (name === "supervisor") state.supervisor_id = value;
        else if (name === "empleado") state.empleado_id = value;
        else if (name === "estado") state.estado = value === "" ? "" : isEstado(value) ? value : "";
        paint();
        return;
      }
      const ps = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-sol-page-size]");
      if (ps) {
        const n = Number.parseInt(ps.value, 10);
        state.page_size = Number.isNaN(n) ? 10 : n;
        state.page = 1;
        paint();
      }
    },
    { signal },
  );

  void (async () => {
    try {
      allRows = await getSolicitudesRows();
      filterOpts = buildRhSolicitudFilterOptions(allRows);
      paint();
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
          errorViewModel(fetchError?.detail || "Error inesperado al cargar métricas.", pageUi),
        );
      }
    }
  })();
}
