/**
 * Modal para editar cualificaciones de un perfil de puesto (solo RH).
 * Formulario condicional por tipo con toggle N/A, años numéricos y autocomplete.
 */

import {
  getPerfilCualificaciones,
  createPerfilCualificacion,
  deletePerfilCualificacion,
  getSugerenciasCualificacion,
  type PerfilCualificacion,
} from "../../api/puestos.ts";
import { CATALOGO_ESCOLARIDAD, escolaridadLabel } from "../../ui/catalogoEscolaridad.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_DANGER, FIELD_FOCUS, SELECT_CHEVRON, badgeCancelled } from "../../ui/uiTokens.ts";

export type EditarCualificacionesModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCualificacionesModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "estudios_finalizados", label: "Estudios finalizados" },
  { value: "formacion_profesional", label: "Formacion profesional" },
  { value: "ampliacion_formacion", label: "Ampliacion de formacion" },
  { value: "estudios_universitarios", label: "Estudios universitarios" },
  { value: "experiencia_profesional", label: "Experiencia profesional" },
  { value: "experiencia_direccion", label: "Experiencia en direccion" },
  { value: "complementos", label: "Complementos" },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_OPTIONS.map(o => [o.value, o.label]),
);

const TIPOS_CON_NA = new Set([
  "formacion_profesional", "ampliacion_formacion", "estudios_universitarios", "experiencia_direccion",
]);
const TIPOS_CON_ANIOS = new Set(["experiencia_profesional", "experiencia_direccion"]);
const TIPOS_CON_AUTOCOMPLETE = new Set([
  "formacion_profesional", "ampliacion_formacion", "estudios_universitarios",
  "experiencia_profesional", "experiencia_direccion",
]);
const TIPOS_SIN_SPLIT = new Set(["estudios_finalizados", "complementos"]);

