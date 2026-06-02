/**
 * Modal RH: nueva planeación semanal desde plantilla Excel (Formato Planeación Menú).
 */
import type { PlaneacionMenuTemplateDay } from "../../comedor/rh/parsePlaneacionMenuTemplate.ts";
import { parsePlaneacionMenuTemplateFile } from "../../comedor/rh/parsePlaneacionMenuTemplate.ts";
import { buildWeekRangeFromPickerDate } from "../../comedor/rh/weekRange.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../../ui/uiTokens.ts";

export type ComedorWeeklyPlanningImportPayload = {
  weekStartIso: string;
  days: PlaneacionMenuTemplateDay[];
};

export type ComedorWeeklyPlanningImportModalOptions = {
  onImport: (payload: ComedorWeeklyPlanningImportPayload) => void | Promise<void>;
};

export type ComedorWeeklyPlanningImportModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

type ModalUiState = {
  pickerDateIso: string;
  weekRangeLabel: string | null;
  weekStartIso: string | null;
  fileName: string | null;
  parsedDays: PlaneacionMenuTemplateDay[] | null;
  feedback: { tone: "error" | "success" | "info"; message: string } | null;
  isSubmitting: boolean;
};

function initialUiState(): ModalUiState {
  return {
    pickerDateIso: "",
    weekRangeLabel: null,
    weekStartIso: null,
    fileName: null,
    parsedDays: null,
    feedback: null,
    isSubmitting: false,
  };
}

function shellHtml(): string {
  return `
    <div
      id="comedor-plan-import-overlay"
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="comedor-plan-import-panel"
        class="scheme-light flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-plan-import-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="comedor-plan-import-titulo" class="text-lg font-bold text-slate-900">Nueva planeación semanal</h2>
            <p class="mt-1 text-xs text-slate-500">Selecciona la semana (lunes a domingo) y carga la plantilla Excel.</p>
          </div>
          <button
            type="button"
            data-comedor-plan-import-cerrar
            class="-m-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
          </button>
        </header>
        <form id="comedor-plan-import-form" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <label for="comedor-plan-import-fecha" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de la semana</label>
            <input
              id="comedor-plan-import-fecha"
              name="fecha"
              type="date"
              required
              class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
            />
            <p class="mt-1 text-xs text-slate-500">Elige cualquier día; se calculará el lunes de esa semana como inicio.</p>
          </div>
          <div id="comedor-plan-import-rango" class="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Semana seleccionada</p>
            <p id="comedor-plan-import-rango-texto" class="mt-1 font-semibold text-slate-900"></p>
          </div>
          <div>
            <label for="comedor-plan-import-archivo" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plantilla Excel</label>
            <input
              id="comedor-plan-import-archivo"
              name="archivo"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-leoni-blue/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-leoni-blue hover:file:bg-leoni-blue/15"
            />
            <p class="mt-1 text-xs text-slate-500">Formato «Planeación Menú»: columnas Lunes–Domingo; filas OPCIÓN A y OPCIÓN B.</p>
          </div>
          <div id="comedor-plan-import-feedback" class="hidden rounded-xl px-4 py-3 text-sm" role="status"></div>
          <footer class="mt-auto flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-comedor-plan-import-cancelar class="${BTN_SECONDARY} min-h-11 justify-center">Cancelar</button>
            <button type="submit" id="comedor-plan-import-submit" class="${BTN_PRIMARY} min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-70">Registrar planeación</button>
          </footer>
        </form>
      </div>
    </div>`;
}

function feedbackClasses(tone: "error" | "success" | "info"): string {
  if (tone === "success") return "border border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "info") return "border border-sky-200 bg-sky-50 text-sky-900";
  return "border border-red-200 bg-red-50 text-red-800";
}

