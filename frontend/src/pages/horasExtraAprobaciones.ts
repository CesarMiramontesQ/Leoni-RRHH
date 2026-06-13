/**
 * Listado de solicitudes pendientes de aprobación (Ver solicitud abre modal estilo RH).
 */

import {
  aprobarHorasExtra,
  getHorasExtraAprobacionDetalle,
  getHorasExtraAprobacionesEstadisticas,
  getHorasExtraAprobacionesSolicitudes,
  rechazarHorasExtra,
  type HorasExtraAprobacionError,
} from "../api/horasExtraAprobacion.ts";
import {
  renderHorasExtraAprobacionesPage,
  type HorasExtraAprobacionesPageState,
} from "../horasExtra/shared/renderHorasExtraAprobacionesPage.ts";
import {
  renderHorasExtraAprobacionDetalleModalSlot,
  renderHorasExtraAprobacionRechazoModal,
  type HorasExtraAprobacionDetalleModalState,
} from "../horasExtra/shared/renderHorasExtraAprobacionDetalleModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";

const SHELL_OPTS = {
  pageTitle: "Aprobación de Horas Extra",
  activeNav: "horas-extra-aprobaciones" as const,
  mainClass: "py-0",
};

const PAGE_SIZE = 10;

const EMPTY_DETALLE_MODAL: HorasExtraAprobacionDetalleModalState = {
  status: "idle",
  detalle: null,
};

