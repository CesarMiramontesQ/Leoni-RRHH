/**
 * Modal para evaluar cualificaciones de un empleado asignado a un perfil.
 * Muestra gap analysis con badges de compliance para escolaridad, años y N/A.
 */

import {
  getAsignacionGap,
  updateEvaluaciones,
  type GapCualificacion,
  type EvaluacionCualificacionPayload,
} from "../../api/puestos.ts";
import { CATALOGO_ESCOLARIDAD, escolaridadLabel, esTipoEscolaridad } from "../../ui/catalogoEscolaridad.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, FIELD_FOCUS, SELECT_CHEVRON, badgeApproved, badgeRejected, badgePending, badgeCancelled } from "../../ui/uiTokens.ts";

export type EvaluarCualificacionesModalHandle = {
  open: () => void;
  close: () => void;
};

export type EvaluarCualificacionesModalOptions = {
  perfilId: number;
  asignacionId: number;
  nombreEmpleado: string;
  onSuccess?: () => void;
};

const TIPO_LABELS: Record<string, string> = {
  estudios_finalizados: "Nivel de estudios finalizados",
  formacion_profesional: "Formación profesional/ especialización (académica)/ diplomas",
  ampliacion_formacion: "Ampliación de la formación profesional/especialización (académica)/diplomas",
  estudios_universitarios: "Estudios universitarios / especialización (académica)/ diplomas",
  experiencia_profesional: "Experiencia profesional",
  experiencia_direccion: "Experiencia de dirección/ gerencia",
  complementos: "Complementos individuales",
};

const TIPOS_CON_ANIOS = new Set(["experiencia_profesional", "experiencia_direccion"]);

function complianceBadge(cumple: boolean | null): string {
  if (cumple === true) return badgeApproved("Cumple");
  if (cumple === false) return badgeRejected("No cumple");
  return "";
}

