/**
 * Modal «Registrar nueva incidencia» (montado desde la página Incidencias).
 */

import { showEmpleadosToast } from "../empleados/toast.ts";
import { SNI_COPY } from "../../solicitudes/solicitudesNuevaIncidenciaCopy.ts";
import { solicitudesNuevaIncidenciaModalShellHtml } from "./solicitudesNuevaIncidenciaModalUi.ts";

export type SolicitudesNuevaIncidenciaModalOptions = {
  signal: AbortSignal;
  toastContainer: HTMLElement;
};

export type SolicitudesNuevaIncidenciaModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

export function mountSolicitudesNuevaIncidenciaModal(
  host: HTMLElement,
  options: SolicitudesNuevaIncidenciaModalOptions,
): SolicitudesNuevaIncidenciaModalHandle {
  host.innerHTML = solicitudesNuevaIncidenciaModalShellHtml();
  const overlayEl = host.querySelector("#rh-ni-overlay") as HTMLElement | null;
  const formEl = host.querySelector("#rh-ni-form") as HTMLFormElement | null;
  if (!overlayEl || !formEl) {
    return { open: () => {}, close: () => {}, destroy: () => void (host.innerHTML = "") };
  }
  const overlay = overlayEl;
  const form = formEl;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    form.reset();
    const pr = form.querySelector("#rh-ni-prioridad") as HTMLSelectElement | null;
    if (pr) pr.value = "media";
  }

  function open(): void {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function onCloseClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.closest("[data-rh-ni-close]") || t.closest("[data-rh-ni-cancel]")) {
      e.preventDefault();
      close();
    }
  }

  function onSubmit(e: Event): void {
    e.preventDefault();
    showEmpleadosToast(options.toastContainer, SNI_COPY.toastGuardadoMock, "success");
    close();
  }

  const fileInput = form.querySelector("#rh-ni-evidencia") as HTMLInputElement | null;
  const dropLabel = fileInput?.closest("label");
  if (dropLabel && fileInput) {
    dropLabel.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropLabel.classList.add("border-leoni-blue/50", "bg-leoni-blue/5");
    });
    dropLabel.addEventListener("dragleave", () => {
      dropLabel.classList.remove("border-leoni-blue/50", "bg-leoni-blue/5");
    });
    dropLabel.addEventListener("drop", (e) => {
      e.preventDefault();
      dropLabel.classList.remove("border-leoni-blue/50", "bg-leoni-blue/5");
      const dt = e.dataTransfer;
      if (dt?.files?.length) {
        fileInput.files = dt.files;
      }
    });
  }

  overlay.addEventListener("click", onCloseClick);
  form.addEventListener("submit", onSubmit);

  return {
    open,
    close,
    destroy: () => {
      overlay.removeEventListener("click", onCloseClick);
      form.removeEventListener("submit", onSubmit);
      close();
      host.innerHTML = "";
    },
  };
}
