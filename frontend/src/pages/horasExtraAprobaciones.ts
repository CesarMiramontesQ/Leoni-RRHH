/**
 * Listado de solicitudes pendientes de aprobación (Ver solicitud abre modal estilo RH).
 */

import {
  aprobarHorasExtra,
  getHorasExtraAprobacionDetalle,
  getHorasExtraPendientes,
  rechazarHorasExtra,
  type HorasExtraAprobacionError,
  type HorasExtraPendiente,
} from "../api/horasExtraAprobacion.ts";
import {
  renderHorasExtraAprobacionDetalleModalSlot,
  renderHorasExtraAprobacionRechazoModal,
  type HorasExtraAprobacionDetalleModalState,
} from "../horasExtra/shared/renderHorasExtraAprobacionDetalleModal.ts";
import { renderHorasExtraAprobacionesTable } from "../horasExtra/shared/renderHorasExtraAprobacionesTable.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
} from "../ui/uiTokens.ts";

const SHELL_OPTS = {
  pageTitle: "Aprobación de Horas Extra",
  activeNav: "horas-extra-aprobaciones" as const,
  mainClass: "py-0",
};

const EMPTY_DETALLE_MODAL: HorasExtraAprobacionDetalleModalState = {
  status: "idle",
  detalle: null,
};

type RechazoState = {
  solicitudId: number;
  comentario: string;
  submitting: boolean;
  error?: string;
};

type PageState = {
  status: "loading" | "ready" | "error";
  items: HorasExtraPendiente[];
  total: number;
  error?: string;
  detalleModal: HorasExtraAprobacionDetalleModalState;
  rechazo: RechazoState | null;
  toast?: { tone: "ok" | "error"; message: string };
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPageHeader(total: number): string {
  return `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Aprobación de Horas Extra</h1>
        <p class="mt-1 text-sm text-text-secondary">Revisa cada solicitud en detalle antes de aprobar o rechazar. Total: ${total}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="${RH_LISTADO_BTN_GHOST}" data-he-aprob-refrescar>Actualizar</button>
      </div>
    </header>`;
}

function renderContent(state: PageState): string {
  return renderHorasExtraAprobacionesTable({
    status: state.status,
    items: state.items,
    error: state.error,
  });
}

function renderToast(state: PageState): string {
  if (!state.toast) return "";
  const tone = state.toast.tone === "ok" ? "bg-emerald-600" : "bg-red-600";
  return `<div class="fixed bottom-4 right-4 z-[70] rounded-lg ${tone} px-4 py-2 text-sm font-medium text-white shadow-lg">${esc(state.toast.message)}</div>`;
}

function renderPage(state: PageState): string {
  return `
    <div id="he-aprob-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderPageHeader(state.total)}
        <div id="he-aprob-content">${renderContent(state)}</div>
      </div>
      ${renderHorasExtraAprobacionDetalleModalSlot(state.detalleModal)}
      <div id="he-aprob-rechazo-modal">${state.rechazo ? renderHorasExtraAprobacionRechazoModal(state.rechazo) : ""}</div>
      <div id="he-aprob-toast">${renderToast(state)}</div>
    </div>`;
}

export function mountHorasExtraAprobaciones(container: HTMLElement): void {
  const state: PageState = {
    status: "loading",
    items: [],
    total: 0,
    detalleModal: { ...EMPTY_DETALLE_MODAL },
    rechazo: null,
  };

  mountAppShell(container, { ...SHELL_OPTS, mainHtml: renderPage(state) });

  const root = (): HTMLElement | null => container.querySelector("#he-aprob-page");

  const errorDetail = (err: unknown, fallback: string): string =>
    err && typeof err === "object" && "detail" in err
      ? String((err as HorasExtraAprobacionError).detail)
      : fallback;

  const rerenderContent = () => {
    const r = root();
    if (!r) return;
    const content = r.querySelector("#he-aprob-content");
    if (content) content.innerHTML = renderContent(state);
    const subtitle = r.querySelector("header p");
    if (subtitle) {
      subtitle.textContent = `Revisa cada solicitud en detalle antes de aprobar o rechazar. Total: ${state.total}`;
    }
  };

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
    state.detalleModal = { ...EMPTY_DETALLE_MODAL };
    renderDetalleModal();
  };

  const showToast = (tone: "ok" | "error", message: string) => {
    state.toast = { tone, message };
    renderToastSlot();
    window.setTimeout(() => {
      state.toast = undefined;
      renderToastSlot();
    }, 3200);
  };

  const load = async () => {
    state.status = "loading";
    rerenderContent();
    try {
      const data = await getHorasExtraPendientes({ page_size: 50 });
      state.items = data.items;
      state.total = data.total;
      state.status = "ready";
    } catch (err) {
      state.status = "error";
      state.error = errorDetail(err, "No se pudieron cargar las solicitudes.");
    }
    rerenderContent();
  };

  const openDetalle = async (solicitudId: number) => {
    state.detalleModal = { status: "loading", detalle: null };
    renderDetalleModal();
    try {
      const detalle = await getHorasExtraAprobacionDetalle(solicitudId);
      state.detalleModal = { status: "idle", detalle, acting: false };
    } catch (err) {
      state.detalleModal = {
        status: "error",
        detalle: null,
        error: errorDetail(err, "No se pudo cargar el detalle."),
      };
    }
    renderDetalleModal();
  };

  const aprobar = async () => {
    const det = state.detalleModal.detalle;
    if (!det || state.detalleModal.acting || !det.puede_aprobar) return;
    state.detalleModal = { ...state.detalleModal, acting: true };
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
      state.detalleModal = { ...state.detalleModal, acting: false };
      renderDetalleModal();
      showToast("error", errorDetail(err, "No se pudo aprobar."));
    }
  };

  const confirmarRechazo = async () => {
    const rechazo = state.rechazo;
    if (!rechazo || rechazo.submitting) return;
    const comentario = rechazo.comentario.trim();
    if (!comentario) {
      state.rechazo = { ...rechazo, error: "El comentario es obligatorio." };
      renderRechazoModal();
      return;
    }
    state.rechazo = { ...rechazo, submitting: true, error: undefined };
    renderRechazoModal();
    try {
      await rechazarHorasExtra(rechazo.solicitudId, comentario);
      state.rechazo = null;
      renderRechazoModal();
      closeDetalleModal();
      showToast("ok", "Solicitud rechazada.");
      void load();
    } catch (err) {
      state.rechazo = {
        ...rechazo,
        submitting: false,
        error: errorDetail(err, "No se pudo rechazar."),
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
        void load();
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
        if (!det) return;
        state.rechazo = { solicitudId: det.solicitud_id, comentario: "", submitting: false };
        renderRechazoModal();
        return;
      }

      if (target.closest("[data-he-aprob-rechazo-cancelar]")) {
        state.rechazo = null;
        renderRechazoModal();
        return;
      }

      if (target.closest("[data-he-aprob-rechazo-confirmar]")) {
        void confirmarRechazo();
        return;
      }

      if (target.id === "he-aprob-rechazo-backdrop") {
        state.rechazo = null;
        renderRechazoModal();
      }
    });

    r.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.id === "he-aprob-rechazo-comentario") {
        if (state.rechazo) state.rechazo.comentario = target.value;
      }
    });
  };

  bind();
  void load();
}