function initialState(): HorasExtraAprobacionesPageState {
  return {
    listaStatus: "loading",
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    estadisticasStatus: "loading",
    estadisticas: null,
    detalleModal: { ...EMPTY_DETALLE_MODAL },
    rechazo: null,
  };
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderToast(state: HorasExtraAprobacionesPageState): string {
  if (!state.toast) return "";
  const tone = state.toast.tone === "ok" ? "bg-emerald-600" : "bg-red-600";
  return `<div class="fixed bottom-4 right-4 z-[70] rounded-lg ${tone} px-4 py-2 text-sm font-medium text-white shadow-lg">${esc(state.toast.message)}</div>`;
}

export function mountHorasExtraAprobaciones(container: HTMLElement): void {
  let state = initialState();

  const render = () => {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: renderHorasExtraAprobacionesPage(state),
    });
    bind();
  };

  const root = (): HTMLElement | null => container.querySelector("#he-aprob-page");

  const errorDetail = (err: unknown, fallback: string): string =>
    err && typeof err === "object" && "detail" in err
      ? String((err as HorasExtraAprobacionError).detail)
      : fallback;

  const renderDetalleModal = () => {
    const r = root();
    if (!r) return;
    const slot = r.querySelector("#he-aprob-detalle-modal");
    if (slot) slot.outerHTML = renderHorasExtraAprobacionDetalleModalSlot(state.detalleModal);
  };

  const renderRechazoModal = () => {
    const r = root();
    if (!r) return;
    const slot = r.querySelector("#he-aprob-rechazo-modal");
    if (slot) {
      slot.innerHTML = state.rechazo ? renderHorasExtraAprobacionRechazoModal(state.rechazo) : "";
    }
  };

  const renderToastSlot = () => {
    const r = root();
    if (!r) return;
    const slot = r.querySelector("#he-aprob-toast");
    if (slot) slot.innerHTML = renderToast(state);
  };

  const closeDetalleModal = () => {
    state = { ...state, detalleModal: { ...EMPTY_DETALLE_MODAL } };
    renderDetalleModal();
  };

  const showToast = (tone: "ok" | "error", message: string) => {
    state = { ...state, toast: { tone, message } };
    renderToastSlot();
    window.setTimeout(() => {
      state = { ...state, toast: undefined };
      renderToastSlot();
    }, 3200);
  };

  const load = async (page = state.page) => {
    state = { ...state, listaStatus: "loading", estadisticasStatus: "loading", page };
    render();
    try {
      const [estadisticas, data] = await Promise.all([
        getHorasExtraAprobacionesEstadisticas(),
        getHorasExtraAprobacionesSolicitudes({
          page,
          page_size: state.pageSize,
        }),
      ]);
      state = {
        ...state,
        estadisticas,
        estadisticasStatus: "ready",
        estadisticasError: undefined,
        items: data.items,
        total: data.total,
        page: data.page,
        pageSize: data.page_size,
        listaStatus: "ready",
        listaError: undefined,
      };
    } catch (err) {
      const message = errorDetail(err, "No se pudieron cargar las solicitudes.");
      state = {
        ...state,
        estadisticasStatus: "error",
        estadisticasError: message,
        listaStatus: "error",
        listaError: message,
      };
    }
    render();
  };

  const openDetalle = async (solicitudId: number) => {
    state = { ...state, detalleModal: { status: "loading", detalle: null } };
    renderDetalleModal();
    try {
      const detalle = await getHorasExtraAprobacionDetalle(solicitudId);
      state = { ...state, detalleModal: { status: "idle", detalle, acting: false } };
    } catch (err) {
      state = {
        ...state,
        detalleModal: {
          status: "error",
          detalle: null,
          error: errorDetail(err, "No se pudo cargar el detalle."),
        },
      };
    }
    renderDetalleModal();
  };

  const aprobar = async () => {
    const det = state.detalleModal.detalle;
    if (!det || state.detalleModal.acting || !det.puede_aprobar) return;
    state = { ...state, detalleModal: { ...state.detalleModal, acting: true } };
    renderDetalleModal();
    try {
      const res = await aprobarHorasExtra(det.solicitud_id);
      const msg =
        res.estado === "aprobado"
          ? "Solicitud aprobada. Lista para nómina."
          : "Tu aprobación quedó registrada.";
      closeDetalleModal();
      showToast("ok", msg);
      void load();
    } catch (err) {
      state = { ...state, detalleModal: { ...state.detalleModal, acting: false } };
      renderDetalleModal();
      showToast("error", errorDetail(err, "No se pudo aprobar."));
    }
  };

  const confirmarRechazo = async () => {
    const rechazo = state.rechazo;
    if (!rechazo || rechazo.submitting) return;
    const comentario = rechazo.comentario.trim();
    if (!comentario) {
      state = { ...state, rechazo: { ...rechazo, error: "El comentario es obligatorio." } };
      renderRechazoModal();
      return;
    }
    state = { ...state, rechazo: { ...rechazo, submitting: true, error: undefined } };
    renderRechazoModal();
    try {
      await rechazarHorasExtra(rechazo.solicitudId, comentario);
      state = { ...state, rechazo: null };
      renderRechazoModal();
      closeDetalleModal();
      showToast("ok", "Solicitud rechazada.");
      void load();
    } catch (err) {
      state = {
        ...state,
        rechazo: { ...rechazo, submitting: false, error: errorDetail(err, "No se pudo rechazar.") },
      };
      renderRechazoModal();
    }
  };

  const bind = () => {
    const r = root();
    if (!r) return;

    r.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const verBtn = target.closest<HTMLButtonElement>("[data-he-aprob-ver-id]");
      if (verBtn) {
        const id = Number.parseInt(verBtn.dataset.heAprobVerId ?? "0", 10);
        if (id) void openDetalle(id);
        return;
      }

      if (target.closest("[data-he-aprob-refrescar]")) {
        void load(state.page);
        return;
      }

      const pageBtn = target.closest<HTMLButtonElement>("[data-he-aprob-page]");
      if (pageBtn && !pageBtn.disabled) {
        const nextPage = Number.parseInt(pageBtn.dataset.heAprobPage ?? "0", 10);
        if (nextPage >= 1) void load(nextPage);
        return;
      }

      if (target.closest("[data-he-aprob-detalle-cerrar]")) {
        closeDetalleModal();
        return;
      }

      const detalleBackdrop = r.querySelector("#he-aprob-detalle-backdrop");
      if (detalleBackdrop && target === detalleBackdrop) {
        closeDetalleModal();
        return;
      }

      if (target.closest("[data-he-aprob-aprobar]")) {
        void aprobar();
        return;
      }

      if (target.closest("[data-he-aprob-rechazar]")) {
        const det = state.detalleModal.detalle;
        if (!det || !det.puede_rechazar) return;
        state = {
          ...state,
          rechazo: { solicitudId: det.solicitud_id, comentario: "", submitting: false },
        };
        renderRechazoModal();
        return;
      }

      if (target.closest("[data-he-aprob-rechazo-cancelar]")) {
        state = { ...state, rechazo: null };
        renderRechazoModal();
        return;
      }

      if (target.closest("[data-he-aprob-rechazo-confirmar]")) {
        void confirmarRechazo();
        return;
      }

      if (target.id === "he-aprob-rechazo-backdrop") {
        state = { ...state, rechazo: null };
        renderRechazoModal();
      }
    });

    r.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.id === "he-aprob-rechazo-comentario") {
        if (state.rechazo) {
          state = { ...state, rechazo: { ...state.rechazo, comentario: target.value } };
        }
      }
    });
  };

  render();
  void load();
}
