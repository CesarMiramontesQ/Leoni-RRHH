/**
 * Modal para evaluar cualificaciones de un empleado asignado.
 * Captura dinámica según método de calificación configurado.
 */

import {
  getAsignacionGap,
  updateEvaluaciones,
  type GapCualificacion,
} from "../../api/puestos.ts";
import {
  labelCapturado,
  labelCriterio,
  readCriterioFromForm,
  renderCriterioFieldsHtml,
} from "./cualificacionCriterioFields.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { MODAL_OVERLAY, MODAL_PANEL, RH_LISTADO_BTN_PRIMARY, badgeApproved, badgeRejected, badgeOpen } from "../../ui/uiTokens.ts";

export type EvaluarCualificacionesModalHandle = { open: () => void; close: () => void };
export type EvaluarCualificacionesModalOptions = {
  perfilId: number;
  asignacionId: number;
  empleadoNombre: string;
  onSuccess: () => void;
};

function cumpleBadge(cumple: boolean | null): string {
  if (cumple === true) return badgeApproved("Cumple");
  if (cumple === false) return badgeRejected("No cumple");
  return badgeOpen("Sin evaluar");
}

export function mountEvaluarCualificacionesModal(
  container: HTMLElement,
  opts: EvaluarCualificacionesModalOptions,
): EvaluarCualificacionesModalHandle {
  let gaps: GapCualificacion[] = [];
  let loading = false;
  let error = "";

  function overlayHtml(): string {
    return `<div id="evaluar-cualificaciones-overlay" class="${MODAL_OVERLAY} hidden">
      <div class="${MODAL_PANEL} max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">Evaluar cualificaciones</h2>
            <p class="text-sm text-text-muted">${escapeHtml(opts.empleadoNombre)}</p>
          </div>
          <button type="button" data-close-eval-cual class="rounded-lg p-1 text-text-muted hover:bg-surface">✕</button>
        </div>
        <div id="evaluar-cualificaciones-body"></div>
      </div></div>`;
  }

  function renderGapRow(g: GapCualificacion): string {
    const fields = renderCriterioFieldsHtml({
      prefix: `gap-${g.cualificacion_id}`,
      config: g.metodo_config as import("../../dashboard/cualificaciones/types.ts").MetodoCalificacionConfig,
      opciones: g.opciones,
      valor: g.valor_capturado,
      mode: "captura",
    });
    return `
      <div class="border-b border-slate-100 py-4" data-gap-id="${g.cualificacion_id}">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <p class="text-sm font-semibold text-text-primary">${escapeHtml(g.cualificacion_nombre)}</p>
            <p class="text-xs text-text-muted">Requerido: ${escapeHtml(g.criterio_label || labelCriterio(g.criterio_requerido, g.opciones))}</p>
            ${g.evaluado ? `<p class="text-xs mt-1">Actual: ${escapeHtml(g.capturado_label ?? labelCapturado(g.valor_capturado, g.opciones))}</p>` : ""}
          </div>
          ${cumpleBadge(g.cumple)}
        </div>
        <div class="criterio-captura-wrap">${fields}</div>
      </div>`;
  }

  function paintBody(): void {
    const body = container.querySelector("#evaluar-cualificaciones-body");
    if (!body) return;
    if (gaps.length === 0) {
      body.innerHTML = `<p class="text-sm text-text-muted">Este perfil no tiene cualificaciones.</p>`;
      return;
    }
    body.innerHTML = `
      <form id="eval-cual-form">
        ${gaps.map(renderGapRow).join("")}
        ${error ? `<p class="text-sm text-red-700 mt-2">${escapeHtml(error)}</p>` : ""}
        <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} mt-4 w-full" ${loading ? "disabled" : ""}>${loading ? "Guardando…" : "Guardar evaluación"}</button>
      </form>`;
  }

  async function loadGaps(): Promise<void> {
    const data = await getAsignacionGap(opts.perfilId, opts.asignacionId);
    gaps = data.gap_cualificaciones;
    paintBody();
  }

  async function open(): Promise<void> {
    const overlay = container.querySelector("#evaluar-cualificaciones-overlay");
    if (!(overlay instanceof HTMLElement)) return;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    error = "";
    await loadGaps();
  }

  function close(): void {
    const overlay = container.querySelector("#evaluar-cualificaciones-overlay");
    if (overlay instanceof HTMLElement) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  }

  container.innerHTML = overlayHtml();

  container.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement).closest("[data-close-eval-cual]")) close();
  });

  container.addEventListener("submit", async (ev) => {
    const form = (ev.target as HTMLElement).closest("#eval-cual-form");
    if (!form) return;
    ev.preventDefault();
    const evaluaciones = gaps.map((g) => {
      const row = form.querySelector(`[data-gap-id="${g.cualificacion_id}"] .criterio-captura-wrap`);
      const valor_capturado = row instanceof HTMLElement ? readCriterioFromForm(row) : {};
      return { cualificacion_id: g.cualificacion_id, valor_capturado };
    });
    loading = true; error = ""; paintBody();
    try {
      await updateEvaluaciones(opts.perfilId, opts.asignacionId, { evaluaciones_cualificacion: evaluaciones });
      loading = false;
      opts.onSuccess();
      await loadGaps();
    } catch (e) {
      loading = false;
      error = (e as { detail?: string }).detail ?? "Error al guardar.";
      paintBody();
    }
  });

  return { open: () => void open(), close };
}
