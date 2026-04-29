import {
  canAccessSolicitudesPage,
  getEmpleadoDirectoryNumericIdFromAccessToken,
} from "../auth/jwt.ts";
import { getSolicitudById, getSolicitudesRows, type SolicitudesFetchError } from "../api/solicitudes.ts";
import { clearAuth } from "../auth/session.ts";
import {
  mountSolicitudResueltaModal,
  type SolicitudResueltaModalHandle,
} from "../components/solicitudes/solicitudResueltaModal.ts";
import {
  mountSolicitudDetalleModal,
  type SolicitudDetalleModalHandle,
} from "../components/solicitudes/solicitudDetalleModal.ts";
import {
  mountRhNewRequestModal,
  type RhNewRequestModalHandle,
} from "../components/solicitudes/rhNewRequestModal.ts";
import { renderRhSolicitudesAdminView } from "../components/solicitudes/rhSolicitudesAdminView.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { buildRhSolicitudFilterOptions } from "../solicitudes/rh/buildRhSolicitudFilterOptions.ts";
import { buildRhSolicitudesAdminViewModel } from "../solicitudes/rh/fetchRhSolicitudesAdminMock.ts";
import {
  buildDefaultSolicitudesPageUiConfig,
  getSolicitudesPageRoleFromSession,
} from "../solicitudes/solicitudesPageFilterConfig.ts";
import { filterRhSolicitudRows } from "../solicitudes/rh/filterAndPaginateRhSolicitudes.ts";
import type {
  RhSolicitudEstadoCodigo,
  RhSolicitudFilterState,
  RhSolicitudTipoCodigo,
  RhSolicitudesAdminViewModel,
  RhSolicitudTablaFila,
} from "../solicitudes/rh/types.ts";

