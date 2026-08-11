import {
  comedorErrorMessage,
  editarComedor,
  type ComedorApiItem,
} from "../../api/comedor.ts";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_INPUT,
  FORM_LABEL,
  MODAL_OVERLAY,
  MODAL_PANEL,
} from "../../ui/uiTokens.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";

export type ComedorEditarComedorModalOptions = {
  toastContainer: HTMLElement;
  onUpdated: () => void | Promise<void>;
};

export type ComedorEditarComedorModalHandle = {
  open: (item: ComedorApiItem) => void;
  close: () => void;
  destroy: () => void;
};

function shellHtml(): string {
  return `
    <div
      id="comedor-editar-comedor-overlay"
      class="${MODAL_OVERLAY} z-[90] hidden"
      role="presentation"
    >
      <div
        class="${MODAL_PANEL} scheme-light flex max-h-[min(90vh,640px)] max-w-md flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-editar-comedor-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="comedor-editar-comedor-titulo" class="text-lg font-bold text-text-primary">Editar comedor</h2>
            <p class="mt-1 text-xs text-text-muted">Actualiza los datos operativos del comedor.</p>
          </div>
          <button
            type="button"
            data-comedor-editar-comedor-cerrar
            class="-m-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-active-tint hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
          </button>
        </header>
        <form id="comedor-editar-comedor-form" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <label for="comedor-editar-nombre" class="${FORM_LABEL}">Nombre</label>
            <input
              id="comedor-editar-nombre"
              name="nombre"
              type="text"
              required
              maxlength="150"
              autocomplete="off"
              class="${FIELD_INPUT}"
            />
          </div>
          <div>
            <label for="comedor-editar-ubicacion" class="${FORM_LABEL}">Ubicación (opcional)</label>
            <input
              id="comedor-editar-ubicacion"
              name="ubicacion"
              type="text"
              maxlength="255"
              autocomplete="off"
              class="${FIELD_INPUT}"
            />
          </div>
          <div>
            <label for="comedor-editar-capacidad" class="${FORM_LABEL}">Capacidad diaria (opcional)</label>
            <input
              id="comedor-editar-capacidad"
              name="capacidad"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="${FIELD_INPUT}"
            />
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input id="comedor-editar-activo" name="activo" type="checkbox" class="size-4 rounded border-slate-300 text-accent focus:ring-2 focus:ring-accent/40" />
            <span>Comedor activo</span>
          </label>
          <footer class="mt-auto flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-comedor-editar-comedor-cancelar class="${BTN_GHOST}">Cancelar</button>
            <button type="submit" id="comedor-editar-comedor-submit" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-70">Guardar cambios</button>
          </footer>
        </form>
      </div>
    </div>`;
}

export function mountComedorEditarComedorModal(
  host: HTMLElement,
  options: ComedorEditarComedorModalOptions,
): ComedorEditarComedorModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector<HTMLElement>("#comedor-editar-comedor-overlay");
  const form = host.querySelector<HTMLFormElement>("#comedor-editar-comedor-form");
  const btnSubmit = host.querySelector<HTMLButtonElement>("#comedor-editar-comedor-submit");
  if (!overlay || !form || !btnSubmit) {
    return {
      open: () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }
  let currentComedorId: number | null = null;
  const overlayEl = overlay;
  const formEl = form;
  const btnSubmitEl = btnSubmit;

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    currentComedorId = null;
    btnSubmitEl.disabled = false;
    btnSubmitEl.textContent = "Guardar cambios";
  }

  function open(item: ComedorApiItem): void {
    currentComedorId = item.id;
    const nombreInput = host.querySelector<HTMLInputElement>("#comedor-editar-nombre");
    const ubicacionInput = host.querySelector<HTMLInputElement>("#comedor-editar-ubicacion");
    const capacidadInput = host.querySelector<HTMLInputElement>("#comedor-editar-capacidad");
    const activoInput = host.querySelector<HTMLInputElement>("#comedor-editar-activo");
    if (nombreInput) nombreInput.value = item.nombre;
    if (ubicacionInput) ubicacionInput.value = item.ubicacion ?? "";
    if (capacidadInput) capacidadInput.value = item.capacidad != null ? String(item.capacidad) : "";
    if (activoInput) activoInput.checked = item.activo;
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
    nombreInput?.focus();
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentComedorId == null) return;
    const nombre = host.querySelector<HTMLInputElement>("#comedor-editar-nombre")?.value.trim() ?? "";
    if (!nombre) {
      showEmpleadosToast(options.toastContainer, "Indica el nombre del comedor.", "error");
      return;
    }
    const ubicacionRaw = host.querySelector<HTMLInputElement>("#comedor-editar-ubicacion")?.value.trim() ?? "";
    const capacidadRaw = host.querySelector<HTMLInputElement>("#comedor-editar-capacidad")?.value.trim() ?? "";
    const capacidad =
      capacidadRaw === "" ? null : (() => {
        const n = Number.parseInt(capacidadRaw, 10);
        return Number.isFinite(n) ? n : null;
      })();
    const activo = host.querySelector<HTMLInputElement>("#comedor-editar-activo")?.checked ?? true;
    btnSubmitEl.disabled = true;
    btnSubmitEl.textContent = "Guardando…";
    try {
      await editarComedor(currentComedorId, {
        nombre,
        ubicacion: ubicacionRaw || null,
        capacidad,
        activo,
      });
      showEmpleadosToast(options.toastContainer, "Comedor actualizado correctamente.", "success");
      close();
      await options.onUpdated();
    } catch (err: unknown) {
      showEmpleadosToast(options.toastContainer, comedorErrorMessage(err, "No se pudo actualizar el comedor."), "error");
      btnSubmitEl.disabled = false;
      btnSubmitEl.textContent = "Guardar cambios";
    }
  });

  const onCloseClick = (ev: Event) => {
    const target = ev.target as HTMLElement;
    if (
      target.closest("[data-comedor-editar-comedor-cerrar]") ||
      target.closest("[data-comedor-editar-comedor-cancelar]") ||
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
