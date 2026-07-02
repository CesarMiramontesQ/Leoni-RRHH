import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT, FIELD_TEXTAREA } from "../../ui/uiTokens.ts";
import { renderSurfaceCard } from "../shared.ts";
import type { CompetenciaCatalogoApi, PreguntaApi } from "../../api/evaluacion360.ts";

export interface BancoPreguntasViewData {
  catalogo: CompetenciaCatalogoApi[] | null;
  competenciaId: number | null;
  preguntas: PreguntaApi[] | null;
  loading: boolean;
  editandoId: number | null;
}

function competenciaSelector(data: BancoPreguntasViewData): string {
  const catalogo = data.catalogo ?? [];
  const opciones = [
    `<option value="">Selecciona una competencia…</option>`,
    ...catalogo.map((c) => {
      const suf = c.num_preguntas > 0 ? `${c.num_preguntas} preg.` : "⚠ sin preguntas";
      return `<option value="${c.id}" ${c.id === data.competenciaId ? "selected" : ""}>${escapeHtml(c.nombre)} · ${suf}</option>`;
    }),
  ].join("");
  return `
    <div class="rounded-xl border border-border bg-white p-4">
      <label class="mb-1 block text-xs font-medium text-text-muted">Competencia</label>
      <select data-select="e360-preg-competencia" class="${FIELD_INPUT} max-w-md">${opciones}</select>
      ${data.catalogo === null ? `<p class="mt-2 text-xs text-text-muted">Cargando catálogo…</p>` : ""}
      ${data.catalogo !== null && catalogo.length === 0 ? `<p class="mt-2 text-xs text-text-muted">No hay competencias en el catálogo.</p>` : ""}
    </div>`;
}

function formAgregar(): string {
  return renderSurfaceCard(
    "Agregar pregunta",
    "Se añade al banco de la competencia seleccionada",
    `<div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs font-medium text-text-muted">Texto de la pregunta</label>
        <textarea data-input="e360-preg-nueva-texto" rows="2" class="${FIELD_TEXTAREA}" placeholder="Ej. Comunica sus ideas de forma clara y oportuna."></textarea>
      </div>
      <div class="flex items-end gap-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Orden (opcional)</label>
          <input type="number" min="1" data-input="e360-preg-nueva-orden" class="${FIELD_INPUT} w-28" placeholder="auto" />
        </div>
        <button type="button" class="${BTN_PRIMARY}" data-action="e360-preg-add">Agregar</button>
      </div>
    </div>`,
  );
}

function filaPregunta(p: PreguntaApi, editando: boolean): string {
  if (editando) {
    return `
      <tr class="border-b border-slate-100 bg-slate-50/60">
        <td class="px-3 py-3" colspan="4">
          <textarea data-input="e360-preg-edit-texto" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(p.texto)}</textarea>
          <div class="mt-2 flex items-center gap-4">
            <label class="flex items-center gap-2 text-xs text-text-primary">
              <input type="checkbox" data-input="e360-preg-edit-activa" ${p.activo ? "checked" : ""} class="size-4" /> Activa
            </label>
            <input type="number" min="1" data-input="e360-preg-edit-orden" value="${p.orden ?? ""}" placeholder="orden" class="${FIELD_INPUT} w-24" />
            <div class="ml-auto flex gap-2">
              <button type="button" class="${BTN_SECONDARY}" data-action="e360-preg-cancelar">Cancelar</button>
              <button type="button" class="${BTN_PRIMARY}" data-action="e360-preg-guardar" data-id="${p.id}">Guardar</button>
            </div>
          </div>
        </td>
      </tr>`;
  }
  const badge = p.activo
    ? `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">Activa</span>`
    : `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactiva</span>`;
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50/60">
      <td class="px-3 py-3 text-sm tabular-nums text-slate-500 w-12">${p.orden ?? "—"}</td>
      <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(p.texto)}</td>
      <td class="px-3 py-3">${badge}</td>
      <td class="px-3 py-3 text-right whitespace-nowrap">
        <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-preg-editar" data-id="${p.id}">Editar</button>
        <button type="button" class="ml-3 text-xs font-semibold text-red-600 hover:underline" data-action="e360-preg-borrar" data-id="${p.id}">Borrar</button>
      </td>
    </tr>`;
}

function listaPreguntas(data: BancoPreguntasViewData): string {
  if (data.preguntas === null || data.loading) {
    return `<div class="mt-5 h-40 animate-pulse rounded-xl bg-slate-100"></div>`;
  }
  const filas = data.preguntas
    .map((p) => filaPregunta(p, data.editandoId === p.id))
    .join("");
  const body = `<div class="overflow-x-auto -mx-5 px-5">
      <table class="min-w-full text-left">
        <thead>
          <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-3 py-2 w-12">#</th>
            <th class="px-3 py-2">Pregunta</th>
            <th class="px-3 py-2">Estado</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>${filas || `<tr><td colspan="4" class="px-3 py-8 text-center text-sm text-text-muted">Esta competencia aún no tiene preguntas. Agrega la primera arriba.</td></tr>`}</tbody>
      </table>
    </div>`;
  return `<div class="mt-5">${renderSurfaceCard("Preguntas", `${data.preguntas.length} pregunta(s) en el banco`, body)}</div>`;
}

export function renderEval360BancoPreguntas(data: BancoPreguntasViewData): string {
  const selector = competenciaSelector(data);
  if (data.competenciaId == null) {
    return `
      ${selector}
      <div class="mt-5 rounded-xl border border-dashed border-border bg-slate-50/50 px-4 py-10 text-center text-sm text-text-muted">
        Selecciona una competencia para administrar su banco de preguntas.
      </div>`;
  }
  return `
    ${selector}
    <div class="mt-5">${formAgregar()}</div>
    ${listaPreguntas(data)}`;
}
