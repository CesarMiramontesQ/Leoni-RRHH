/**
 * Edición del menú de UN día de la planeación.
 *
 * Evita tener que borrar la semana entera y reimportar el Excel para corregir un platillo.
 * Edita el día completo —Opción A, Opción B y las siete categorías de complementos— porque
 * el upsert del backend sobrescribe el `detalle` con lo que reciba: mandar solo la
 * descripción dejaría el JSONB vacío.
 */
import { comedorErrorMessage } from "../../api/comedor.ts";
import {
  MENU_DETALLE_CATEGORIAS,
  createEmptyMenuDiaDetalle,
  type ComedorMenuDetalleCategoria,
  type ComedorMenuDiaDetalle,
} from "../../comedor/rh/menuDayDetalle.ts";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

export type ComedorDayMenuEditValue = {
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
};

export type ComedorDayMenuEditModalParams = ComedorDayMenuEditValue & {
  dayKey: string;
  dayLabel: string;
  fechaCorta: string;
};

export type ComedorDayMenuEditModalOptions = {
  onSave: (params: { dayKey: string } & ComedorDayMenuEditValue) => void | Promise<void>;
};

export type ComedorDayMenuEditModalHandle = {
  open: (params: ComedorDayMenuEditModalParams) => void;
  close: () => void;
  destroy: () => void;
};

type ModalUiState = ComedorDayMenuEditModalParams & {
  isSubmitting: boolean;
  errorMessage: string | null;
};

const INPUT_CLASS =
  `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}`;

function shellHtml(): string {
  return `
    <div
      id="comedor-plan-day-overlay"
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        class="scheme-light relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-plan-day-titulo"
      >
        <header class="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 id="comedor-plan-day-titulo" class="text-lg font-bold text-slate-900">Editar menú del día</h2>
          <p id="comedor-plan-day-subtitulo" class="mt-1 text-sm text-slate-600"></p>
        </header>
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="comedor-plan-day-normal" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1d4ed8]">Opción A (normal)</label>
              <input id="comedor-plan-day-normal" type="text" class="${INPUT_CLASS}" placeholder="Platillo principal" />
            </div>
            <div>
              <label for="comedor-plan-day-dieta" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Opción B (dieta)</label>
              <input id="comedor-plan-day-dieta" type="text" class="${INPUT_CLASS}" placeholder="Platillo de dieta" />
            </div>
          </div>
          <p class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Deja un campo vacío para quitar esa opción del día. Si vacías las dos, el día se
            queda sin menú y deja de verse en la app del empleado.
          </p>
          <div id="comedor-plan-day-detalle" class="space-y-4"></div>
          <div id="comedor-plan-day-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"></div>
        </div>
        <footer class="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" data-comedor-plan-day-cancelar class="${BTN_SECONDARY} min-h-11 justify-center">Cancelar</button>
          <button type="button" data-comedor-plan-day-guardar class="${BTN_PRIMARY} min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-70">
            Guardar día
          </button>
        </footer>
      </div>
    </div>`;
}

function renderCategoria(
  categoria: { key: ComedorMenuDetalleCategoria; label: string },
  valores: string[],
): string {
  const items = valores
    .map(
      (valor, index) => `
      <li class="flex items-center gap-2">
        <input
          type="text"
          value="${escapeComedorHtml(valor)}"
          data-comedor-plan-day-item
          data-categoria="${categoria.key}"
          data-index="${index}"
          class="${INPUT_CLASS}" />
        <button
          type="button"
          data-comedor-plan-day-remove
          data-categoria="${categoria.key}"
          data-index="${index}"
          aria-label="Quitar de ${escapeComedorHtml(categoria.label)}"
          class="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
        </button>
      </li>`,
    )
    .join("");
  return `
    <section>
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeComedorHtml(categoria.label)}</h3>
        <button
          type="button"
          data-comedor-plan-day-add
          data-categoria="${categoria.key}"
          class="text-xs font-semibold text-[#1d4ed8] transition hover:underline">
          + Añadir
        </button>
      </div>
      ${
        valores.length > 0
          ? `<ul class="space-y-2">${items}</ul>`
          : `<p class="text-sm text-slate-400">Sin elementos.</p>`
      }
    </section>`;
}