function renderGapItem(g: GapCualificacion, idx: number): string {
  const isEscolaridad = esTipoEscolaridad(g.tipo);
  const isNA = g.situacion_deseada === "N/A";
  const hasAnios = TIPOS_CON_ANIOS.has(g.tipo) && g.anios_minimos != null;
  const deseadaDisplay = isEscolaridad ? escolaridadLabel(g.situacion_deseada) : g.situacion_deseada;

  // N/A: no input needed, always complies
  if (isNA) {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(TIPO_LABELS[g.tipo] ?? g.tipo)}</span>
            <span class="text-sm text-slate-500">${badgeCancelled("No aplica")}</span>
          </div>
          <div class="shrink-0">${badgeApproved("Cumple")}</div>
        </div>
      </div>`;
  }

  let inputHtml: string;
  if (isEscolaridad) {
    const opts = CATALOGO_ESCOLARIDAD.map(n =>
      `<option value="${n.key}" ${g.situacion_actual === n.key ? "selected" : ""}>${escapeHtml(n.label)}</option>`
    ).join("");
    inputHtml = `
      <div class="grid grid-cols-1">
        <select name="eval-${idx}" data-cual-id="${g.cualificacion_id}" required
          class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
          <option value="">— Seleccionar —</option>
          ${opts}
        </select>
        ${SELECT_CHEVRON}
      </div>`;
  } else if (hasAnios) {
    // Cualificaciones con años: solo Cumple / No cumple
    inputHtml = `
      <div class="grid grid-cols-1">
        <select name="eval-${idx}" data-cual-id="${g.cualificacion_id}"
          class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
          <option value="">— Seleccionar —</option>
          <option value="cumple" ${(g.situacion_actual ?? "").toLowerCase() === "cumple" ? "selected" : ""}>Cumple</option>
          <option value="no cumple" ${(g.situacion_actual ?? "").toLowerCase() === "no cumple" ? "selected" : ""}>No cumple</option>
        </select>
        ${SELECT_CHEVRON}
      </div>`;
  } else {
    // Cualificaciones genéricas: escala 1-3
    const currentNivel = parseInt(g.situacion_actual ?? "0", 10);
    inputHtml = `
      <div class="grid grid-cols-1">
        <select name="eval-${idx}" data-cual-id="${g.cualificacion_id}"
          class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
          <option value="">— Seleccionar —</option>
          <option value="1" ${currentNivel === 1 ? "selected" : ""}>1 — Básico</option>
          <option value="2" ${currentNivel === 2 ? "selected" : ""}>2 — Medio</option>
          <option value="3" ${currentNivel === 3 ? "selected" : ""}>3 — Experto</option>
        </select>
        ${SELECT_CHEVRON}
      </div>`;
  }

  const aniosHtml = "";

  return `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(TIPO_LABELS[g.tipo] ?? g.tipo)}</span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(deseadaDisplay)}</span>
          ${g.anios_minimos != null ? `<span class="text-xs text-slate-500 ml-1">(${g.anios_minimos} años mín.)</span>` : ""}
        </div>
        <div class="shrink-0">
          ${g.evaluado ? complianceBadge(g.cumple) : badgePending("Pendiente")}
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Situación actual</label>
        ${inputHtml}
      </div>
      ${aniosHtml}
    </div>`;
}

function overlayHtml(nombreEmpleado: string): string {
  return `
    <div id="evaluar-cual-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation">
      <div class="w-full max-w-lg rounded-xl border border-border bg-white shadow-xl flex flex-col max-h-[85vh]"
        role="dialog" aria-modal="true" aria-labelledby="evaluar-cual-title">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div>
            <h2 id="evaluar-cual-title" class="text-lg font-semibold text-text-primary">Evaluar cualificaciones</h2>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(nombreEmpleado)}</p>
          </div>
          <button type="button" data-close-evaluar-modal class="${BTN_GHOST} !p-1.5" aria-label="Cerrar">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div id="evaluar-cual-body" class="flex-1 overflow-y-auto px-5 py-4"></div>
      </div>
    </div>`;
}

export function mountEvaluarCualificacionesModal(
  host: HTMLElement,
  options: EvaluarCualificacionesModalOptions,
): EvaluarCualificacionesModalHandle {
  host.innerHTML = overlayHtml(options.nombreEmpleado);

  const overlay = host.querySelector("#evaluar-cual-overlay") as HTMLElement;
  const body = host.querySelector("#evaluar-cual-body") as HTMLElement;

  let loading = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  }

  async function loadGap(): Promise<void> {
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
    try {
      const data = await getAsignacionGap(options.perfilId, options.asignacionId);
      const gaps = data.gap_cualificaciones;

      if (gaps.length === 0) {
        body.innerHTML = `<p class="text-sm text-slate-500 italic">Sin cualificaciones definidas para este perfil.</p>`;
        return;
      }

      const items = gaps.map((g, i) => renderGapItem(g, i)).join("");
      const resumen = data.resumen;

      body.innerHTML = `
        <div class="mb-3 flex items-center gap-3 text-xs text-slate-500">
          <span>${resumen.evaluadas_cualificaciones}/${resumen.total_cualificaciones} evaluadas</span>
          ${resumen.pendientes_cualificaciones > 0 ? `<span class="text-amber-600 font-medium">${resumen.pendientes_cualificaciones} pendiente${resumen.pendientes_cualificaciones > 1 ? "s" : ""}</span>` : ""}
        </div>
        <form id="form-evaluar-cual" class="space-y-3">
          ${items}
          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" data-close-evaluar-modal class="${BTN_GHOST} text-sm">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY} text-sm">Guardar evaluaciones</button>
          </div>
        </form>`;

      bindForm();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar evaluaciones.</p>`;
    }
  }

  function bindForm(): void {
    const form = body.querySelector("#form-evaluar-cual") as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (loading) return;
      loading = true;

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }

      const evaluaciones: EvaluacionCualificacionPayload[] = [];
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-cual-id]").forEach(el => {
        const val = el.value.trim();
        if (val) {
          const cualId = Number(el.dataset.cualId);
          const payload: EvaluacionCualificacionPayload = {
            cualificacion_id: cualId,
            situacion_actual: val,
          };
          evaluaciones.push(payload);
        }
      });

      try {
        await updateEvaluaciones(options.perfilId, options.asignacionId, {
          evaluaciones_cualificacion: evaluaciones,
        });
        options.onSuccess?.();
        await loadGap();
      } catch {
        // keep form, user can retry
      } finally {
        loading = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Guardar evaluaciones"; }
      }
    });

    body.querySelectorAll("[data-close-evaluar-modal]").forEach(btn => {
      btn.addEventListener("click", close);
    });
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.querySelector("[data-close-evaluar-modal]")?.addEventListener("click", close);

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      loadGap();
    },
    close,
  };
}
