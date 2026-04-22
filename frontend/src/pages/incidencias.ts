import { canAccessRhIncidenciasPage, getRolFromAccessToken } from "../auth/jwt.ts";
import { getIncidenciasRows, type IncidenciasFetchError } from "../api/incidencias.ts";
import { clearAuth } from "../auth/session.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { renderRhIncidenciasAdminView } from "../components/incidencias/rhIncidenciasAdminView.ts";
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
import { buildRhIncidenciasAdminViewModel } from "../incidencias/rh/fetchRhIncidenciasAdminMock.ts";
import { filterRhIncidenciaRows } from "../incidencias/rh/filterAndPaginateRhIncidencias.ts";
import type {
  RhIncidenciaEstadoCodigo,
  RhIncidenciaFilterState,
  RhIncidenciasAdminViewModel,
  RhIncidenciasUiConfig,
  RhIncidenciaTipoCodigo,
  RhIncidenciaTablaFila,
} from "../incidencias/rh/types.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeIncHtml } from "../components/incidencias/rhIncidenciasUiUtils.ts";

function forbiddenHtml(): string {
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">${escapeIncHtml(INC_COPY.accesoDenegadoTitulo)}</p>
      <p class="mt-1">${escapeIncHtml(INC_COPY.accesoDenegadoTexto)}</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">${escapeIncHtml(INC_COPY.volverDashboard)}</a>
    </div>`;
}

function incidenciasUiConfig(): RhIncidenciasUiConfig {
  const rol = getRolFromAccessToken();
  if (rol === "rh") return { modoFiltros: "rh", mostrarFiltroSupervisor: true };
  if (rol === "gerente" || rol === "supervisor") return { modoFiltros: "rh", mostrarFiltroSupervisor: false };
  return { modoFiltros: "estandar", mostrarFiltroSupervisor: true };
}

function loadingViewModel(): RhIncidenciasAdminViewModel {
  return {
    resumen: null,
    resumenStatus: "loading",
    filterOptions: buildRhIncidenciaFilterOptions([]),
    filters: {
      area_id: "",
      empleado_busqueda: "",
      supervisor_id: "",
      tipo: "",
      estado: "",
      periodo: "30d",
      page: 1,
      page_size: 10,
    },
    ui: incidenciasUiConfig(),
    tableStatus: "loading",
    table: null,
    tableErrorMessage: undefined,
  };
}

function errorViewModel(message: string): RhIncidenciasAdminViewModel {
  return {
    resumen: null,
    resumenStatus: "error",
    filterOptions: buildRhIncidenciaFilterOptions([]),
    filters: {
      area_id: "",
      empleado_busqueda: "",
      supervisor_id: "",
      tipo: "",
      estado: "",
      periodo: "30d",
      page: 1,
      page_size: 10,
    },
    ui: incidenciasUiConfig(),
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
  };
}

function isTipo(v: string): v is RhIncidenciaTipoCodigo {
  return (
    v === "falta_injustificada" ||
    v === "retardo" ||
    v === "indisciplina" ||
    v === "dano_equipo"
  );
}

function isEstado(v: string): v is RhIncidenciaEstadoCodigo {
  return v === "abierto" || v === "en_investigacion" || v === "cerrado";
}

function isPeriodo(v: string): v is RhIncidenciaFilterState["periodo"] {
  return v === "30d" || v === "90d" || v === "365d" || v === "all";
}

export function mountIncidencias(container: HTMLElement, signal: AbortSignal): void {
  const incidenciasMainClass = "py-5 sm:py-6";

  if (!canAccessRhIncidenciasPage()) {
    mountAppShell(container, {
      pageTitle: INC_COPY.tituloPagina,
      activeNav: "incidencias",
      mainClass: incidenciasMainClass,
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  let allRows: RhIncidenciaTablaFila[] = [];
  let filterOpts = buildRhIncidenciaFilterOptions([]);

  const state: RhIncidenciaFilterState = {
    area_id: "",
    empleado_busqueda: "",
    supervisor_id: "",
    tipo: "",
    estado: "",
    periodo: "30d",
    page: 1,
    page_size: 10,
  };

  const uiConfig = incidenciasUiConfig();

  let empleadoBusquedaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function clampPage(): void {
    const filtered = filterRhIncidenciaRows(allRows, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.page_size) || 1);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
  }

  function paint(): void {
    if (!uiConfig.mostrarFiltroSupervisor) state.supervisor_id = "";
    clampPage();
    const vm = buildRhIncidenciasAdminViewModel(allRows, filterOpts, state, uiConfig);
    const inner = container.querySelector("#rh-incidencias-inner");
    const active = document.activeElement;
    let restoreEmpSearch: { start: number; end: number; dir: "forward" | "backward" | "none" } | null = null;
    if (active instanceof HTMLInputElement && active.matches("[data-rh-inc-empleado-busqueda]")) {
      restoreEmpSearch = {
        start: active.selectionStart ?? active.value.length,
        end: active.selectionEnd ?? active.value.length,
        dir:
          active.selectionDirection === "backward"
            ? "backward"
            : active.selectionDirection === "none"
              ? "none"
              : "forward",
      };
    }
    if (inner) inner.innerHTML = renderRhIncidenciasAdminView(vm);
    if (restoreEmpSearch) {
      const el = container.querySelector<HTMLInputElement>("[data-rh-inc-empleado-busqueda]");
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(restoreEmpSearch.start, restoreEmpSearch.end, restoreEmpSearch.dir);
        } catch {
          /* noop */
        }
      }
    }
  }

  mountAppShell(container, {
    pageTitle: INC_COPY.tituloPagina,
    activeNav: "incidencias",
    mainClass: incidenciasMainClass,
    mainHtml: `<div id="rh-incidencias-page" class="relative flex min-h-[calc(100dvh-11rem)] flex-col">
      <div id="rh-incidencias-inner" class="flex min-h-0 flex-1 flex-col">${renderRhIncidenciasAdminView(loadingViewModel())}</div>
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
      if (t.closest("#rh-inc-nueva")) {
        nuevaIncidenciaModal?.open();
        return;
      }
      if (t.closest("#rh-inc-filtros-av")) {
        showEmpleadosToast(container, "Filtros avanzados en integracion.", "error");
        return;
      }
      if (t.closest("[data-rh-inc-clear-filters]")) {
        state.area_id = "";
        state.empleado_busqueda = "";
        state.supervisor_id = "";
        state.tipo = "";
        state.estado = "";
        state.periodo = "30d";
        state.page = 1;
        paint();
        return;
      }
      if (t.closest("[data-rh-inc-historial]")) {
        showEmpleadosToast(container, "Historial no disponible en esta version.", "error");
        return;
      }
      if (t.closest("[data-rh-inc-ev-descarga]")) {
        showEmpleadosToast(container, "Descarga de evidencia no disponible.", "error");
        return;
      }
      const row = t.closest<HTMLTableRowElement>("tr[data-rh-inc-row]");
      if (row) {
        const raw = row.getAttribute("data-rh-inc-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        const fila = Number.isFinite(id) ? allRows.find((r) => r.id === id) : undefined;
        if (fila) detalleModal?.open(fila);
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-inc-page]");
      if (pageBtn) {
        const raw = pageBtn.getAttribute("data-rh-inc-page");
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n)) {
          state.page = n;
          paint();
        }
      }
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "keydown",
    (e: Event) => {
      const ke = e as KeyboardEvent;
      const tr = (ke.target as HTMLElement | null)?.closest?.("tr[data-rh-inc-row]");
      if (!tr) return;
      if (ke.key !== "Enter" && ke.key !== " ") return;
      ke.preventDefault();
      const raw = tr.getAttribute("data-rh-inc-id");
      const id = raw ? Number.parseInt(raw, 10) : NaN;
      const fila = Number.isFinite(id) ? allRows.find((r) => r.id === id) : undefined;
      if (fila) detalleModal?.open(fila);
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      if (uiConfig.modoFiltros !== "rh") return;
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-inc-empleado-busqueda]");
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
      const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-inc-filter]");
      if (sel) {
        const name = sel.getAttribute("data-rh-inc-filter");
        const value = sel.value;
        state.page = 1;
        if (name === "area") state.area_id = value;
        else if (name === "supervisor") state.supervisor_id = value;
        else if (name === "tipo") state.tipo = value === "" ? "" : isTipo(value) ? value : "";
        else if (name === "estado") state.estado = value === "" ? "" : isEstado(value) ? value : "";
        else if (name === "periodo") state.periodo = isPeriodo(value) ? value : "30d";
        paint();
        return;
      }
      const ps = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-inc-page-size]");
      if (ps) {
        const n = Number.parseInt(ps.value, 10);
        state.page_size = Number.isNaN(n) ? 10 : n;
        state.page = 1;
        paint();
      }
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    if (empleadoBusquedaDebounceTimer != null) {
      window.clearTimeout(empleadoBusquedaDebounceTimer);
      empleadoBusquedaDebounceTimer = null;
    }
    nuevaIncidenciaModal?.destroy();
    detalleModal?.destroy();
  });

  void (async () => {
    try {
      allRows = await getIncidenciasRows();
      filterOpts = buildRhIncidenciaFilterOptions(allRows);
      paint();
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
      allRows = [];
      filterOpts = buildRhIncidenciaFilterOptions([]);
      const errVm = errorViewModel(fetchError?.detail || "Error inesperado al cargar incidencias.");
      const inner = container.querySelector("#rh-incidencias-inner");
      if (inner) inner.innerHTML = renderRhIncidenciasAdminView(errVm);
    }
  })();
}