export function mountComedorDayMenuEditModal(
  host: HTMLElement,
  options: ComedorDayMenuEditModalOptions,
): ComedorDayMenuEditModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector<HTMLElement>("#comedor-plan-day-overlay");
  const subtitulo = host.querySelector<HTMLElement>("#comedor-plan-day-subtitulo");
  const inputNormal = host.querySelector<HTMLInputElement>("#comedor-plan-day-normal");
  const inputDieta = host.querySelector<HTMLInputElement>("#comedor-plan-day-dieta");
  const detalleHost = host.querySelector<HTMLElement>("#comedor-plan-day-detalle");
  const errorBox = host.querySelector<HTMLElement>("#comedor-plan-day-error");
  const btnCancel = host.querySelector<HTMLButtonElement>("[data-comedor-plan-day-cancelar]");
  const btnSave = host.querySelector<HTMLButtonElement>("[data-comedor-plan-day-guardar]");

  if (
    !overlay || !subtitulo || !inputNormal || !inputDieta || !detalleHost || !errorBox
    || !btnCancel || !btnSave
  ) {
    return { open: () => {}, close: () => {}, destroy: () => { host.innerHTML = ""; } };
  }

  // Referencias locales: TypeScript no conserva el estrechamiento de null dentro de closures.
  const overlayEl = overlay;
  const subtituloEl = subtitulo;
  const inputNormalEl = inputNormal;
  const inputDietaEl = inputDieta;
  const detalleHostEl = detalleHost;
  const errorBoxEl = errorBox;
  const btnCancelEl = btnCancel;
  const btnSaveEl = btnSave;

  const ui: ModalUiState = {
    dayKey: "",
    dayLabel: "",
    fechaCorta: "",
    menuNormal: "",
    menuDieta: "",
    detalle: createEmptyMenuDiaDetalle(),
    isSubmitting: false,
    errorMessage: null,
  };

  /** Vuelca los inputs de texto al estado; se llama antes de repintar el detalle. */
  function syncFromInputs(): void {
    ui.menuNormal = inputNormalEl.value;
    ui.menuDieta = inputDietaEl.value;
    detalleHostEl.querySelectorAll<HTMLInputElement>("[data-comedor-plan-day-item]").forEach((input) => {
      const categoria = input.dataset.categoria as ComedorMenuDetalleCategoria | undefined;
      const index = Number(input.dataset.index);
      if (!categoria || !Number.isInteger(index)) return;
      const lista = ui.detalle[categoria];
      if (lista && index < lista.length) lista[index] = input.value;
    });
  }

  function paintDetalle(): void {
    detalleHostEl.innerHTML = MENU_DETALLE_CATEGORIAS.map((categoria) =>
      renderCategoria(categoria, ui.detalle[categoria.key]),
    ).join("");
  }

  function paintControls(): void {
    subtituloEl.textContent = `${ui.dayLabel}${ui.fechaCorta ? ` · ${ui.fechaCorta}` : ""}`;
    btnSaveEl.disabled = ui.isSubmitting;
    btnCancelEl.disabled = ui.isSubmitting;
    btnSaveEl.textContent = ui.isSubmitting ? "Guardando..." : "Guardar día";
    if (ui.errorMessage) {
      errorBoxEl.textContent = ui.errorMessage;
      errorBoxEl.classList.remove("hidden");
    } else {
      errorBoxEl.textContent = "";
      errorBoxEl.classList.add("hidden");
    }
  }

  function close(): void {
    if (ui.isSubmitting) return;
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    ui.errorMessage = null;
    paintControls();
  }

  function open(params: ComedorDayMenuEditModalParams): void {
    ui.dayKey = params.dayKey;
    ui.dayLabel = params.dayLabel;
    ui.fechaCorta = params.fechaCorta;
    ui.menuNormal = params.menuNormal;
    ui.menuDieta = params.menuDieta;
    // Copia profunda: editar en el modal no debe tocar el estado del planner hasta guardar.
    ui.detalle = MENU_DETALLE_CATEGORIAS.reduce((acc, categoria) => {
      acc[categoria.key] = [...(params.detalle[categoria.key] ?? [])];
      return acc;
    }, createEmptyMenuDiaDetalle());
    ui.isSubmitting = false;
    ui.errorMessage = null;

    inputNormalEl.value = ui.menuNormal;
    inputDietaEl.value = ui.menuDieta;
    paintDetalle();
    paintControls();
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    inputNormalEl.focus();
  }

  async function handleSave(): Promise<void> {
    if (ui.isSubmitting || !ui.dayKey) return;
    syncFromInputs();
    ui.isSubmitting = true;
    ui.errorMessage = null;
    paintControls();
    try {
      await options.onSave({
        dayKey: ui.dayKey,
        menuNormal: ui.menuNormal.trim(),
        menuDieta: ui.menuDieta.trim(),
        detalle: MENU_DETALLE_CATEGORIAS.reduce((acc, categoria) => {
          // Se descartan las líneas vacías que el usuario dejó sin llenar.
          acc[categoria.key] = ui.detalle[categoria.key]
            .map((valor) => valor.trim())
            .filter(Boolean);
          return acc;
        }, createEmptyMenuDiaDetalle()),
      });
      ui.isSubmitting = false;
      close();
    } catch (error) {
      ui.isSubmitting = false;
      ui.errorMessage = comedorErrorMessage(error);
      paintControls();
    }
  }

  detalleHostEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const addBtn = target?.closest<HTMLElement>("[data-comedor-plan-day-add]");
    if (addBtn) {
      const categoria = addBtn.dataset.categoria as ComedorMenuDetalleCategoria | undefined;
      if (!categoria) return;
      syncFromInputs();
      ui.detalle[categoria].push("");
      paintDetalle();
      const inputs = detalleHostEl.querySelectorAll<HTMLInputElement>(
        `[data-comedor-plan-day-item][data-categoria="${categoria}"]`,
      );
      inputs[inputs.length - 1]?.focus();
      return;
    }
    const removeBtn = target?.closest<HTMLElement>("[data-comedor-plan-day-remove]");
    if (removeBtn) {
      const categoria = removeBtn.dataset.categoria as ComedorMenuDetalleCategoria | undefined;
      const index = Number(removeBtn.dataset.index);
      if (!categoria || !Number.isInteger(index)) return;
      syncFromInputs();
      ui.detalle[categoria].splice(index, 1);
      paintDetalle();
    }
  });

  btnCancelEl.addEventListener("click", () => close());
  btnSaveEl.addEventListener("click", () => {
    void handleSave();
  });
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlayEl.classList.contains("hidden")) close();
  });

  return {
    open,
    close,
    destroy: () => {
      host.innerHTML = "";
    },
  };
}
