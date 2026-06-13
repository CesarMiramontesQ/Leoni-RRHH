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
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_GHOST,
  BTN_SECONDARY,
  RH_LISTADO_SURFACE,
  badgeApproved,
  badgePending,
  badgeRejected,
} from "../ui/uiTokens.ts";

const SHELL_OPTS = {
  pageTitle: "Aprobación de Horas Extra",
  activeNav: "horas-extra-aprobaciones" as const,
  mainClass: "py-6",
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

function fmtFecha(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtFechaHora(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function estadoBadge(item: HorasExtraPendiente): string {
  if (item.estado_consolidado === "aprobado_parcial") {
    return badgePending("Aprobación parcial");
  }
  if (item.estado_consolidado === "aprobado") return badgeApproved();
  if (item.estado_consolidado === "rechazado") return badgeRejected();
  return badgePending("Pendiente");
}

function renderRow(item: HorasExtraPendiente): string {
  return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60">
      <td class="px-4 py-3 font-medium text-slate-800">#${item.solicitud_id}</td>
      <td class="px-4 py-3 text-slate-700">${esc(item.empleado_resumen ?? "—")}</td>
      <td class="px-4 py-3 text-slate-700">${esc(item.puesto_descripcion ?? "—")}</td>
      <td class="px-4 py-3 text-slate-700">${esc(item.area_descripcion ?? "—")}</td>
      <td class="px-4 py-3 text-slate-700">${esc(item.subarea_descripcion ?? "—")}</td>
      <td class="px-4 py-3 text-slate-700">${fmtFecha(item.fecha_solicitud)}</td>
      <td class="px-4 py-3 text-right font-semibold text-slate-800">${item.total_horas}</td>
      <td class="px-4 py-3">${estadoBadge(item)}</td>
      <td class="px-4 py-3 text-slate-600">${fmtFechaHora(item.created_at)}</td>
      <td class="px-4 py-3 text-right">
        <button type="button" class="${BTN_SECONDARY}" data-he-aprob-ver-id="${item.solicitud_id}">
          Ver solicitud
        </button>
      </td>
    </tr>`;
}

function renderContent(state: PageState): string {
  if (state.status === "loading") {
    return `<div class="px-4 py-12 text-center text-slate-500">Cargando solicitudes…</div>`;
  }
  if (state.status === "error") {
    return `<div class="px-4 py-12 text-center text-red-600">${esc(state.error ?? "Error al cargar.")}</div>`;
  }
  if (state.items.length === 0) {
    return `<div class="px-4 py-12 text-center text-slate-500">No tienes solicitudes de horas extra pendientes de aprobación.</div>`;
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th class="px-4 py-3">Folio</th>
            <th class="px-4 py-3">Empleado</th>
            <th class="px-4 py-3">Puesto</th>
            <th class="px-4 py-3">Área</th>
            <th class="px-4 py-3">Sucursal</th>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3 text-right">Horas extras</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Creación</th>
            <th class="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>${state.items.map(renderRow).join("")}</tbody>
      </table>
    </div>`;
}

function renderToast(state: PageState): string {
  if (!state.toast) return "";
  const tone = state.toast.tone === "ok" ? "bg-emerald-600" : "bg-red-600";
  return `<div class="fixed bottom-4 right-4 z-[70] rounded-lg ${tone} px-4 py-2 text-sm font-medium text-white shadow-lg">${esc(state.toast.message)}</div>`;
}

function renderPage(state: PageState): string {
  return `
    <div id="he-aprob-page" class="mx-auto w-full max-w-7xl px-4">
      <header class="mb-5">
        <h1 class="text-xl font-semibold text-slate-900">Aprobación de Horas Extra</h1>
        <p class="text-sm text-slate-500">Revisa cada solicitud en detalle antes de aprobar o rechazar. Total: ${state.total}</p>
      </header>
      <section class="${RH_LISTADO_SURFACE}">
        <div id="he-aprob-content">${renderContent(state)}</div>
      </section>
      <div class="mt-4">
        <button type="button" class="${BTN_GHOST}" data-he-aprob-refrescar>Actualizar</button>
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
    const header = r.querySelector("header p");
    if (header) {
      header.textContent = `Revisa cada solicitud en detalle antes de aprobar o rechazar. Total: ${state.total}`;
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
