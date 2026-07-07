import { fetchAllEmpleadosForExport } from "../api/empleados.ts";
import {
  aprobarViajeLaboral,
  cancelarViajeLaboral,
  createViajeLaboral,
  deleteViajeLaboral,
  enviarViajeLaboral,
  getViajeLaboral,
  getViajesLaboralesEstadisticas,
  getViajesLaboralesEstados,
  getViajesLaboralesPage,
  rechazarViajeLaboral,
  updateViajeLaboral,
  type ViajeLaboralEstadoOption,
  type ViajesLaboralesPageResponse,
} from "../api/viajesLaborales.ts";
import {
  canAccessViajesLaboralesPage,
  canApproveViajesLaborales,
} from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { renderRhViajesLaboralesAdminView } from "../components/viajesLaborales/rhViajesLaboralesAdminView.ts";
import {
  mountViajeLaboralDetalleModal,
  type ViajeLaboralDetalleModalHandle,
} from "../components/viajesLaborales/viajeLaboralDetalleModal.ts";
import {
  mountViajeLaboralModal,
  type ViajeLaboralEmpleadoOption,
  type ViajeLaboralModalHandle,
} from "../components/viajesLaborales/viajeLaboralModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import { VL_COPY } from "../viajesLaborales/rh/viajesLaboralesCopy.ts";
import {
  cloneViajesLaboralesListFilters,
  emptyViajesLaboralesListFilters,
  fechasRangoViajesListo,
  readViajesLaboralesFiltersFromDom,
  RH_VL_FILTER_FIELDS,
} from "../viajesLaborales/rh/viajesLaboralesFilterHelpers.ts";
import type {
  ViajesLaboralesAdminViewModel,
  ViajesLaboralesEstadisticasData,
  ViajesLaboralesListFilters,
} from "../viajesLaborales/rh/types.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

const PAGE_SIZE = 10;
const PAGE_SHELL_CLASS =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: VL_COPY.accesoDenegadoTitulo,
    description: VL_COPY.accesoDenegadoTexto,
  });
}

type EstadisticasHold =
  | { kind: "ready"; data: ViajesLaboralesEstadisticasData }
  | { kind: "error"; message: string };

function estadisticasFields(hold?: EstadisticasHold): Pick<
  ViajesLaboralesAdminViewModel,
  "estadisticas" | "estadisticasStatus" | "estadisticasErrorMessage"
> {
  if (!hold) {
    return { estadisticas: null, estadisticasStatus: "loading", estadisticasErrorMessage: undefined };
  }
  if (hold.kind === "error") {
    return {
      estadisticas: null,
      estadisticasStatus: "error",
      estadisticasErrorMessage: hold.message,
    };
  }
  return { estadisticas: hold.data, estadisticasStatus: "ready", estadisticasErrorMessage: undefined };
}

function loadingViewModel(
  filterDraft: ViajesLaboralesListFilters,
  appliedFilters: ViajesLaboralesListFilters,
  kpisHold?: EstadisticasHold,
): ViajesLaboralesAdminViewModel {
  return {
    filterDraft: cloneViajesLaboralesListFilters(filterDraft),
    appliedFilters: cloneViajesLaboralesListFilters(appliedFilters),
    ...estadisticasFields(kpisHold),
    tableStatus: "loading",
    table: null,
    canApprove: canApproveViajesLaborales(),
  };
}

function viewModelFromPage(
  pageData: ViajesLaboralesPageResponse,
  filterDraft: ViajesLaboralesListFilters,
  appliedFilters: ViajesLaboralesListFilters,
  estadisticas: ViajesLaboralesEstadisticasData | null,
  estadisticasStatus: ViajesLaboralesAdminViewModel["estadisticasStatus"],
  estadisticasErrorMessage?: string,
): ViajesLaboralesAdminViewModel {
  return {
    filterDraft: cloneViajesLaboralesListFilters(filterDraft),
    appliedFilters: cloneViajesLaboralesListFilters(appliedFilters),
    estadisticas,
    estadisticasStatus,
    estadisticasErrorMessage,
    tableStatus: pageData.total === 0 ? "empty" : "ready",
    table: {
      items: pageData.items,
      total: pageData.total,
      page: pageData.page,
      page_size: pageData.page_size,
    },
    canApprove: canApproveViajesLaborales(),
  };
}

function errorViewModel(
  message: string,
  filterDraft: ViajesLaboralesListFilters,
  appliedFilters: ViajesLaboralesListFilters,
  kpisHold?: EstadisticasHold,
): ViajesLaboralesAdminViewModel {
  return {
    filterDraft: cloneViajesLaboralesListFilters(filterDraft),
    appliedFilters: cloneViajesLaboralesListFilters(appliedFilters),
    ...estadisticasFields(kpisHold),
    tableStatus: "error",
    table: null,
    tableErrorMessage: message,
    canApprove: canApproveViajesLaborales(),
  };
}

