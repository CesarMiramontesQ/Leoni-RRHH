/**
 * Modal minimal para RH: alta de comedor (comedores activos).
 */
import { comedorErrorMessage, crearComedor } from "../../api/comedor.ts";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_INPUT,
  FORM_LABEL,
  MODAL_OVERLAY,
  MODAL_PANEL,
} from "../../ui/uiTokens.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";

export type ComedorCrearComedorModalOptions = {
  toastContainer: HTMLElement;
  onCreated: () => void | Promise<void>;
};

export type ComedorCrearComedorModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

function shellHtml(): string {
  return `
    <div
      id="comedor-crear-comedor-overlay"
      class="${MODAL_OVERLAY} z-[90] hidden"
      role="presentation"
    >
      <div
        id="comedor-crear-comedor-panel"
        class="${MODAL_PANEL} scheme-light flex max-h-[min(90vh,640px)] max-w-md flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-crear-comedor-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="comedor-crear-comedor-titulo" class="text-lg font-bold text-text-primary">Nuevo comedor</h2>
            <p class="mt-1 text-xs text-text-muted">Quedará disponible para reservas y planificación.</p>
          </div>
          <button
            type="button"
            data-comedor-crear-comedor-cerrar
            class="-m-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-active-tint hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
          </button>
        </header>
        <form id="comedor-crear-comedor-form" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <label for="comedor-crear-nombre" class="${FORM_LABEL}">Nombre</label>
            <input
              id="comedor-crear-nombre"
              name="nombre"
              type="text"
              required
              maxlength="150"
              autocomplete="off"
              class="${FIELD_INPUT}"
              placeholder="Ej. Comedor planta norte"
            />
          </div>
          <div>
            <label for="comedor-crear-ubicacion" class="${FORM_LABEL}">Ubicación (opcional)</label>
            <input
              id="comedor-crear-ubicacion"
              name="ubicacion"
              type="text"
              maxlength="255"
              autocomplete="off"
              class="${FIELD_INPUT}"
              placeholder="Edificio, módulo…"
            />
          </div>
          <div>
            <label for="comedor-crear-capacidad" class="${FORM_LABEL}">Capacidad diaria (opcional)</label>
            <input
              id="comedor-crear-capacidad"
              name="capacidad"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="${FIELD_INPUT}"
              placeholder="Ej. 120"
            />
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input id="comedor-crear-activo" name="activo" type="checkbox" checked class="size-4 rounded border-slate-300 text-accent focus:ring-2 focus:ring-accent/40" />
            <span>Comedor activo</span>
          </label>
          <footer class="mt-auto flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-comedor-crear-comedor-cancelar class="${BTN_GHOST}">Cancelar</button>
            <button type="submit" id="comedor-crear-comedor-submit" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-70">Guardar</button>
          </footer>
        </form>
      </div>
    </div>`;
}

export function mountComedorCrearComedorModal(
  host: HTMLElement,
  options: ComedorCrearComedorModalOptions,
): ComedorCrearComedorModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector<HTMLElement>("#comedor-crear-comedor-overlay");
  const form = host.querySelector<HTMLFormElement>("#comedor-crear-comedor-form");
  const btnSubmit = host.querySelector<HTMLButtonElement>("#comedor-crear-comedor-submit");
  if (!overlay || !form || !btnSubmit) {
    return {
      open: () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }
  const overlayEl = overlay;
  const formEl = form;
  const btnSubmitEl = btnSubmit;

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    formEl.reset();
    const activo = host.querySelector<HTMLInputElement>("#comedor-crear-activo");
    if (activo) activo.checked = true;
    btnSubmitEl.disabled = false;
    btnSubmitEl.textContent = "Guardar";
  }

  function open(): void {
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
    host.querySelector<HTMLInputElement>("#comedor-crear-nombre")?.focus();
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = host.querySelector<HTMLInputElement>("#comedor-crear-nombre")?.value.trim() ?? "";
    if (!nombre) {
      showEmpleadosToast(options.toastContainer, "Indica el nombre del comedor.", "error");
      return;
    }
    const ubicacionRaw = host.querySelector<HTMLInputElement>("#comedor-crear-ubicacion")?.value.trim() ?? "";
    const capVal = host.querySelector<HTMLInputElement>("#comedor-crear-capacidad")?.value.trim() ?? "";
    const capacidad =
      capVal === "" ? null : (() => {
        const n = Number.parseInt(capVal, 10);
        return Number.isFinite(n) ? n : null;
      })();
    const activo = host.querySelector<HTMLInputElement>("#comedor-crear-activo")?.checked ?? true;
    btnSubmitEl.disabled = true;
    btnSubmitEl.textContent = "Guardando…";
    try {
      await crearComedor({
        nombre,
        ubicacion: ubicacionRaw || null,
        capacidad,
        activo,
      });
      showEmpleadosToast(options.toastContainer, "Comedor creado correctamente.", "success");
      close();
      await options.onCreated();
    } catch (err: unknown) {
      showEmpleadosToast(options.toastContainer, comedorErrorMessage(err, "No se pudo crear el comedor."), "error");
    } finally {
      btnSubmitEl.disabled = false;
      btnSubmitEl.textContent = "Guardar";
    }
  });

  const onCloseClick = (ev: Event) => {
    const t = ev.target as HTMLElement;
    if (
      t.closest("[data-comedor-crear-comedor-cerrar]") ||
      t.closest("[data-comedor-crear-comedor-cancelar]") ||
      ev.target === overlayEl
    ) {
      close();
    }
  };
  overlayEl.addEventListener("click", onCloseClick);

  return {
    open,
    close,
    destroy: () => {
      overlayEl.removeEventListener("click", onCloseClick);
      close();
      host.innerHTML = "";
    },
  };
}
