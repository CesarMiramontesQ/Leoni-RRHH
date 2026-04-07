/**
 * Modal de detalle y decisión para solicitudes pendientes (rol RH / aprobador).
 * Presentación en `solicitudDetalleModalUi.ts`; decisión mock en `solicitudDetalleDecisionMock.ts`.
 */

import { ejecutarDecisionSolicitudMock } from "../../solicitudes/rh/solicitudDetalleDecisionMock.ts";
import { SD_COPY } from "../../solicitudes/rh/solicitudDetalleCopy.ts";
import { mapTablaFilaToSolicitudDetallePendiente } from "../../solicitudes/rh/mapTablaFilaToSolicitudDetalle.ts";
import type { SolicitudDetalleAccion } from "../../solicitudes/rh/solicitudDetalleTypes.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  solicitudDetalleContentHtml,
  solicitudDetalleLoadingBodyHtml,
  solicitudDetalleShellHtml,
} from "./solicitudDetalleModalUi.ts";

export type SolicitudDetalleModalOptions = {
  signal: AbortSignal;
  toastContainer: HTMLElement;
  getFilaById: (id: number) => RhSolicitudTablaFila | undefined;
  aplicarFilaActualizada: (fila: RhSolicitudTablaFila) => void;
  onRefrescarListado: () => void;
};

export type SolicitudDetalleModalHandle = {
  open: (solicitudId: number) => void;
  close: () => void;
  destroy: () => void;
};

function isAccion(v: string): v is SolicitudDetalleAccion {
  return v === "aprobar" || v === "cambios" || v === "rechazar";
}

export function mountSolicitudDetalleModal(
  host: HTMLElement,
  options: SolicitudDetalleModalOptions,
): SolicitudDetalleModalHandle {
  host.innerHTML = solicitudDetalleShellHtml();
  const overlay = host.querySelector("#rh-sd-overlay") as HTMLElement | null;
  const body = host.querySelector("#rh-sd-body") as HTMLElement | null;
  if (!overlay || !body) {
    return { open: () => {}, close: () => {}, destroy: () => void (host.innerHTML = "") };
  }

  const rootOverlay = overlay;
  const modalBody = body;

  let busy = false;

  function close(): void {
    if (busy) return;
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function showFormError(msg: string): void {
    const el = host.querySelector("#rh-sd-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideFormError(): void {
    const el = host.querySelector("#rh-sd-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function setActionBusy(on: boolean): void {
    busy = on;
    const banner = host.querySelector("#rh-sd-busy-banner") as HTMLElement | null;
    if (banner) {
      banner.textContent = on ? SD_COPY.procesando : "";
      banner.classList.toggle("hidden", !on);
    }
    const ids = ["rh-sd-btn-aprobar", "rh-sd-btn-cambios", "rh-sd-btn-rechazar"];
    for (const id of ids) {
      const b = host.querySelector(`#${id}`) as HTMLButtonElement | null;
      if (b) b.disabled = on;
    }
    const toggle = host.querySelector("#rh-sd-toggle-internal") as HTMLButtonElement | null;
    if (toggle) toggle.disabled = on;
    const ta = host.querySelector("#rh-sd-internal-ta") as HTMLTextAreaElement | null;
    if (ta) ta.disabled = on;
  }

  function expandInternalPanel(expand: boolean): void {
    const panel = host.querySelector("#rh-sd-internal-panel") as HTMLElement | null;
    const btn = host.querySelector("#rh-sd-toggle-internal") as HTMLButtonElement | null;
    if (!panel || !btn) return;
    panel.classList.toggle("hidden", !expand);
    btn.setAttribute("aria-expanded", expand ? "true" : "false");
  }

  async function runDecision(accion: SolicitudDetalleAccion): Promise<void> {
    hideFormError();
    const idRaw = (host.querySelector("#rh-sd-solicitud-id") as HTMLInputElement | null)?.value ?? "";
    const solicitudId = Number.parseInt(idRaw, 10);
    if (Number.isNaN(solicitudId)) {
      showFormError(SD_COPY.errorNoEncontrada);
      return;
    }

    const fila = options.getFilaById(solicitudId);
    if (!fila) {
      showFormError(SD_COPY.errorNoEncontrada);
      return;
    }

    const ta = host.querySelector("#rh-sd-internal-ta") as HTMLTextAreaElement | null;
    const comentarioRaw = ta?.value?.trim() ?? "";
    const comentario_interno = comentarioRaw === "" ? null : comentarioRaw;

    if (accion !== "aprobar" && !comentario_interno) {
      showFormError(SD_COPY.validacionComentarioRequerido);
      expandInternalPanel(true);
      ta?.focus();
      return;
    }

    setActionBusy(true);
    const res = await ejecutarDecisionSolicitudMock(
      { solicitudId, accion, comentario_interno },
      fila,
    );
    setActionBusy(false);

    if (!res.ok) {
      showEmpleadosToast(options.toastContainer, res.message, "error");
      return;
    }

    options.aplicarFilaActualizada(res.fila);
    const msg =
      accion === "aprobar"
        ? SD_COPY.exitoAprobar
        : accion === "cambios"
          ? SD_COPY.exitoCambios
          : SD_COPY.exitoRechazar;
    showEmpleadosToast(options.toastContainer, msg, "success");
    close();
    options.onRefrescarListado();
  }

  function bindDetailInteractions(): void {
    const toggle = host.querySelector("#rh-sd-toggle-internal");
    toggle?.addEventListener(
      "click",
      () => {
        const panel = host.querySelector("#rh-sd-internal-panel") as HTMLElement | null;
        const hidden = panel?.classList.contains("hidden") ?? true;
        expandInternalPanel(hidden);
      },
      { signal: options.signal },
    );

    host.querySelectorAll("[data-rh-sd-accion]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const raw = btn.getAttribute("data-rh-sd-accion") ?? "";
          if (!isAccion(raw)) return;
          void runDecision(raw);
        },
        { signal: options.signal },
      );
    });
  }

  rootOverlay.addEventListener(
    "click",
    (e) => {
      if (e.target === rootOverlay) close();
    },
    { signal: options.signal },
  );

  host.addEventListener(
    "click",
    (e) => {
      if ((e.target as HTMLElement).closest("[data-rh-sd-close]")) close();
    },
    { signal: options.signal },
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rootOverlay.classList.contains("hidden")) {
        if (busy) return;
        e.preventDefault();
        close();
      }
    },
    { signal: options.signal },
  );

  return {
    open: (solicitudId: number) => {
      if (busy) return;
      hideFormError();
      const fila = options.getFilaById(solicitudId);
      if (!fila) {
        showEmpleadosToast(options.toastContainer, SD_COPY.errorNoEncontrada, "error");
        return;
      }
      if (fila.estado !== "pending") {
        showEmpleadosToast(options.toastContainer, SD_COPY.errorNoPendiente, "error");
        return;
      }
      const vm = mapTablaFilaToSolicitudDetallePendiente(fila);
      if (!vm) {
        showEmpleadosToast(options.toastContainer, SD_COPY.errorNoPendiente, "error");
        return;
      }

      rootOverlay.classList.remove("hidden");
      rootOverlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      modalBody.innerHTML = solicitudDetalleLoadingBodyHtml();

      window.requestAnimationFrame(() => {
        modalBody.innerHTML = solicitudDetalleContentHtml(vm);
        bindDetailInteractions();
      });
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