export function mountViajesLaborales(container: HTMLElement, signal: AbortSignal): void {
  const mainClass = "pt-0 pb-5 sm:pb-6";

  if (!canAccessViajesLaboralesPage()) {
    mountAppShell(container, {
      pageTitle: VL_COPY.tituloPagina,
      activeNav: "viajes-laborales",
      mainClass,
      mainHtml: `<div id="rh-viajes-laborales-page" class="${PAGE_SHELL_CLASS}">${renderLaboralesBackBar()}${forbiddenHtml()}</div>`,
    });
    return;
  }

  let filterDraft = emptyViajesLaboralesListFilters();
  let appliedFilters = cloneViajesLaboralesListFilters(filterDraft);
  let page = 1;
  let loadSeq = 0;
  let empleadoOptions: ViajeLaboralEmpleadoOption[] = [];
  let estadoOptions: ViajeLaboralEstadoOption[] = [];
  let lastEstadisticas: ViajesLaboralesEstadisticasData | null = null;
  let lastEstadisticasStatus: ViajesLaboralesAdminViewModel["estadisticasStatus"] = "loading";
  let lastEstadisticasError: string | undefined;

  function queryFromAppliedFilters() {
    return {
      busqueda: appliedFilters.busqueda || undefined,
      destino: appliedFilters.destino || undefined,
      estado: appliedFilters.estado || undefined,
      fecha_inicio: appliedFilters.fecha_inicio || undefined,
      fecha_fin: appliedFilters.fecha_fin || undefined,
    };
  }

  function paintVm(vm: ViajesLaboralesAdminViewModel): void {
    const inner = container.querySelector("#rh-vl-inner");
    if (inner) inner.innerHTML = renderRhViajesLaboralesAdminView(vm, estadoOptions);
  }

  mountAppShell(container, {
    pageTitle: VL_COPY.tituloPagina,
    activeNav: "viajes-laborales",
    mainClass,
    mainHtml: `<div id="rh-viajes-laborales-page" class="${PAGE_SHELL_CLASS}">
      ${renderLaboralesBackBar()}
      <div id="rh-vl-inner" class="flex min-h-0 flex-1 flex-col">${renderRhViajesLaboralesAdminView(loadingViewModel(filterDraft, appliedFilters), estadoOptions)}</div>
      <div id="rh-vl-modal-host" class="shrink-0"></div>
      <div id="rh-vl-detalle-host" class="shrink-0"></div>
    </div>`,
  });

  const modalHost = container.querySelector("#rh-vl-modal-host");
  const detalleHost = container.querySelector("#rh-vl-detalle-host");

  let formModal: ViajeLaboralModalHandle | null = null;
  let detalleModal: ViajeLaboralDetalleModalHandle | null = null;

  function mountModals(): void {
    if (!(modalHost instanceof HTMLElement) || !(detalleHost instanceof HTMLElement)) return;
    formModal?.destroy();
    detalleModal?.destroy();
    formModal = mountViajeLaboralModal(modalHost, {
      empleados: empleadoOptions,
      toastContainer: container,
      onSubmit: async (payload, viajeId) => {
        if (viajeId != null) await updateViajeLaboral(viajeId, payload);
        else await createViajeLaboral(payload);
        page = 1;
        await load(true);
      },
    });
    detalleModal = mountViajeLaboralDetalleModal(detalleHost, {
      canApprove: canApproveViajesLaborales(),
      onAprobar: async (id) => {
        await aprobarViajeLaboral(id);
        showEmpleadosToast(container, "Viaje aprobado.", "success");
        await load(true);
      },
      onRechazar: async (id, motivo) => {
        await rechazarViajeLaboral(id, motivo);
        showEmpleadosToast(container, "Viaje rechazado.", "success");
        await load(true);
      },
      onCancelar: async (id) => {
        await cancelarViajeLaboral(id);
        showEmpleadosToast(container, "Viaje cancelado.", "success");
        await load(true);
      },
    });
  }

  async function refreshEmpleadoOptions(): Promise<void> {
    try {
      const items = await fetchAllEmpleadosForExport({ activo: true });
      empleadoOptions = items.map((e) => ({
        empleado_id: e.empleado_id,
        nombre: formatNombreEmpleadoUi(e.nombre),
        no_empleado: formatNoEmpleadoDisplay(e.no_empleado),
      }));
      mountModals();
    } catch {
      showEmpleadosToast(container, "No se pudo cargar la lista de empleados.", "error");
    }
  }

  async function load(refreshEstadisticas = true): Promise<void> {
    const seq = ++loadSeq;
    const isStale = (): boolean => seq !== loadSeq;

    let kpisHold: EstadisticasHold | undefined;
    if (!refreshEstadisticas) {
      if (lastEstadisticasStatus === "ready" && lastEstadisticas !== null) {
        kpisHold = { kind: "ready", data: lastEstadisticas };
      } else if (lastEstadisticasStatus === "error") {
        kpisHold = { kind: "error", message: lastEstadisticasError || VL_COPY.errorEstadisticas };
      }
    }

    paintVm(loadingViewModel(filterDraft, appliedFilters, kpisHold));
    try {
      const filters = queryFromAppliedFilters();
      const pageData = await getViajesLaboralesPage({
        page,
        page_size: PAGE_SIZE,
        ...filters,
      });
      if (isStale()) return;

      if (refreshEstadisticas) {
        try {
          lastEstadisticas = await getViajesLaboralesEstadisticas(filters);
          lastEstadisticasStatus = "ready";
          lastEstadisticasError = undefined;
        } catch (error: unknown) {
          const fetchError = error as { detail?: string };
          lastEstadisticas = null;
          lastEstadisticasStatus = "error";
          lastEstadisticasError = fetchError?.detail || VL_COPY.errorEstadisticas;
        }
      }

      if (isStale()) return;
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
          fetchError?.detail || "Error inesperado al cargar los viajes.",
          filterDraft,
          appliedFilters,
          kpisHold,
        ),
      );
    }
  }

  async function handleRowAction(action: string, id: number): Promise<void> {
    try {
      if (action === "editar") {
        const viaje = await getViajeLaboral(id);
        formModal?.openEdit(viaje);
        return;
      }
      if (action === "ver") {
        const viaje = await getViajeLaboral(id);
        detalleModal?.open(viaje);
        return;
      }
      if (action === "enviar") {
        await enviarViajeLaboral(id);
        showEmpleadosToast(container, "Viaje enviado a aprobación.", "success");
        await load(true);
        return;
      }
      if (action === "aprobar") {
        await aprobarViajeLaboral(id);
        showEmpleadosToast(container, "Viaje aprobado.", "success");
        await load(true);
        return;
      }
      if (action === "rechazar") {
        const motivo = window.prompt(VL_COPY.motivoRechazoPlaceholder);
        if (!motivo?.trim()) return;
        await rechazarViajeLaboral(id, motivo.trim());
        showEmpleadosToast(container, "Viaje rechazado.", "success");
        await load(true);
        return;
      }
      if (action === "cancelar") {
        if (!window.confirm(VL_COPY.confirmCancelar)) return;
        await cancelarViajeLaboral(id);
        showEmpleadosToast(container, "Viaje cancelado.", "success");
        await load(true);
        return;
      }
      if (action === "eliminar") {
        if (!window.confirm(VL_COPY.confirmEliminar)) return;
        await deleteViajeLaboral(id);
        showEmpleadosToast(container, "Viaje eliminado.", "success");
        await load(true);
      }
    } catch (error: unknown) {
      const fetchError = error as { detail?: string };
      showEmpleadosToast(container, fetchError?.detail || "No se pudo completar la acción.", "error");
    }
  }

  const pageRoot = container.querySelector("#rh-viajes-laborales-page");
  pageRoot?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#rh-vl-nuevo") || t.closest("#rh-vl-nueva-empty")) {
        formModal?.openCreate();
        return;
      }
      if (t.closest("[data-rh-vl-clear-filters]")) {
        filterDraft = emptyViajesLaboralesListFilters();
        appliedFilters = emptyViajesLaboralesListFilters();
        page = 1;
        void load();
        return;
      }
      if (t.closest("[data-rh-vl-apply-filters]")) {
        if (!pageRoot) return;
        filterDraft = readViajesLaboralesFiltersFromDom(pageRoot, filterDraft);
        appliedFilters = cloneViajesLaboralesListFilters(filterDraft);
        page = 1;
        void load();
        return;
      }
      const actionBtn = t.closest<HTMLButtonElement>("[data-rh-vl-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-rh-vl-action");
        const idRaw = actionBtn.getAttribute("data-rh-vl-id");
        const id = idRaw ? Number.parseInt(idRaw, 10) : NaN;
        if (action && !Number.isNaN(id)) void handleRowAction(action, id);
        return;
      }
      const pageBtn = t.closest<HTMLButtonElement>("[data-rh-vl-page]");
      if (pageBtn) {
        const raw = pageBtn.getAttribute("data-rh-vl-page");
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n) && n >= 1) {
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
      const el = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>(
        "[data-rh-vl-filter-field]",
      );
      if (!el) return;
      const name = el.getAttribute("data-rh-vl-filter-field") ?? "";
      if (!RH_VL_FILTER_FIELDS.includes(name as (typeof RH_VL_FILTER_FIELDS)[number])) return;
      filterDraft = { ...filterDraft, [name]: el.value } as ViajesLaboralesListFilters;
      if ((name === "fecha_inicio" || name === "fecha_fin") && fechasRangoViajesListo(filterDraft)) {
        appliedFilters = cloneViajesLaboralesListFilters(filterDraft);
        page = 1;
        void load();
      }
    },
    { signal },
  );

  pageRoot?.addEventListener(
    "input",
    (e) => {
      const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-rh-vl-filter-field]");
      if (!inp) return;
      const name = inp.getAttribute("data-rh-vl-filter-field") ?? "";
      if (!RH_VL_FILTER_FIELDS.includes(name as (typeof RH_VL_FILTER_FIELDS)[number])) return;
      filterDraft = { ...filterDraft, [name]: inp.value } as ViajesLaboralesListFilters;
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    formModal?.destroy();
    detalleModal?.destroy();
  });

  void (async () => {
    try {
      estadoOptions = await getViajesLaboralesEstados();
    } catch {
      estadoOptions = [];
    }
    await refreshEmpleadoOptions();
    await load(true);
  })();
}
