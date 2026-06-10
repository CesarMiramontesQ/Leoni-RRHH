import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_FOCUS } from "../../ui/uiTokens.ts";
import type { Campana360 } from "../types.ts";
import { campanaEstadoBadge, renderAvanceBar } from "../shared.ts";

export function renderEval360Campanas(campanas: Campana360[], showModal: boolean): string {
  const rows = campanas
    .map(
      (c) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/50">
      <td class="px-4 py-3">
        <p class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</p>
        <p class="text-xs text-text-muted">${escapeHtml(c.id)}</p>
      </td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(c.periodo)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-700">${c.empleados}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-700">${c.evaluadores}</td>
      <td class="px-4 py-3">${renderAvanceBar(c.avance)}</td>
      <td class="px-4 py-3">${campanaEstadoBadge(c.estado)}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">
          <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-campana-ver" data-id="${escapeHtml(c.id)}">Ver</button>
          <button type="button" class="text-xs font-semibold text-slate-600 hover:underline" data-action="e360-campana-editar" data-id="${escapeHtml(c.id)}">Editar</button>
          <button type="button" class="text-xs font-semibold text-slate-600 hover:underline" data-action="e360-campana-duplicar" data-id="${escapeHtml(c.id)}">Duplicar</button>
          ${c.estado !== "cerrada" ? `<button type="button" class="text-xs font-semibold text-red-600 hover:underline" data-action="e360-campana-cerrar" data-id="${escapeHtml(c.id)}">Cerrar</button>` : ""}
        </div>
      </td>
    </tr>`,
    )
    .join("");

  const modal = showModal
    ? `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="e360-modal-title">
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
        <div class="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 id="e360-modal-title" class="text-lg font-semibold text-text-primary">Nueva campaña</h2>
          <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" data-action="e360-close-modal" aria-label="Cerrar">✕</button>
        </div>
        <form class="space-y-6 p-6" data-form="e360-nueva-campana">
          <fieldset>
            <legend class="text-sm font-semibold text-text-primary">Información general</legend>
            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="mb-1 block text-xs font-medium text-text-muted">Nombre campaña</label>
                <input type="text" name="nombre" required class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}" placeholder="Ej. Evaluación Liderazgo Q3 2026" />
              </div>
              <div class="sm:col-span-2">
                <label class="mb-1 block text-xs font-medium text-text-muted">Descripción</label>
                <textarea name="descripcion" rows="2" class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}" placeholder="Objetivo y alcance de la campaña"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">Fecha inicio</label>
                <input type="date" name="fecha_inicio" required class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">Fecha cierre</label>
                <input type="date" name="fecha_cierre" required class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}" />
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend class="text-sm font-semibold text-text-primary">Participantes</legend>
            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">Empleados a evaluar</label>
                <select name="empleados" class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}">
                  <option value="">Seleccionar grupo</option>
                  <option value="mandos">Mandos medios</option>
                  <option value="supervisores">Supervisores</option>
                  <option value="todos">Todos los evaluables</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">Departamentos</label>
                <select name="departamentos" multiple class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}">
                  <option value="calidad">Calidad</option>
                  <option value="cableado">Cableado</option>
                  <option value="ensamble">Ensamble</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="mb-1 block text-xs font-medium text-text-muted">Puestos</label>
                <select name="puestos" multiple class="w-full rounded-lg border border-border px-3 py-2 text-sm ${FIELD_FOCUS}">
                  <option value="supervisor">Supervisor de línea</option>
                  <option value="lider">Líder de área</option>
                  <option value="coordinador">Coordinador</option>
                </select>
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend class="text-sm font-semibold text-text-primary">Configuración</legend>
            <div class="mt-3 space-y-2">
              ${[
                { name: "autoevaluacion", label: "Incluir autoevaluación" },
                { name: "clientes", label: "Incluir clientes" },
                { name: "anonima", label: "Evaluación anónima" },
                { name: "comentarios", label: "Mostrar comentarios", checked: true },
              ]
                .map(
                  (opt) => `
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="${opt.name}" ${opt.checked ? "checked" : ""} class="size-4 rounded border-border text-accent focus:ring-accent" />
                ${escapeHtml(opt.label)}
              </label>`,
                )
                .join("")}
            </div>
          </fieldset>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" class="${BTN_SECONDARY}" data-action="e360-close-modal">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">Crear campaña</button>
          </div>
        </form>
      </div>
    </div>`
    : "";

  return `
    <div class="rounded-xl border border-border bg-white">
      <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Campañas de evaluación</h2>
          <p class="mt-0.5 text-xs text-text-muted">${campanas.length} campañas registradas</p>
        </div>
        <button type="button" class="${BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Periodo</th>
              <th class="px-4 py-3">Empleados</th>
              <th class="px-4 py-3">Evaluadores</th>
              <th class="px-4 py-3">Avance</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    ${modal}`;
}
