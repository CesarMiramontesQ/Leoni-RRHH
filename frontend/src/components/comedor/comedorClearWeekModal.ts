import { comedorErrorMessage } from "../../api/comedor.ts";
import { BTN_DANGER, BTN_SECONDARY } from "../../ui/uiTokens.ts";

export type ComedorClearWeekModalParams = {
  weekStartIso: string;
  weekLabel: string;
};

export type ComedorClearWeekModalOptions = {
  onConfirm: (params: ComedorClearWeekModalParams) => void | Promise<void>;
};

export type ComedorClearWeekModalHandle = {
  open: (params: ComedorClearWeekModalParams) => void;
  close: () => void;
  destroy: () => void;
};

type ModalUiState = {
  weekStartIso: string;
  weekLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
};

function shellHtml(): string {
  return `
    <div
      id="comedor-plan-clear-overlay"
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="comedor-plan-clear-panel"
        class="scheme-light relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-plan-clear-titulo"
      >
        <header class="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 id="comedor-plan-clear-titulo" class="text-lg font-bold text-slate-900">Eliminar planeación de la semana</h2>
        </header>
        <div class="space-y-4 px-5 py-5 sm:px-6">
          <p class="text-sm leading-relaxed text-slate-600">
            Se eliminarán todos los registros del menú de
            <strong id="comedor-plan-clear-semana" class="font-semibold text-slate-900"></strong>.
            Esta acción no se puede deshacer.
          </p>
          <p class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Después podrás registrar una nueva planeación con el archivo XLSX.
          </p>
          <div id="comedor-plan-clear-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"></div>
        </div>
        <footer class="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" data-comedor-plan-clear-cancelar class="${BTN_SECONDARY} min-h-11 justify-center">Cancelar</button>
          <button type="button" data-comedor-plan-clear-confirmar class="${BTN_DANGER} min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-70">
            Eliminar semana
          </button>
        </footer>
      </div>
    </div>`;
}

export function mountComedorClearWeekModal(
  host: HTMLElement,
  options: ComedorClearWeekModalOptions,
): ComedorClearWeekModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector<HTMLElement>("#comedor-plan-clear-overlay");
  const weekLabelEl = host.querySelector<HTMLElement>("#comedor-plan-clear-semana");
  const errorBox = host.querySelector<HTMLElement>("#comedor-plan-clear-error");
  const btnCancel = host.querySelector<HTMLButtonElement>("[data-comedor-plan-clear-cancelar]");
  const btnConfirm = host.querySelector<HTMLButtonElement>("[data-comedor-plan-clear-confirmar]");

  if (!overlay || !weekLabelEl || !errorBox || !btnCancel || !btnConfirm) {
    return { open: () => {}, close: () => {}, destroy: () => { host.innerHTML = ""; } };
  }

  const overlayEl = overlay;
  const weekLabelElRef = weekLabelEl;
  const errorBoxEl = errorBox;
  const btnCancelEl = btnCancel;
  const btnConfirmEl = btnConfirm;

  const ui: ModalUiState = {
    weekStartIso: "",
    weekLabel: "",
    isSubmitting: false,
    errorMessage: null,
  };

  function paintControls(): void {
    weekLabelElRef.textContent = ui.weekLabel;
    btnConfirmEl.disabled = ui.isSubmitting;
    btnCancelEl.disabled = ui.isSubmitting;
    btnConfirmEl.textContent = ui.isSubmitting ? "Eliminando..." : "Eliminar semana";
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

  function open(params: ComedorClearWeekModalParams): void {
    ui.weekStartIso = params.weekStartIso;
    ui.weekLabel = params.weekLabel;
    ui.isSubmitting = false;
    ui.errorMessage = null;
    paintControls();
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    btnCancelEl.focus();
  }

  async function handleConfirm(): Promise<void> {
    if (ui.isSubmitting || !ui.weekStartIso) return;
    ui.isSubmitting = true;
    ui.errorMessage = null;
    paintControls();
    try {
      await options.onConfirm({
        weekStartIso: ui.weekStartIso,
        weekLabel: ui.weekLabel,
      });
      ui.isSubmitting = false;
      close();
    } catch (error) {
      ui.isSubmitting = false;
      ui.errorMessage = comedorErrorMessage(error);
      paintControls();
    }
  }

  btnCancelEl.addEventListener("click", () => close());
  btnConfirmEl.addEventListener("click", () => {
    void handleConfirm();
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
