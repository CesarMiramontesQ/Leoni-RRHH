/**
 * Modal de consulta para solicitudes resueltas (aprobadas / rechazadas).
 * Datos: `fetchSolicitudResueltaDetalleMock` + `mapTablaFilaToSolicitudResuelta`.
 */

import { fetchSolicitudResueltaDetalleMock } from "../../solicitudes/rh/fetchSolicitudResueltaDetalleMock.ts";
import { SR_COPY } from "../../solicitudes/rh/solicitudResueltaCopy.ts";
import type { SolicitudResueltaDetalleVm } from "../../solicitudes/rh/solicitudResueltaTypes.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  solicitudResueltaContentHtml,
  solicitudResueltaEmptyBodyHtml,
  solicitudResueltaErrorBodyHtml,
  solicitudResueltaLoadingBodyHtml,
  solicitudResueltaShellHtml,
} from "./solicitudResueltaModalUi.ts";

/** Equivalente a props de un componente React (callbacks opcionales). */
export type SolicitudResueltaModalOpciones = {
  signal: AbortSignal;
  toastContainer: HTMLElement;
  getFilaById: (id: number) => RhSolicitudTablaFila | undefined;
  onFirmarDocumento?: (requestId: string) => void | Promise<void>;
  onCancelarProceso?: (requestId: string) => void | Promise<void>;
  onDescargarComprobante?: (requestId: string) => void | Promise<void>;
};

export type SolicitudResueltaModalHandle = {
  open: (solicitudId: number) => Promise<void>;
  close: () => void;
  destroy: () => void;
};

function mapFetchError(code: string): string {
  if (code === "not_found") return SR_COPY.errorNoEncontrada;
  if (code === "not_resolved") return SR_COPY.errorNoResuelta;
  return SR_COPY.errorCarga;
}

export function mountSolicitudResueltaModal(
  host: HTMLElement,
  options: SolicitudResueltaModalOpciones,
): SolicitudResueltaModalHandle {
  host.innerHTML = solicitudResueltaShellHtml();
  const overlay = host.querySelector("#rh-sr-overlay") as HTMLElement | null;
  const body = host.querySelector("#rh-sr-body") as HTMLElement | null;
  if (!overlay || !body) {
    return {
      open: async () => {},
      close: () => {},
      destroy: () => void (host.innerHTML = ""),
    };
  }

  const rootOverlay = overlay;
  const modalBody = body;
  let loading = false;

  function close(): void {
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
    loading = false;
  }

  function bindContentInteractions(vm: SolicitudResueltaDetalleVm): void {
    const toggle = host.querySelector("#rh-sr-toggle-comentario");
    const largo = host.querySelector("#rh-sr-rechazo-largo") as HTMLElement | null;
    toggle?.addEventListener(
      "click",
      () => {
        if (!largo) return;
        largo.classList.toggle("hidden");
        const visible = !largo.classList.contains("hidden");
        if (toggle instanceof HTMLButtonElement) {
          toggle.textContent = visible ? SR_COPY.btnOcultarComentario : SR_COPY.btnVerComentario;
        }
      },
      { signal: options.signal },
    );

    const getId = (): string =>
      (host.querySelector("#rh-sr-solicitud-id") as HTMLInputElement | null)?.value ?? vm.id;

    host.querySelector("[data-rh-sr-firmar]")?.addEventListener(
      "click",
      () => {
        void (async () => {
          const id = getId();
          if (options.onFirmarDocumento) await options.onFirmarDocumento(id);
          else showEmpleadosToast(options.toastContainer, SR_COPY.toastFirmarMock, "success");
        })();
      },
      { signal: options.signal },
    );

    host.querySelector("[data-rh-sr-cancelar]")?.addEventListener(
      "click",
      () => {
        void (async () => {
          const id = getId();
          if (options.onCancelarProceso) await options.onCancelarProceso(id);
          else showEmpleadosToast(options.toastContainer, SR_COPY.toastCancelarMock, "success");
        })();
      },
      { signal: options.signal },
    );

    host.querySelectorAll("[data-rh-sr-descargar]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          void (async () => {
            const id = getId();
            if (options.onDescargarComprobante) await options.onDescargarComprobante(id);
            else showEmpleadosToast(options.toastContainer, SR_COPY.toastDescargaMock, "success");
          })();
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
      if ((e.target as HTMLElement).closest("[data-rh-sr-close]")) close();
    },
    { signal: options.signal },
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rootOverlay.classList.contains("hidden")) {
        e.preventDefault();
        close();
      }
    },
    { signal: options.signal },
  );

  return {
    open: async (solicitudId: number) => {
      if (loading) return;
      rootOverlay.classList.remove("hidden");
      rootOverlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      modalBody.innerHTML = solicitudResueltaLoadingBodyHtml();
      loading = true;

      const res = await fetchSolicitudResueltaDetalleMock(solicitudId, options.getFilaById, false);
      loading = false;

      if (!res.ok) {
        modalBody.innerHTML = solicitudResueltaErrorBodyHtml(mapFetchError(res.message));
        return;
      }

      if (!res.data) {
        modalBody.innerHTML = solicitudResueltaEmptyBodyHtml();
        return;
      }

      modalBody.innerHTML = solicitudResueltaContentHtml(res.data);
      bindContentInteractions(res.data);
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
