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
  renderSolicitudesSplitHeroMeta,
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
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";

type SolicitudesScope = "main" | "personal" | "equipo";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "Esta sección de solicitudes no está disponible para tu usuario.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
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

function isTipoPermitidoParaEmpleado(v: string): v is RhSolicitudTipoCodigo {
  return v === "vacaciones" || v === "home_office" || v === "permiso_sin_goce_sueldo";
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

function isEstadoPermitidoParaEmpleado(v: string): v is RhSolicitudEstadoCodigo {
  return v !== "overridden" && isEstado(v);
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
          class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary order-2 w-full sm:w-auto sm:shrink-0 md:order-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-slate-600" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar solicitudes
        </button>`
    : "";
  const nuevaBtn = options.showNewRequestButton
    ? `<button
          type="button"
          id="rh-sol-nueva"
          class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary order-1 w-full sm:w-auto sm:shrink-0 md:order-2"
        >
          <span aria-hidden="true">+</span> Nueva solicitud
        </button>`
    : "";

  return `
    <div id="rh-solicitudes-root" class="rh-solicitudes-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Solicitudes</h1>
            <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Gestión y aprobación de solicitudes del personal</p>
            ${renderSolicitudesSplitHeroMeta(personalVm, equipoVm)}
          </div>
          <div class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-2.5">${exportBtn}${nuevaBtn}</div>
        </div>
      </section>
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
  const solicitudesMainClass = "py-0";
  const solicitudesPageShellClass =
    "rh-dashboard-page relative flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

  if (!canAccessSolicitudesPage()) {
    mountAppShell(container, {
      pageTitle: "Solicitudes",
      activeNav: "solicitudes",
      mainClass: solicitudesMainClass,
      mainHtml: `<div id="rh-solicitudes-page" class="${solicitudesPageShellClass}">${forbiddenHtml()}</div>`,
    });
    return;
  }

  const pageRole = getSolicitudesPageRoleFromSession();
  if (!pageRole) {
    mountAppShell(container, {
      pageTitle: "Solicitudes",
      activeNav: "solicitudes",
      mainClass: solicitudesMainClass,
      mainHtml: `<div id="rh-solicitudes-page" class="${solicitudesPageShellClass}">${forbiddenHtml()}</div>`,
    });
    return;
  }

  const pageUi = buildDefaultSolicitudesPageUiConfig(pageRole);
  const isSplitGestorRole = pageRole === "supervisor" || pageRole === "gerente";
  const sessionEmpleadoDirId = getEmpleadoDirectoryNumericIdFromAccessToken();
  const initialFilters = getInitialFiltersFromHash();
  if (pageRole === "empleado" && initialFilters.tipo && !isTipoPermitidoParaEmpleado(initialFilters.tipo)) {
    initialFilters.tipo = "";
  }
  if (pageRole === "empleado" && initialFilters.estado && !isEstadoPermitidoParaEmpleado(initialFilters.estado)) {
    initialFilters.estado = "";
  }
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
    mainHtml: `<div id="rh-solicitudes-page" class="${solicitudesPageShellClass}">
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
      allowPaidLeaveTypes: pageRole === "rh",
      allowUnpaidLeaveType: pageRole === "supervisor" || pageRole === "gerente" || pageRole === "rh",
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
    "error",
    (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLImageElement)) return;
      if (!el.hasAttribute("data-rh-sol-avatar")) return;
      el.classList.add("hidden");
      const fb = el.nextElementSibling;
      if (fb instanceof HTMLElement && fb.classList.contains("rh-sol-avatar-fallback--swap")) {
        fb.removeAttribute("hidden");
      }
    },
    { capture: true, signal },
  );

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
        if (name === "tipo") {
          const tipoValido = value === "" ? "" : isTipo(value) ? value : "";
          selectedState.tipo =
            pageRole === "empleado" && tipoValido !== "" && !isTipoPermitidoParaEmpleado(tipoValido) ?
              ""
            : tipoValido;
        }
        else if (name === "area") selectedState.area_id = value;
        else if (name === "supervisor") selectedState.supervisor_id = value;
        else if (name === "empleado") selectedState.empleado_id = value;
        else if (name === "estado") {
          const estadoValido = value === "" ? "" : isEstado(value) ? value : "";
          selectedState.estado =
            pageRole === "empleado" && estadoValido !== "" && !isEstadoPermitidoParaEmpleado(estadoValido) ?
              ""
            : estadoValido;
        }
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