function overlayHtml(): string {
  return `
    <div
      id="editar-cualificaciones-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-cualificaciones-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-cualificaciones-title" class="text-lg font-semibold text-text-primary">Editar cualificaciones</h2>
          <button
            type="button"
            data-close-cualificaciones-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-cualificaciones-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderList(cualificaciones: PerfilCualificacion[]): string {
  if (cualificaciones.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin cualificaciones registradas.</p>`;
  }
  return `
    <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-4">
      ${cualificaciones.map(c => {
        const isNA = c.situacion_deseada === "N/A";
        let valor: string;
        if (isNA) {
          valor = badgeCancelled("No aplica");
        } else if (c.tipo === "estudios_finalizados") {
          valor = escapeHtml(escolaridadLabel(c.situacion_deseada));
        } else {
          valor = escapeHtml(c.situacion_deseada);
        }
        const aniosInfo = c.anios_minimos != null ? `<span class="text-xs text-slate-500 ml-1">(${c.anios_minimos} años mín.)</span>` : "";
        return `
        <div class="flex items-start justify-between gap-2 py-2">
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(TIPO_LABELS[c.tipo] ?? c.tipo)}</span>
            <span class="text-sm text-text-primary">${valor}${aniosInfo}</span>
            ${c.comentarios ? `<span class="block text-xs text-slate-500 mt-0.5">${escapeHtml(c.comentarios)}</span>` : ""}
          </div>
          <button type="button" data-delete-cualificacion="${c.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      }).join("")}
    </div>`;
}

function renderForm(): string {
  const tipoOpts = TIPO_OPTIONS.map(o =>
    `<option value="${o.value}">${escapeHtml(o.label)}</option>`
  ).join("");

  return `
    <form id="form-agregar-cualificacion" class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar cualificacion</p>
      <div>
        <label for="cual-tipo" class="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
        <div class="grid grid-cols-1">
          <select id="cual-tipo" name="tipo" required
            class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
            ${tipoOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div id="cual-na-wrap" class="hidden">
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="cual-na-toggle" class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
          <span class="text-sm text-slate-700">No aplica</span>
        </label>
      </div>
      <div id="cual-anios-wrap" class="hidden">
        <label for="cual-anios" class="mb-1 block text-xs font-medium text-slate-600">Años mínimos de experiencia</label>
        <input id="cual-anios" name="anios_minimos" type="number" min="0" step="1"
          class="block w-32 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="0" />
      </div>
      <div id="cual-situacion-container">
        <label for="cual-situacion" class="mb-1 block text-xs font-medium text-slate-600">Situacion deseada</label>
        <div id="cual-situacion-wrap" class="relative">
          <input id="cual-situacion" name="situacion_deseada" type="text" required autocomplete="off"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Descripcion de la situacion deseada" />
          <div id="cual-sugerencias" class="absolute z-10 mt-1 hidden max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"></div>
        </div>
      </div>
      <div id="cual-chips-preview" class="hidden">
        <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Se crear&aacute;n:</p>
        <div id="cual-chips-list" class="flex flex-wrap gap-1.5"></div>
      </div>
      <div>
        <label for="cual-comentarios" class="mb-1 block text-xs font-medium text-slate-600">Comentarios (opcional)</label>
        <textarea id="cual-comentarios" name="comentarios" rows="2"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Comentarios adicionales..."></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="submit" class="${BTN_PRIMARY} text-sm">Agregar</button>
      </div>
    </form>`;
}

export function mountEditarCualificacionesModal(
  host: HTMLElement,
  options: EditarCualificacionesModalOptions,
): EditarCualificacionesModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-cualificaciones-overlay") as HTMLElement;
  const body = host.querySelector("#editar-cualificaciones-body") as HTMLElement;

  let loading = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
    if (dirty) {
      dirty = false;
      options.onSuccess();
    }
  }

  async function refreshList(): Promise<void> {
    try {
      const items = await getPerfilCualificaciones(options.perfilId);
      body.innerHTML = renderList(items) + renderForm();
      bindForm();
      bindDeleteButtons();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar cualificaciones.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-cualificacion]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.deleteCualificacion);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilCualificacion(options.perfilId, id);
          dirty = true;
          await refreshList();
        } catch {
          // silently fail
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindForm(): void {
    const form = body.querySelector("#form-agregar-cualificacion") as HTMLFormElement | null;
    if (!form) return;

    const tipoSelect = form.querySelector("#cual-tipo") as HTMLSelectElement;
    const naWrap = form.querySelector("#cual-na-wrap") as HTMLElement;
    const naToggle = form.querySelector("#cual-na-toggle") as HTMLInputElement;
    const aniosWrap = form.querySelector("#cual-anios-wrap") as HTMLElement;
    const situacionContainer = form.querySelector("#cual-situacion-container") as HTMLElement;
    const wrap = form.querySelector("#cual-situacion-wrap") as HTMLElement;

    function updateFormFields(): void {
      const tipo = tipoSelect.value;
      const showNA = TIPOS_CON_NA.has(tipo);
      const showAnios = TIPOS_CON_ANIOS.has(tipo);
      const isEscolaridad = tipo === "estudios_finalizados";
      const isComplementos = tipo === "complementos";

      // Toggle N/A
      naWrap.classList.toggle("hidden", !showNA);
      if (!showNA) naToggle.checked = false;

      // Años
      aniosWrap.classList.toggle("hidden", !showAnios);

      // Situacion field
      if (naToggle.checked) {
        situacionContainer.classList.add("hidden");
      } else if (isEscolaridad) {
        situacionContainer.classList.remove("hidden");
        const opts = CATALOGO_ESCOLARIDAD.map(n =>
          `<option value="${n.key}">${escapeHtml(n.label)}</option>`
        ).join("");
        wrap.innerHTML = `
          <div class="grid grid-cols-1">
            <select id="cual-situacion" name="situacion_deseada" required
              class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              ${opts}
            </select>
            ${SELECT_CHEVRON}
          </div>`;
      } else if (isComplementos) {
        situacionContainer.classList.remove("hidden");
        wrap.innerHTML = `
          <textarea id="cual-situacion" name="situacion_deseada" required rows="6"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Requisitos, NOMs, etc."></textarea>`;
      } else if (showAnios) {
        situacionContainer.classList.remove("hidden");
        const label = tipo === "experiencia_profesional" ? "Conocimientos y habilidades requeridas" : "Descripcion adicional";
        wrap.innerHTML = `
          <textarea id="cual-situacion" name="situacion_deseada" required rows="3" autocomplete="off"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="${label}"></textarea>
          <div id="cual-sugerencias" class="absolute z-10 mt-1 hidden max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"></div>`;
        bindAutocomplete(tipo);
      } else {
        situacionContainer.classList.remove("hidden");
        wrap.innerHTML = `
          <input id="cual-situacion" name="situacion_deseada" type="text" required autocomplete="off"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Separar con comas para agregar varias" />
          <div id="cual-sugerencias" class="absolute z-10 mt-1 hidden max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"></div>`;
        if (TIPOS_CON_AUTOCOMPLETE.has(tipo)) bindAutocomplete(tipo);
      }
      bindInputChips();
    }

    function bindAutocomplete(tipo: string): void {
      const input = wrap.querySelector("#cual-situacion") as HTMLInputElement | HTMLTextAreaElement | null;
      const sugDiv = wrap.querySelector("#cual-sugerencias") as HTMLElement | null;
      if (!input || !sugDiv) return;

      input.addEventListener("input", () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        const val = input.value.trim();
        if (val.length < 2) { sugDiv.classList.add("hidden"); return; }
        debounceTimer = setTimeout(async () => {
          const items = await getSugerenciasCualificacion(tipo, val);
          if (items.length === 0) { sugDiv.classList.add("hidden"); return; }
          sugDiv.innerHTML = items.map(s =>
            `<button type="button" class="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100" data-sug="${escapeHtml(s)}">${escapeHtml(s)}</button>`
          ).join("");
          sugDiv.classList.remove("hidden");
        }, 320);
      });

      input.addEventListener("blur", () => {
        setTimeout(() => sugDiv.classList.add("hidden"), 200);
      });

      sugDiv.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("[data-sug]") as HTMLElement | null;
        if (!btn) return;
        input.value = btn.dataset.sug ?? "";
        sugDiv.classList.add("hidden");
      });
    }

    function splitValues(raw: string): string[] {
      return raw.split(",").map(s => s.trim()).filter(Boolean);
    }

    function updateChipsPreview(): void {
      const chipsWrap = form!.querySelector("#cual-chips-preview") as HTMLElement;
      const chipsList = form!.querySelector("#cual-chips-list") as HTMLElement;
      if (!chipsWrap || !chipsList) return;

      const tipo = tipoSelect.value;
      if (TIPOS_SIN_SPLIT.has(tipo) || naToggle.checked) {
        chipsWrap.classList.add("hidden");
        return;
      }

      const input = wrap.querySelector("#cual-situacion") as HTMLInputElement | HTMLTextAreaElement | null;
      if (!input) { chipsWrap.classList.add("hidden"); return; }

      const parts = splitValues(input.value);
      if (parts.length <= 1) {
        chipsWrap.classList.add("hidden");
        return;
      }

      chipsList.innerHTML = parts.map(p =>
        `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">${escapeHtml(p)}</span>`
      ).join("");
      chipsWrap.classList.remove("hidden");
    }

    function bindInputChips(): void {
      const input = wrap.querySelector("#cual-situacion") as HTMLInputElement | HTMLTextAreaElement | null;
      if (!input) return;
      input.addEventListener("input", updateChipsPreview);
    }

    naToggle.addEventListener("change", () => { updateFormFields(); updateChipsPreview(); });
    tipoSelect.addEventListener("change", () => {
      naToggle.checked = false;
      updateFormFields();
      updateChipsPreview();
    });
    updateFormFields();
    bindInputChips();

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (loading) return;
      loading = true;

      const tipo = tipoSelect.value;
      let values: string[];
      let anios_minimos: number | undefined;

      if (naToggle.checked) {
        values = ["N/A"];
      } else {
        const fd = new FormData(form);
        const raw = String(fd.get("situacion_deseada") ?? "").trim();
        if (!raw) { loading = false; return; }
        if (TIPOS_SIN_SPLIT.has(tipo)) {
          values = [raw];
        } else {
          values = splitValues(raw);
          if (values.length === 0) { loading = false; return; }
        }
      }

      if (TIPOS_CON_ANIOS.has(tipo)) {
        const aniosInput = form.querySelector("#cual-anios") as HTMLInputElement | null;
        const rawAnios = aniosInput?.value?.trim();
        if (rawAnios) anios_minimos = Number(rawAnios);
      }

      const fd2 = new FormData(form);
      const comentarios = String(fd2.get("comentarios") ?? "").trim() || undefined;

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Agregando..."; }

      try {
        for (const situacion_deseada of values) {
          await createPerfilCualificacion(options.perfilId, { tipo, situacion_deseada, comentarios, anios_minimos });
        }
        dirty = true;
        await refreshList();
      } catch {
        // keep form
      } finally {
        loading = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Agregar"; }
      }
    });
  }

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-cualificaciones-modal]")) close();
  });

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  }

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      refreshList();
    },
    close,
  };
}
