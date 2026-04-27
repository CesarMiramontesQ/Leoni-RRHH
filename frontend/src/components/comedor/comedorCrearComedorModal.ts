/**
 * Modal minimal para RH: alta de comedor (comedores activos).
 */
import { comedorErrorMessage, crearComedor } from "../../api/comedor.ts";
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
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="comedor-crear-comedor-panel"
        class="scheme-light flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-crear-comedor-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="comedor-crear-comedor-titulo" class="text-lg font-bold text-slate-900">Nuevo comedor</h2>
            <p class="mt-1 text-xs text-slate-500">Quedará disponible para reservas y planificación.</p>
          </div>
          <button
            type="button"
            data-comedor-crear-comedor-cerrar
            class="-m-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
          </button>
        </header>
        <form id="comedor-crear-comedor-form" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <label for="comedor-crear-nombre" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</label>
            <input
              id="comedor-crear-nombre"
              name="nombre"
              type="text"
              required
              maxlength="150"
              autocomplete="off"
              class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
              placeholder="Ej. Comedor planta norte"
            />
          </div>
          <div>
            <label for="comedor-crear-ubicacion" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación (opcional)</label>
            <input
              id="comedor-crear-ubicacion"
              name="ubicacion"
              type="text"
              maxlength="255"
              autocomplete="off"
              class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
              placeholder="Edificio, módulo…"
            />
          </div>
          <div>
            <label for="comedor-crear-capacidad" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidad diaria (opcional)</label>
            <input
              id="comedor-crear-capacidad"
              name="capacidad"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
              placeholder="Ej. 120"
            />
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input id="comedor-crear-activo" name="activo" type="checkbox" checked class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue/30" />
            <span>Comedor activo</span>
          </label>
          <footer class="mt-auto flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-comedor-crear-comedor-cancelar class="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" id="comedor-crear-comedor-submit" class="min-h-11 rounded-xl bg-leoni-blue px-5 text-sm font-semibold text-white shadow-md hover:bg-leoni-blue-light disabled:cursor-not-allowed disabled:opacity-70">Guardar</button>
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
  const overlay = host.querySelector("#comedor-crear-comedor-overlay");
  const form = host.querySelector("#comedor-crear-comedor-form");
  const btnSubmit = host.querySelector("#comedor-crear-comedor-submit");
  if (!(overlay instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(btnSubmit instanceof HTMLButtonElement)) {
    return {
      open: () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    form.reset();
    const activo = host.querySelector<HTMLInputElement>("#comedor-crear-activo");
    if (activo) activo.checked = true;
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Guardar";
  }

  function open(): void {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    host.querySelector<HTMLInputElement>("#comedor-crear-nombre")?.focus();
  }

  form.addEventListener("submit", async (e) => {
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
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Guardando…";
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
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Guardar";
    }
  });

  const onCloseClick = (ev: Event) => {
    const t = ev.target as HTMLElement;
    if (
      t.closest("[data-comedor-crear-comedor-cerrar]") ||
      t.closest("[data-comedor-crear-comedor-cancelar]") ||
      ev.target === overlay
    ) {
      close();
    }
  };
  overlay.addEventListener("click", onCloseClick);

  return {
    open,
    close,
    destroy: () => {
      overlay.removeEventListener("click", onCloseClick);
      close();
      host.innerHTML = "";
    },
  };
}
