/**
 * Vista de aprobación de horas extra para gerente regional y director.
 * El backend resuelve qué firma corresponde al usuario según su designación.
 */

import {
  aprobarHorasExtra,
  getHorasExtraPendientes,
  rechazarHorasExtra,
  type HorasExtraAprobacionError,
  type HorasExtraPendiente,
} from "../api/horasExtraAprobacion.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
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
  actingId: number | null;
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
    <tr class="border-t border-slate-100">
      <td class="px-4 py-3">
        <div class="font-medium text-slate-800">${esc(item.registrado_por_nombre ?? "—")}</div>
        <div class="text-xs text-slate-500">${item.total_empleados} empleado(s) · ${esc(item.motivo ?? "Sin motivo")}</div>
      </td>
      <td class="px-4 py-3 text-slate-700">Sem. ${item.semana}<div class="text-xs text-slate-500">${esc(item.semana_inicio)}</div></td>
      <td class="px-4 py-3 text-slate-700">${esc(item.area_descripcion ?? "—")}<div class="text-xs text-slate-500">${esc(item.centrocosto_descripcion ?? "")}</div></td>
      <td class="px-4 py-3 text-right font-semibold text-slate-800">${item.total_horas}</td>
      <td class="px-4 py-3">${esc(item.mi_tipo_firma_label)}</td>
      <td class="px-4 py-3">${estadoBadge(item)}</td>
      <td class="px-4 py-3">
        <div class="flex justify-end gap-2">
          <button type="button" class="${BTN_PRIMARY}" data-he-aprobar="${item.solicitud_id}">Aprobar</button>
          <button type="button" class="${BTN_DANGER}" data-he-rechazar="${item.solicitud_id}">Rechazar</button>
        </div>
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
            <th class="px-4 py-3">Registrado por</th>
            <th class="px-4 py-3">Semana</th>
            <th class="px-4 py-3">Área / Centro costo</th>
            <th class="px-4 py-3 text-right">Horas</th>
            <th class="px-4 py-3">Mi firma</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>${state.items.map(renderRow).join("")}</tbody>
      </table>
    </div>`;
}

function renderRechazoModal(state: PageState): string {
  if (!state.rechazo) return "";
  const r = state.rechazo;
  return `
    <div id="he-aprob-rechazo-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 class="text-base font-semibold text-slate-800">Rechazar solicitud</h3>
        <p class="mt-1 text-sm text-slate-500">El comentario es obligatorio y se enviará a RH.</p>
        <textarea id="he-aprob-rechazo-comentario" rows="4"
          class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue"
          placeholder="Motivo del rechazo…">${esc(r.comentario)}</textarea>
        ${r.error ? `<div class="mt-2 text-sm text-red-600">${esc(r.error)}</div>` : ""}
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="${BTN_SECONDARY}" data-he-rechazo-cancelar>Cancelar</button>
          <button type="button" class="${BTN_DANGER}" data-he-rechazo-confirmar ${r.submitting ? "disabled" : ""}>
            ${r.submitting ? "Enviando…" : "Confirmar rechazo"}
          </button>
        </div>
      </div>
    </div>`;
}

function renderToast(state: PageState): string {
  if (!state.toast) return "";
  const tone =
    state.toast.tone === "ok"
      ? "bg-emerald-600"
      : "bg-red-600";
  return `<div class="fixed bottom-4 right-4 z-50 rounded-lg ${tone} px-4 py-2 text-sm font-medium text-white shadow-lg">${esc(state.toast.message)}</div>`;
}

function renderPage(state: PageState): string {
  return `
    <div id="he-aprob-page" class="mx-auto w-full max-w-6xl px-4">
      <header class="mb-5">
        <h1 class="text-xl font-semibold text-slate-900">Aprobación de Horas Extra</h1>
        <p class="text-sm text-slate-500">Solicitudes pendientes de tu firma. Total: ${state.total}</p>
      </header>
      <section class="${RH_LISTADO_SURFACE}">
        <div id="he-aprob-content">${renderContent(state)}</div>
      </section>
      <div class="mt-4">
        <button type="button" class="${BTN_GHOST}" data-he-aprob-refrescar>Actualizar</button>
      </div>
      <div id="he-aprob-modal-slot">${renderRechazoModal(state)}</div>
      <div id="he-aprob-toast-slot">${renderToast(state)}</div>
    </div>`;
}

export function mountHorasExtraAprobaciones(container: HTMLElement): void {
  const state: PageState = {
    status: "loading",
    items: [],
    total: 0,
    actingId: null,
    rechazo: null,
  };

  mountAppShell(container, { ...SHELL_OPTS, mainHtml: renderPage(state) });

  const root = (): HTMLElement | null => container.querySelector("#he-aprob-page");

  const rerenderContent = () => {
    const r = root();
    if (!r) return;
    const content = r.querySelector("#he-aprob-content");
    if (content) content.innerHTML = renderContent(state);
    const header = r.querySelector("header p");
    if (header) header.textContent = `Solicitudes pendientes de tu firma. Total: ${state.total}`;
  };

  const rerenderModal = () => {
    const slot = root()?.querySelector("#he-aprob-modal-slot");
    if (slot) slot.innerHTML = renderRechazoModal(state);
  };

  const showToast = (tone: "ok" | "error", message: string) => {
    state.toast = { tone, message };
    const slot = root()?.querySelector("#he-aprob-toast-slot");
    if (slot) slot.innerHTML = renderToast(state);
    window.setTimeout(() => {
      state.toast = undefined;
      const s = root()?.querySelector("#he-aprob-toast-slot");
      if (s) s.innerHTML = "";
    }, 3200);
  };

  const errorDetail = (err: unknown, fallback: string): string =>
    err && typeof err === "object" && "detail" in err
      ? String((err as HorasExtraAprobacionError).detail)
      : fallback;

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

  const aprobar = async (solicitudId: number) => {
    if (state.actingId) return;
    state.actingId = solicitudId;
    try {
      const res = await aprobarHorasExtra(solicitudId);
      const msg =
        res.estado === "aprobado"
          ? "Solicitud aprobada. Lista para nómina."
          : "Tu aprobación quedó registrada.";
      showToast("ok", msg);
      await load();
    } catch (err) {
      showToast("error", errorDetail(err, "No se pudo aprobar."));
    } finally {
      state.actingId = null;
    }
  };

  const confirmarRechazo = async () => {
    if (!state.rechazo || state.rechazo.submitting) return;
    const comentario = state.rechazo.comentario.trim();
    if (!comentario) {
      state.rechazo.error = "El comentario es obligatorio.";
      rerenderModal();
      return;
    }
    state.rechazo.submitting = true;
    rerenderModal();
    try {
      await rechazarHorasExtra(state.rechazo.solicitudId, comentario);
      state.rechazo = null;
      rerenderModal();
      showToast("ok", "Solicitud rechazada.");
      await load();
    } catch (err) {
      if (state.rechazo) {
        state.rechazo.submitting = false;
        state.rechazo.error = errorDetail(err, "No se pudo rechazar.");
      }
      rerenderModal();
    }
  };

  const bind = () => {
    const r = root();
    if (!r) return;

    r.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const aprobarBtn = target.closest<HTMLButtonElement>("[data-he-aprobar]");
      if (aprobarBtn) {
        void aprobar(Number.parseInt(aprobarBtn.dataset.heAprobar ?? "0", 10));
        return;
      }
      const rechazarBtn = target.closest<HTMLButtonElement>("[data-he-rechazar]");
      if (rechazarBtn) {
        state.rechazo = {
          solicitudId: Number.parseInt(rechazarBtn.dataset.heRechazar ?? "0", 10),
          comentario: "",
          submitting: false,
        };
        rerenderModal();
        return;
      }
      if (target.closest("[data-he-rechazo-cancelar]")) {
        state.rechazo = null;
        rerenderModal();
        return;
      }
      if (target.closest("[data-he-rechazo-confirmar]")) {
        void confirmarRechazo();
        return;
      }
      if (target.id === "he-aprob-rechazo-backdrop") {
        state.rechazo = null;
        rerenderModal();
        return;
      }
      if (target.closest("[data-he-aprob-refrescar]")) {
        void load();
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
