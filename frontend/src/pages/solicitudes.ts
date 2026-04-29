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
import {
  renderRhSolicitudesAdminView,
  renderRhSolicitudesScopedSection,
} from "../components/solicitudes/rhSolicitudesAdminView.ts";
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
import { BTN_PRIMARY, BTN_SECONDARY } from "../ui/uiTokens.ts";

type SolicitudesScope = "main" | "personal" | "equipo";

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

function getInitialFiltersFromHash(): Pick<RhSolicitudFilterState, "tipo" | "estado" | "empleado_id"> {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return { tipo: "", estado: "", empleado_id: "" };
  const rawQuery = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(rawQuery);
  const tipo = params.get("tipo") ?? "";
  const estado = params.get("estado") ?? "";
  const empleadoDir = params.get("empleado_dir") ?? "";
  const empleado_id = /^\d+$/.test(empleadoDir.trim()) ? empleadoDir.trim() : "";
  return {
    tipo: isTipo(tipo) ? tipo : "",
    estado: isEstado(estado) ? estado : "",
    empleado_id,
  };
}

function scopeFromInteractiveElement(el: Element | null): SolicitudesScope {
  const raw = el?.getAttribute("data-rh-sol-scope");
  return raw === "personal" || raw === "equipo" ? raw : "main";
}

function rowMatchesEmpleadoId(row: RhSolicitudTablaFila, empleadoDirId: number): boolean {
  const fid = Number.parseInt(row.empleado_id, 10);
  return Number.isFinite(fid) && fid === empleadoDirId;
}

function rowMatchesSupervisorId(row: RhSolicitudTablaFila, empleadoDirId: number): boolean {
  const sid = Number.parseInt(row.supervisor_id, 10);
  return Number.isFinite(sid) && sid === empleadoDirId;
}

