/**
 * Modal «Registrar nueva incidencia» (montado desde la página Incidencias).
 */

import { getEmpleadosPage } from "../../api/empleados.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { SNI_COPY } from "../../solicitudes/solicitudesNuevaIncidenciaCopy.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { buildEmpleadoOptions } from "./rhNewRequestModalUi.ts";
import { solicitudesNuevaIncidenciaModalShellHtml } from "./solicitudesNuevaIncidenciaModalUi.ts";

export type SolicitudesNuevaIncidenciaModalOptions = {
  signal: AbortSignal;
  toastContainer: HTMLElement;
  /** Si la API de empleados responde 401 (token inválido). */
  onSessionExpired?: () => void;
};

export type SolicitudesNuevaIncidenciaModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

const SEARCH_DEBOUNCE_MS = 320;

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

  let empleadosCache: UsuarioListItem[] = [];
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSearchQ = "";

  function empleadoSelect(): HTMLSelectElement | null {
    return form.querySelector("[data-rh-ni-empleado-select]");
  }

  function empleadoSearchInput(): HTMLInputElement | null {
    return form.querySelector("[data-rh-ni-empleado-search]");
  }

  function empleadoStatusEl(): HTMLElement | null {
    return form.querySelector("#rh-ni-empleado-status");
  }

  function setEmpleadoStatus(kind: "hidden" | "loading" | "empty" | "error", detail?: string): void {
    const el = empleadoStatusEl();
    if (!el) return;
    if (kind === "hidden") {
      el.textContent = "";
      el.classList.add("hidden");
      el.classList.remove("text-red-600");
      return;
    }
    el.classList.remove("hidden");
    if (kind === "error") {
      el.classList.add("text-red-600");
      el.textContent = detail ?? SNI_COPY.empleadoErrorCarga;
      return;
    }
    el.classList.remove("text-red-600");
    if (kind === "loading") el.textContent = SNI_COPY.empleadoBuscando;
    else if (kind === "empty") el.textContent = detail ?? SNI_COPY.empleadoSinResultados;
  }

  function applyEmpleadoSelect(selectedId: string): void {
    const sel = empleadoSelect();
    if (!sel) return;
    sel.innerHTML = buildEmpleadoOptions(empleadosCache, selectedId, { soloNombre: true });
    syncCamposDesdeEmpleadoSeleccionado();
  }

  function syncCamposDesdeEmpleadoSeleccionado(): void {
    const sel = empleadoSelect();
    const raw = sel?.value ?? "";
    const id = Number.parseInt(raw, 10);
    const noEmp = form.querySelector("#rh-ni-no-empleado") as HTMLInputElement | null;
    const areaIn = form.querySelector("#rh-ni-area") as HTMLInputElement | null;
    const supIn = form.querySelector("#rh-ni-supervisor") as HTMLInputElement | null;
    if (!Number.isFinite(id)) {
      if (noEmp) noEmp.value = "";
      if (areaIn) areaIn.value = "";
      if (supIn) supIn.value = "";
      return;
    }
    const u = empleadosCache.find((x) => x.id === id);
    if (!u) {
      if (noEmp) noEmp.value = "";
      if (areaIn) areaIn.value = "";
      if (supIn) supIn.value = "";
      return;
    }
    if (noEmp) noEmp.value = formatNoEmpleadoDisplay(u.no_empleado);
    if (areaIn) areaIn.value = (u.area?.descripcion ?? "").trim();
    if (supIn) {
      const ln = (u.lider_nombre ?? "").trim();
      supIn.value = ln ? formatNombreEmpleadoUi(ln) || ln : "";
    }
  }

  async function loadEmpleados(q: string): Promise<void> {
    const pg = await getEmpleadosPage({
      page: 1,
      page_size: 100,
      q: q.trim(),
      activo: true,
    });
    empleadosCache = pg.items;
  }

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = undefined;
    lastSearchQ = "";
    form.reset();
    const pr = form.querySelector("#rh-ni-prioridad") as HTMLSelectElement | null;
    if (pr) pr.value = "media";
    empleadosCache = [];
    applyEmpleadoSelect(""); // vacía select y campos derivados
    const qIn = empleadoSearchInput();
    if (qIn) qIn.value = "";
    setEmpleadoStatus("hidden");
  }

  function open(): void {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    lastSearchQ = "";
    const qIn = empleadoSearchInput();
    if (qIn) qIn.value = "";
    setEmpleadoStatus("loading");
    void (async () => {
      try {
        await loadEmpleados("");
        applyEmpleadoSelect("");
        if (empleadosCache.length === 0) {
          setEmpleadoStatus("empty", SNI_COPY.empleadoSinResultados);
        } else {
          setEmpleadoStatus("hidden");
        }
      } catch (e: unknown) {
        if (isUsuariosFetchError(e) && e.status === 401) {
          options.onSessionExpired?.();
          close();
          return;
        }
        empleadosCache = [];
        applyEmpleadoSelect("");
        setEmpleadoStatus("error");
      }
    })();
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
    const sel = empleadoSelect();
    const raw = sel?.value ?? "";
    const empleadoId = Number.parseInt(raw, 10);
    if (!Number.isFinite(empleadoId)) {
      showEmpleadosToast(options.toastContainer, SNI_COPY.empleadoRequerido, "error");
      return;
    }
    if (!empleadosCache.some((u) => u.id === empleadoId)) {
      showEmpleadosToast(options.toastContainer, SNI_COPY.empleadoRequerido, "error");
      return;
    }
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

  empleadoSelect()?.addEventListener(
    "change",
    () => {
      syncCamposDesdeEmpleadoSeleccionado();
    },
    { signal: options.signal },
  );

  const qInput = empleadoSearchInput();
  qInput?.addEventListener(
    "input",
    () => {
      const q = qInput.value;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        if (q === lastSearchQ) return;
        lastSearchQ = q;
        const prev = empleadoSelect()?.value ?? "";
        setEmpleadoStatus("loading");
        try {
          await loadEmpleados(q);
          const still = prev !== "" && empleadosCache.some((u) => String(u.id) === prev);
          applyEmpleadoSelect(still ? prev : "");
          if (empleadosCache.length === 0) {
            setEmpleadoStatus("empty", SNI_COPY.empleadoSinResultados);
          } else {
            setEmpleadoStatus("hidden");
          }
        } catch (e: unknown) {
          if (isUsuariosFetchError(e) && e.status === 401) {
            options.onSessionExpired?.();
            close();
            return;
          }
          empleadosCache = [];
          applyEmpleadoSelect("");
          setEmpleadoStatus("error");
        }
      }, SEARCH_DEBOUNCE_MS);
    },
    { signal: options.signal },
  );

  overlay.addEventListener("click", onCloseClick);
  form.addEventListener("submit", onSubmit);

  return {
    open,
    close,
    destroy: () => {
      overlay.removeEventListener("click", onCloseClick);
      form.removeEventListener("submit", onSubmit);
      if (searchTimer) clearTimeout(searchTimer);
      close();
      host.innerHTML = "";
    },
  };
}
