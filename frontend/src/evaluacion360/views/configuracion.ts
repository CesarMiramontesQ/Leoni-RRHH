import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { CATALOGO_COMPETENCIAS, ESCALA_EVALUACION, TIPOS_EVALUADOR_CONFIG } from "../mockData.ts";
import { renderSurfaceCard } from "../shared.ts";

export function renderEval360Configuracion(): string {
  const catalogo = CATALOGO_COMPETENCIAS.map(
    (c) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/50">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</td>
      <td class="px-4 py-3 text-sm text-slate-600 max-w-xs">${escapeHtml(c.descripcion)}</td>
      <td class="px-4 py-3">
        <input type="number" value="${c.peso}" min="0" max="100" class="w-20 rounded-lg border border-border px-2 py-1 text-sm tabular-nums ${FIELD_FOCUS}" aria-label="Peso ${escapeHtml(c.nombre)}" />
        <span class="ml-1 text-xs text-slate-500">%</span>
      </td>
    </tr>`,
  ).join("");

  const escala = ESCALA_EVALUACION.map(
    (e) => `
    <div class="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">${e.valor}</span>
      <span class="text-sm font-medium text-text-primary">${escapeHtml(e.etiqueta)}</span>
    </div>`,
  ).join("");

  const tiposEvaluador = TIPOS_EVALUADOR_CONFIG.map(
    (t) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(t.label)}</td>
      <td class="px-4 py-3">
        <input type="number" value="${t.ponderacion}" min="0" max="100" class="w-20 rounded-lg border border-border px-2 py-1 text-sm tabular-nums ${FIELD_FOCUS}" aria-label="Ponderación ${escapeHtml(t.label)}" />
        <span class="ml-1 text-xs text-slate-500">%</span>
      </td>
    </tr>`,
  ).join("");

  return `
    <div class="space-y-5">
      ${renderSurfaceCard(
        "Catálogo de competencias",
        "Competencias evaluadas en campañas 360°",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-2">Nombre</th>
                <th class="px-4 py-2">Descripción</th>
                <th class="px-4 py-2">Peso</th>
              </tr>
            </thead>
            <tbody>${catalogo}</tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-text-muted">
          Vinculado al catálogo de <a href="#/competencias" class="font-medium text-accent hover:underline">Competencias</a> y perfiles de <a href="#/puestos" class="font-medium text-accent hover:underline">puesto</a>.
        </p>`,
      )}

      ${renderSurfaceCard("Escala de evaluación", "Escala Likert de 1 a 5", `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${escala}</div>`)}

      ${renderSurfaceCard(
        "Tipos de evaluador",
        "Ponderaciones por tipo de evaluador (deben sumar 100%)",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left max-w-md">
            <thead>
              <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-2">Tipo</th>
                <th class="px-4 py-2">Ponderación</th>
              </tr>
            </thead>
            <tbody>${tiposEvaluador}</tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-slate-500">Total actual: ${TIPOS_EVALUADOR_CONFIG.reduce((s, t) => s + t.ponderacion, 0)}%</p>`,
      )}
    </div>`;
}