export function mountComedorWeeklyPlanningImportModal(
  host: HTMLElement,
  options: ComedorWeeklyPlanningImportModalOptions,
): ComedorWeeklyPlanningImportModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector<HTMLElement>("#comedor-plan-import-overlay");
  const form = host.querySelector<HTMLFormElement>("#comedor-plan-import-form");
  const fechaInput = host.querySelector<HTMLInputElement>("#comedor-plan-import-fecha");
  const archivoInput = host.querySelector<HTMLInputElement>("#comedor-plan-import-archivo");
  const rangoBox = host.querySelector<HTMLElement>("#comedor-plan-import-rango");
  const rangoTexto = host.querySelector<HTMLElement>("#comedor-plan-import-rango-texto");
  const feedbackBox = host.querySelector<HTMLElement>("#comedor-plan-import-feedback");
  const btnSubmit = host.querySelector<HTMLButtonElement>("#comedor-plan-import-submit");

  if (!overlay || !form || !fechaInput || !archivoInput || !rangoBox || !rangoTexto || !feedbackBox || !btnSubmit) {
    return { open: () => {}, close: () => {}, destroy: () => { host.innerHTML = ""; } };
  }

  const overlayEl = overlay;
  const formEl = form;
  const fechaInputEl = fechaInput;
  const archivoInputEl = archivoInput;
  const rangoBoxEl = rangoBox;
  const rangoTextoEl = rangoTexto;
  const feedbackBoxEl = feedbackBox;
  const btnSubmitEl = btnSubmit;

  let ui: ModalUiState = initialUiState();

  function setFeedback(tone: "error" | "success" | "info" | null, message: string | null): void {
    if (!tone || !message) {
      feedbackBoxEl.classList.add("hidden");
      feedbackBoxEl.textContent = "";
      ui.feedback = null;
      return;
    }
    ui.feedback = { tone, message };
    feedbackBoxEl.className = `rounded-xl px-4 py-3 text-sm ${feedbackClasses(tone)}`;
    feedbackBoxEl.textContent = message;
    feedbackBoxEl.classList.remove("hidden");
  }

  function syncWeekFromPicker(): void {
    const range = buildWeekRangeFromPickerDate(fechaInputEl.value);
    if (!range) {
      ui.weekStartIso = null;
      ui.weekRangeLabel = null;
      rangoBoxEl.classList.add("hidden");
      return;
    }
    ui.weekStartIso = range.weekStartIso;
    ui.weekRangeLabel = range.weekLabelLong;
    rangoTextoEl.textContent = range.weekLabelLong;
    rangoBoxEl.classList.remove("hidden");
  }

  function paintSubmitState(): void {
    btnSubmitEl.disabled = ui.isSubmitting;
    btnSubmitEl.textContent = ui.isSubmitting ? "Registrando..." : "Registrar planeación";
  }

  function resetForm(): void {
    ui = initialUiState();
    formEl.reset();
    rangoBoxEl.classList.add("hidden");
    setFeedback(null, null);
    paintSubmitState();
  }

  function open(): void {
    resetForm();
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    fechaInputEl.focus();
  }

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    resetForm();
  }

  fechaInputEl.addEventListener("change", () => {
    ui.pickerDateIso = fechaInputEl.value;
    syncWeekFromPicker();
    if (!ui.weekStartIso) {
      setFeedback("error", "Selecciona una semana de planeación.");
    } else {
      setFeedback(null, null);
    }
  });

  archivoInputEl.addEventListener("change", async () => {
    const file = archivoInputEl.files?.[0] ?? null;
    ui.fileName = file?.name ?? null;
    ui.parsedDays = null;
    if (!file) return;

    setFeedback("info", "Procesando plantilla…");
    const result = await parsePlaneacionMenuTemplateFile(file);
    if (!result.ok) {
      ui.parsedDays = null;
      setFeedback("error", result.message);
      return;
    }
    ui.parsedDays = result.days;
    setFeedback("success", `Plantilla válida (${file.name}). Revisa la semana y confirma el registro.`);
  });

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncWeekFromPicker();

    if (!ui.weekStartIso) {
      setFeedback("error", "Debes seleccionar una semana antes de registrar la planeación.");
      return;
    }
    if (!ui.parsedDays?.length) {
      setFeedback("error", "Debes cargar una plantilla válida antes de registrar.");
      return;
    }

    ui.isSubmitting = true;
    paintSubmitState();
    try {
      await options.onImport({ weekStartIso: ui.weekStartIso, days: ui.parsedDays });
      setFeedback("success", "Planeación semanal registrada correctamente.");
      window.setTimeout(() => close(), 900);
    } catch (error) {
      setFeedback(
        "error",
        error instanceof Error ? error.message : "No se pudo registrar la planeación semanal.",
      );
    } finally {
      ui.isSubmitting = false;
      paintSubmitState();
    }
  });

  host.querySelector("[data-comedor-plan-import-cerrar]")?.addEventListener("click", close);
  host.querySelector("[data-comedor-plan-import-cancelar]")?.addEventListener("click", close);
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });

  return {
    open,
    close,
    destroy: () => {
      host.innerHTML = "";
    },
  };
}