function renderSplitSolicitudesView(
  personalVm: RhSolicitudesAdminViewModel,
  equipoVm: RhSolicitudesAdminViewModel,
  options: { showExportButton: boolean; showNewRequestButton: boolean },
): string {
  const exportBtn = options.showExportButton
    ? `<button
          type="button"
          id="rh-sol-export"
          class="${BTN_SECONDARY}"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar solicitudes
        </button>`
    : "";
  const nuevaBtn = options.showNewRequestButton
    ? `<button
          type="button"
          id="rh-sol-nueva"
          class="${BTN_PRIMARY}"
        >
          <span aria-hidden="true">+</span> Nueva solicitud
        </button>`
    : "";

  return `
    <div id="rh-solicitudes-root" class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <div class="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
        <p class="min-w-0 max-w-2xl text-xs leading-snug text-text-muted sm:max-w-none sm:text-sm">Gestión y aprobación de vacaciones y home office</p>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">${exportBtn}${nuevaBtn}</div>
      </div>
      ${renderRhSolicitudesScopedSection(personalVm, {
        scope: "personal",
        title: "Mis Solicitudes",
        subtitle: "Tus trámites personales y su estado actual",
      })}
      ${renderRhSolicitudesScopedSection(equipoVm, {
        scope: "equipo",
        title: "Solicitudes del Equipo",
        subtitle: "Trámites del personal a tu cargo",
      })}
    </div>`;
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
  const isSplitGestorRole = pageRole === "supervisor" || pageRole === "gerente";
  const sessionEmpleadoDirId = getEmpleadoDirectoryNumericIdFromAccessToken();
  const initialFilters = getInitialFiltersFromHash();
  const initialEmpleadoDirFromHash = initialFilters.empleado_id;
  const personalSectionUi = {
    ...pageUi,
    role: "empleado" as const,
    variant: "gestor" as const,
    visibleFilterKeys: ["type", "status"] as const,
    showExportButton: false,
    showNewRequestButton: false,
    showGestorToolbar: false,
  };
  const equipoSectionUi = {
    ...pageUi,
    showExportButton: false,
    showNewRequestButton: false,
    showGestorToolbar: false,
  };

  let allRows: RhSolicitudTablaFila[] = [];
  let personalRows: RhSolicitudTablaFila[] = [];
  let teamRows: RhSolicitudTablaFila[] = [];
  let filterOpts = buildRhSolicitudFilterOptions([]);
  let personalFilterOpts = buildRhSolicitudFilterOptions([]);
  let teamFilterOpts = buildRhSolicitudFilterOptions([]);
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
  const personalState: RhSolicitudFilterState = { ...state };
  const teamState: RhSolicitudFilterState = {
    ...state,
    ...(initialEmpleadoDirFromHash ? { empleado_id: initialEmpleadoDirFromHash } : {}),
  };

  let empleadoBusquedaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function recargarSolicitudesDesdeApi(): Promise<void> {
    allRows = await getSolicitudesRows();
    filterOpts = buildRhSolicitudFilterOptions(allRows);
    if (isSplitGestorRole && sessionEmpleadoDirId != null) {
      personalRows = allRows.filter((row) => rowMatchesEmpleadoId(row, sessionEmpleadoDirId));
      const teamWithoutSelf = allRows.filter((row) => !rowMatchesEmpleadoId(row, sessionEmpleadoDirId));
      const teamBySupervisor = teamWithoutSelf.filter((row) => rowMatchesSupervisorId(row, sessionEmpleadoDirId));
      teamRows = teamBySupervisor.length > 0 ? teamBySupervisor : teamWithoutSelf;
      personalFilterOpts = buildRhSolicitudFilterOptions(personalRows);
      teamFilterOpts = buildRhSolicitudFilterOptions(teamRows);
    } else {
      personalRows = [];
      teamRows = [];
      personalFilterOpts = buildRhSolicitudFilterOptions([]);
      teamFilterOpts = buildRhSolicitudFilterOptions([]);
    }
    empleadoVacacionesDisponibles = null;
    paint();
  }

  function stateForScope(scope: SolicitudesScope): RhSolicitudFilterState {
    if (scope === "personal") return personalState;
    if (scope === "equipo") return teamState;
    return state;
  }

  function rowsForScope(scope: SolicitudesScope): RhSolicitudTablaFila[] {
    if (scope === "personal") return personalRows;
    if (scope === "equipo") return teamRows;
    return allRows;
  }

  function clampPage(scope: SolicitudesScope): void {
    const selectedState = stateForScope(scope);
    const filtered = filterRhSolicitudRows(rowsForScope(scope), selectedState);
    const totalPages = Math.max(1, Math.ceil(filtered.length / selectedState.page_size) || 1);
    if (selectedState.page > totalPages) selectedState.page = totalPages;
    if (selectedState.page < 1) selectedState.page = 1;
  }

  function paint(): void {
    clampPage("main");
    if (isSplitGestorRole) {
      clampPage("personal");
      clampPage("equipo");
    }
    const vm = buildRhSolicitudesAdminViewModel(allRows, filterOpts, state, pageUi, null, empleadoVacacionesDisponibles);
    const personalVm = buildRhSolicitudesAdminViewModel(
      personalRows,
      personalFilterOpts,
      personalState,
      personalSectionUi,
      null,
      empleadoVacacionesDisponibles,
    );
    const equipoVm = buildRhSolicitudesAdminViewModel(
      teamRows,
      teamFilterOpts,
      teamState,
      equipoSectionUi,
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
    if (inner) {
      inner.innerHTML =
        isSplitGestorRole ?
          renderSplitSolicitudesView(personalVm, equipoVm, {
            showExportButton: pageUi.showExportButton,
            showNewRequestButton: pageUi.showNewRequestButton,
          })
        : renderRhSolicitudesAdminView(vm);
    }
    if (restoreEmpSearch) {
      const scope = active instanceof Element ? scopeFromInteractiveElement(active) : "main";
      const el = container.querySelector<HTMLInputElement>(
        `[data-rh-sol-empleado-busqueda][data-rh-sol-scope="${scope}"]`,
      );
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
      <div id="rh-solicitudes-inner" class="flex min-h-0 flex-1 flex-col">${
        isSplitGestorRole ?
          renderSplitSolicitudesView(
            loadingViewModel(personalSectionUi),
            loadingViewModel(equipoSectionUi),
            {
              showExportButton: pageUi.showExportButton,
              showNewRequestButton: pageUi.showNewRequestButton,
            },
          )
        : renderRhSolicitudesAdminView(loadingViewModel(pageUi))
      }</div>
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
        const verScope = scopeFromInteractiveElement(ver);
        const raw = ver.getAttribute("data-rh-sol-ver");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isFinite(id)) return;
        const fila = rowsForScope(verScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
        if (!fila) return;
        abrirSolicitudSegunEstado(fila, id);
        return;
      }

      const editar = t.closest<HTMLElement>("[data-rh-sol-editar]");
      if (editar && !editar.hasAttribute("disabled")) {
        const edScope = scopeFromInteractiveElement(editar);
        const raw = editar.getAttribute("data-rh-sol-editar");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isFinite(id)) return;
        const fila = rowsForScope(edScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
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
        const clearScope = scopeFromInteractiveElement(t.closest("[data-rh-sol-clear-filters]"));
        const selectedState = stateForScope(clearScope);
        selectedState.tipo = "";
        selectedState.area_id = "";
        selectedState.supervisor_id = "";
        selectedState.empleado_id = "";
        selectedState.empleado_busqueda = "";
        selectedState.estado = "";
        selectedState.page = 1;
        paint();
        return;
      }
      const pendingRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-pending]");
      if (pendingRow) {
        const raw = pendingRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const pendingScope = scopeFromInteractiveElement(pendingRow);
          const fila = rowsForScope(pendingScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const changesRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-changes]");
      if (changesRow) {
        const raw = changesRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const changesScope = scopeFromInteractiveElement(changesRow);
          const fila = rowsForScope(changesScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const resueltaRow = t.closest<HTMLTableRowElement>("tr[data-rh-sol-row-resuelta]");
      if (resueltaRow) {
        const raw = resueltaRow.getAttribute("data-rh-sol-id");
        const id = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(id)) {
          const resueltaScope = scopeFromInteractiveElement(resueltaRow);
          const fila = rowsForScope(resueltaScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
          if (fila) abrirSolicitudSegunEstado(fila, id);
        }
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-sol-page]");
      if (pageBtn) {
        const pageScope = scopeFromInteractiveElement(pageBtn);
        const selectedState = stateForScope(pageScope);
        const raw = pageBtn.getAttribute("data-rh-sol-page");
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n)) {
          selectedState.page = n;
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
      const rowScope = scopeFromInteractiveElement(tr);
      const fila = rowsForScope(rowScope).find((r) => r.id === id) ?? allRows.find((r) => r.id === id);
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
      const inputScope = scopeFromInteractiveElement(inp);
      const selectedState = stateForScope(inputScope);
      selectedState.empleado_busqueda = inp.value;
      selectedState.page = 1;
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
        const selectScope = scopeFromInteractiveElement(sel);
        const selectedState = stateForScope(selectScope);
        const name = sel.getAttribute("data-rh-sol-filter");
        const value = sel.value;
        selectedState.page = 1;
        if (name === "tipo") selectedState.tipo = value === "" ? "" : isTipo(value) ? value : "";
        else if (name === "area") selectedState.area_id = value;
        else if (name === "supervisor") selectedState.supervisor_id = value;
        else if (name === "empleado") selectedState.empleado_id = value;
        else if (name === "estado") selectedState.estado = value === "" ? "" : isEstado(value) ? value : "";
        paint();
        return;
      }
      const ps = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-sol-page-size]");
      if (ps) {
        const pageSizeScope = scopeFromInteractiveElement(ps);
        const selectedState = stateForScope(pageSizeScope);
        const n = Number.parseInt(ps.value, 10);
        selectedState.page_size = Number.isNaN(n) ? 10 : n;
        selectedState.page = 1;
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
      const inner = container.querySelector("#rh-solicitudes-inner");
      if (inner) {
        if (isSplitGestorRole) {
          inner.innerHTML = renderSplitSolicitudesView(
            errorViewModel(fetchError?.detail || "Error inesperado al cargar solicitudes.", personalSectionUi),
            errorViewModel(fetchError?.detail || "Error inesperado al cargar solicitudes.", equipoSectionUi),
            {
              showExportButton: pageUi.showExportButton,
              showNewRequestButton: pageUi.showNewRequestButton,
            },
          );
        } else {
          inner.innerHTML = renderRhSolicitudesAdminView(
            errorViewModel(fetchError?.detail || "Error inesperado al cargar solicitudes.", pageUi),
          );
        }
      }
    }
  })();
}
