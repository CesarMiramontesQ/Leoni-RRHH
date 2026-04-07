import { canAccessRhIncidenciasPage } from "../auth/jwt.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { renderRhIncidenciasAdminView } from "../components/incidencias/rhIncidenciasAdminView.ts";
import { INC_COPY } from "../incidencias/rh/incidenciasCopy.ts";
import { buildRhIncidenciaFilterOptions } from "../incidencias/rh/buildRhIncidenciaFilterOptions.ts";
import {
  buildRhIncidenciasAdminViewModel,
  fetchRhIncidenciasAdminDatasetMock,
} from "../incidencias/rh/fetchRhIncidenciasAdminMock.ts";
import { filterRhIncidenciaRows } from "../incidencias/rh/filterAndPaginateRhIncidencias.ts";
import type {
  RhIncidenciaEstadoCodigo,
  RhIncidenciaFilterState,
  RhIncidenciasAdminViewModel,
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

function loadingViewModel(): RhIncidenciasAdminViewModel {
  return {
    resumen: null,
    resumenStatus: "loading",
    filterOptions: buildRhIncidenciaFilterOptions([]),
    filters: {
      area_id: "",
      supervisor_id: "",
      tipo: "",
      estado: "",
      periodo: "30d",
      page: 1,
      page_size: 10,
    },
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
      supervisor_id: "",
      tipo: "",
      estado: "",
      periodo: "30d",
      page: 1,
      page_size: 10,
    },
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
  if (!canAccessRhIncidenciasPage()) {
    mountAppShell(container, {
      pageTitle: INC_COPY.tituloPagina,
      activeNav: "incidencias",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  let allRows: RhIncidenciaTablaFila[] = [];
  let filterOpts = buildRhIncidenciaFilterOptions([]);

  const state: RhIncidenciaFilterState = {
    area_id: "",
    supervisor_id: "",
    tipo: "",
    estado: "",
    periodo: "30d",
    page: 1,
    page_size: 10,
  };

  function clampPage(): void {
    const filtered = filterRhIncidenciaRows(allRows, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.page_size) || 1);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
  }

  function paint(): void {
    clampPage();
    const vm = buildRhIncidenciasAdminViewModel(allRows, filterOpts, state);
    const inner = container.querySelector("#rh-incidencias-inner");
    if (inner) inner.innerHTML = renderRhIncidenciasAdminView(vm);
  }

  mountAppShell(container, {
    pageTitle: INC_COPY.tituloPagina,
    activeNav: "incidencias",
    mainHtml: `<div id="rh-incidencias-page" class="relative">
      <div id="rh-incidencias-inner">${renderRhIncidenciasAdminView(loadingViewModel())}</div>
    </div>`,
  });

  const pageRoot = container.querySelector("#rh-incidencias-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#rh-inc-export")) {
        showEmpleadosToast(container, INC_COPY.toastExportMock, "success");
        return;
      }
      if (t.closest("#rh-inc-nueva")) {
        showEmpleadosToast(container, INC_COPY.toastNuevaMock, "success");
        return;
      }
      if (t.closest("#rh-inc-filtros-av")) {
        showEmpleadosToast(container, INC_COPY.toastFiltrosAvMock, "success");
        return;
      }
      if (t.closest("[data-rh-inc-clear-filters]")) {
        state.area_id = "";
        state.supervisor_id = "";
        state.tipo = "";
        state.estado = "";
        state.periodo = "30d";
        state.page = 1;
        paint();
        return;
      }
      const row = t.closest<HTMLTableRowElement>("tr[data-rh-inc-row]");
      if (row) {
        const raw = row.getAttribute("data-rh-inc-id");
        if (raw) showEmpleadosToast(container, INC_COPY.toastDetalleMock, "success");
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
      if (raw) showEmpleadosToast(container, INC_COPY.toastDetalleMock, "success");
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

  void (async () => {
    const res = await fetchRhIncidenciasAdminDatasetMock(false);
    if (!res.ok) {
      allRows = [];
      filterOpts = buildRhIncidenciaFilterOptions([]);
      const errVm = errorViewModel(res.message);
      const inner = container.querySelector("#rh-incidencias-inner");
      if (inner) inner.innerHTML = renderRhIncidenciasAdminView(errVm);
      return;
    }
    allRows = res.rows;
    filterOpts = res.filterOptions;
    paint();
  })().catch(() => {
    allRows = [];
    filterOpts = buildRhIncidenciaFilterOptions([]);
    const errVm = errorViewModel("Error inesperado al cargar incidencias.");
    const inner = container.querySelector("#rh-incidencias-inner");
    if (inner) inner.innerHTML = renderRhIncidenciasAdminView(errVm);
  });
}