function forbiddenHtml(): string {
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">Esta sección de solicitudes no está disponible para tu usuario.</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al dashboard</a>
    </div>`;
}

function loadingViewModel(ui: RhSolicitudesAdminViewModel["ui"]): RhSolicitudesAdminViewModel {
  return {
    stats: null,
    statsStatus: ui.showStatsCards ? "loading" : "ready",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: ui.showEmployeePersonalStats ? "loading" : "ready",
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
  };
}

function errorViewModel(message: string, ui: RhSolicitudesAdminViewModel["ui"]): RhSolicitudesAdminViewModel {
  return {
    stats: null,
    statsStatus: "error",
    empleadoPersonalStats: null,
    empleadoPersonalStatsStatus: ui.showEmployeePersonalStats ? "error" : "ready",
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
  };
}

function isTipo(v: string): v is RhSolicitudTipoCodigo {
  return v === "vacaciones" || v === "home_office";
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

function getInitialFiltersFromHash(): Pick<RhSolicitudFilterState, "tipo" | "estado"> {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return { tipo: "", estado: "" };
  const rawQuery = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(rawQuery);
  const tipo = params.get("tipo") ?? "";
  const estado = params.get("estado") ?? "";
  return {
    tipo: isTipo(tipo) ? tipo : "",
    estado: isEstado(estado) ? estado : "",
  };
}

export function mountSolicitudes(container: HTMLElement, signal: AbortSignal): void {
  const solicitudesMainClass = "py-5 sm:py-6";

  if (!canAccessSolicitudesPage()) {
    mountAppShell(container, {
      pageTitle: "Solicitudes",
      activeNav: "solicitudes",
      mainClass: solicitudesMainClass,
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const pageRole = getSolicitudesPageRoleFromSession();
  if (!pageRole) {
    mountAppShell(container, {
      pageTitle: "Solicitudes",
      activeNav: "solicitudes",
      mainClass: solicitudesMainClass,
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const pageUi = buildDefaultSolicitudesPageUiConfig(pageRole);
  const sessionEmpleadoDirId = getEmpleadoDirectoryNumericIdFromAccessToken();
  const initialFilters = getInitialFiltersFromHash();

  let allRows: RhSolicitudTablaFila[] = [];
  let filterOpts = buildRhSolicitudFilterOptions([]);
  let empleadoVacacionesDisponibles: number | null = null;

  const state: RhSolicitudFilterState = {
    tipo: initialFilters.tipo,
    area_id: "",
    supervisor_id: "",
    empleado_id: "",
    empleado_busqueda: "",
    estado: initialFilters.estado,
    page: 1,
    page_size: 10,
  };

  let empleadoBusquedaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function recargarSolicitudesDesdeApi(): Promise<void> {
    allRows = await getSolicitudesRows();
    filterOpts = buildRhSolicitudFilterOptions(allRows);
    empleadoVacacionesDisponibles = null;
    paint();
  }

  function clampPage(): void {
    const filtered = filterRhSolicitudRows(allRows, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.page_size) || 1);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
  }

  function paint(): void {
    clampPage();
    const vm = buildRhSolicitudesAdminViewModel(
      allRows,
      filterOpts,
      state,
      pageUi,
      null,
      empleadoVacacionesDisponibles,
    );
    const inner = container.querySelector("#rh-solicitudes-inner");
    const active = document.activeElement;
    let restoreEmpSearch: { start: number; end: number; dir: "forward" | "backward" | "none" } | null = null;
    if (active instanceof HTMLInputElement && active.matches("[data-rh-sol-empleado-busqueda]")) {
      restoreEmpSearch = {
        start: active.selectionStart ?? active.value.length,
        end: active.selectionEnd ?? active.value.length,
        dir: active.selectionDirection === "backward" ? "backward" : active.selectionDirection === "none" ? "none" : "forward",
      };
    }
    if (inner) inner.innerHTML = renderRhSolicitudesAdminView(vm);
    if (restoreEmpSearch) {
      const el = container.querySelector<HTMLInputElement>("[data-rh-sol-empleado-busqueda]");
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

  let rhNuevaSolicitudModal: RhNewRequestModalHandle | null = null;
  let solicitudDetalleModal: SolicitudDetalleModalHandle | null = null;
  let solicitudResueltaModal: SolicitudResueltaModalHandle | null = null;

  const shellTitle = pageRole === "empleado" ? "Solicitudes" : "Solicitudes de empleados";

  mountAppShell(container, {
    pageTitle: shellTitle,
    activeNav: "solicitudes",
    mainClass: solicitudesMainClass,
    mainHtml: `<div id="rh-solicitudes-page" class="relative flex min-h-[calc(100dvh-11rem)] flex-col">
      <div id="rh-solicitudes-inner" class="flex min-h-0 flex-1 flex-col">${renderRhSolicitudesAdminView(loadingViewModel(pageUi))}</div>
      <div id="rh-nueva-solicitud-modal-host" class="shrink-0"></div>
      <div id="rh-solicitud-detalle-modal-host" class="shrink-0"></div>
      <div id="rh-solicitud-resuelta-modal-host" class="shrink-0"></div>
    </div>`,
  });

  const detalleHostEl = container.querySelector("#rh-solicitud-detalle-modal-host");
  if (detalleHostEl) {
    solicitudDetalleModal = mountSolicitudDetalleModal(detalleHostEl as HTMLElement, {
      signal,
      toastContainer: container,
      getFilaById: (id) => allRows.find((r) => r.id === id),
      onRefrescarListado: () => recargarSolicitudesDesdeApi(),
      soloLectura: pageRole === "empleado",
      cargarDetalleServidor: pageRole !== "empleado" ? (id) => getSolicitudById(id) : undefined,
    });
  }

  const empleadoSelfDirectoryId = pageRole === "empleado" ? sessionEmpleadoDirId ?? undefined : undefined;

  const modalHostEl = container.querySelector("#rh-nueva-solicitud-modal-host");
  if (modalHostEl && pageUi.showNewRequestButton) {
    rhNuevaSolicitudModal = mountRhNewRequestModal(modalHostEl as HTMLElement, {
      signal,
      toastContainer: container,
      onSuccess: async () => {
        await recargarSolicitudesDesdeApi();
      },
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      fixedEmpleadoDirectoryId: empleadoSelfDirectoryId ?? undefined,
    });
  }

  const resueltaHostEl = container.querySelector("#rh-solicitud-resuelta-modal-host");
  if (resueltaHostEl) {
    solicitudResueltaModal = mountSolicitudResueltaModal(resueltaHostEl as HTMLElement, {
      signal,
      toastContainer: container,
      getFilaById: (id) => allRows.find((r) => r.id === id),
      soloLectura: pageRole === "empleado",
      sesionEmpleadoDirectoryId: sessionEmpleadoDirId,
      onCorregirSolicitud: (sid) => {
        solicitudResueltaModal?.close();
        const dir = getEmpleadoDirectoryNumericIdFromAccessToken();
        if (dir == null || !rhNuevaSolicitudModal) return;
        void rhNuevaSolicitudModal.open(
          pageRole === "empleado" ?
            { revisarSolicitudId: sid }
          : { revisarSolicitudId: sid, fixedEmpleadoParaRevision: dir },
        );
      },
    });
  }

  function esCreadorDeSolicitud(fila: RhSolicitudTablaFila): boolean {
    if (sessionEmpleadoDirId == null) return false;
    const fid = Number.parseInt(fila.empleado_id, 10);
    return Number.isFinite(fid) && fid === sessionEmpleadoDirId;
  }

  function abrirSolicitudSegunEstado(fila: RhSolicitudTablaFila, id: number): void {
    if (fila.estado === "pending") {
      void solicitudDetalleModal?.open(id);
      return;
    }
    if (fila.estado === "changes_requested") {
      if (esCreadorDeSolicitud(fila) && rhNuevaSolicitudModal && sessionEmpleadoDirId != null) {
        void rhNuevaSolicitudModal.open(
          pageRole === "empleado" ?
            { revisarSolicitudId: id }
          : { revisarSolicitudId: id, fixedEmpleadoParaRevision: sessionEmpleadoDirId },
        );
        return;
      }
      void solicitudResueltaModal?.open(id);
      return;
    }
    if (
      fila.estado === "approved" ||
      fila.estado === "rejected" ||
      fila.estado === "overridden"
    ) {
      void solicitudResueltaModal?.open(id);
    }
  }

  signal.addEventListener("abort", () => {
    if (empleadoBusquedaDebounceTimer != null) {
      window.clearTimeout(empleadoBusquedaDebounceTimer);
      empleadoBusquedaDebounceTimer = null;
    }
    rhNuevaSolicitudModal?.destroy();
    solicitudDetalleModal?.destroy();
    solicitudResueltaModal?.destroy();
  });

  const pageRoot = container.querySelector("#rh-solicitudes-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;

      const ver = t.closest<HTMLElement>("[data-rh-sol-ver]");
      if (ver) {
        const raw = ver.getAttribute("data-rh-sol-ver");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isFinite(id)) return;
        const fila = allRows.find((r) => r.id === id);
        if (!fila) return;
        abrirSolicitudSegunEstado(fila, id);
        return;
      }

      if (t.closest("#rh-sol-nueva")) {
        void rhNuevaSolicitudModal?.open();
        return;
      }
      if (t.closest("#rh-sol-export")) {
        return;
      }
      if (t.closest("[data-rh-sol-clear-filters]")) {
        state.tipo = "";
        state.area_id = "";
        state.supervisor_id = "";
        state.empleado_id = "";
        state.empleado_busqueda = "";
        state.estado = "";
        state.page = 1;
        paint();
        return;
      }
      const pendingRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-pending]");
      if (pendingRow) {
        const raw = pendingRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const fila = allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const changesRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-changes]");
      if (changesRow) {
        const raw = changesRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const fila = allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const resueltaRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-resuelta]");
      if (resueltaRow) {
        const raw = resueltaRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const fila = allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-sol-page]");
      if (pageBtn) {
        const raw = pageBtn.getAttribute("data-rh-sol-page");
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
      const trPending = (ke.target as HTMLElement | null)?.closest?.("tr[data-rh-sol-row-pending]");
      const trRes = (ke.target as HTMLElement | null)?.closest?.("tr[data-rh-sol-row-resuelta]");
      const trChanges = (ke.target as HTMLElement | null)?.closest?.("tr[data-rh-sol-row-changes]");
      const tr = trPending ?? trRes ?? trChanges;
      if (!tr) return;
      if (ke.key !== "Enter" && ke.key !== " ") return;
      ke.preventDefault();
      const raw = tr.getAttribute("data-rh-sol-id");
      const id = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isFinite(id)) return;
      const fila = allRows.find((r) => r.id === id);
      if (!fila) return;
      abrirSolicitudSegunEstado(fila, id);
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
      await recargarSolicitudesDesdeApi();
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
      empleadoVacacionesDisponibles = null;
      const errVm = errorViewModel(
        fetchError?.detail || "Error inesperado al cargar solicitudes.",
        pageUi,
      );
      const inner = container.querySelector("#rh-solicitudes-inner");
      if (inner) inner.innerHTML = renderRhSolicitudesAdminView(errVm);
    }
  })();
}
