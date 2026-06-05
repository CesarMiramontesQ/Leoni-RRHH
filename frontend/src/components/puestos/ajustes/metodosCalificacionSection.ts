import {
  createMetodoCalificacion,
  createOpcionMetodo,
  deleteMetodoCalificacion,
  deleteOpcionMetodo,
  getMetodosCalificacion,
  getOpcionesMetodo,
  updateMetodoCalificacion,
} from "../../../api/cualificacionesCatalogo.ts";
import type { CatalogoFetchError } from "../../../api/cualificacionesCatalogo.ts";
import {
  COMPARADORES,
  COMPARADOR_DESCRIPCIONES,
  COMPARADOR_LABELS,
  labelComparador,
  labelMetodoTipo,
  METODO_TIPO_DESCRIPCIONES,
  METODO_TIPO_LABELS,
  METODO_TIPOS,
} from "../../../dashboard/cualificaciones/labels.ts";
import type { MetodoCalificacion, OpcionCalificacion } from "../../../dashboard/cualificaciones/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";

export function mountMetodosCalificacionSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: MetodoCalificacion[] = [];
  let opciones: OpcionCalificacion[] = [];
  let loading = true;
  let error = "";
  let selectedMetodoId: number | null = null;
  let modalOpen = false;
  let modalSaving = false;
  let modalError = "";
  let editingMetodo: MetodoCalificacion | null = null;

  function renderOpciones(): string {
    if (!selectedMetodoId) return `<p class="px-4 py-4 text-sm text-text-muted">Selecciona un método para ver opciones.</p>`;
    if (opciones.length === 0) return `<p class="px-4 py-4 text-sm text-text-muted">Sin opciones. Agrega opciones si el método lo requiere.</p>`;
    const rows = opciones.map((o) => `
      <tr class="border-b border-slate-100/90">
        <td class="px-3 py-2 text-sm">${escapeHtml(o.etiqueta)}</td>
        <td class="px-3 py-2 text-sm font-mono text-xs">${escapeHtml(o.valor)}</td>
        <td class="px-3 py-2 text-sm">${o.orden}</td>
        <td class="px-3 py-2 text-sm">${o.peso ?? "—"}</td>
        <td class="px-3 py-2 text-right">
          <button type="button" data-opcion-delete="${o.id}" class="text-sm text-red-600 hover:underline">Eliminar</button>
        </td>
      </tr>`).join("");
    return `<table class="min-w-full text-left text-sm"><thead><tr class="border-b border-slate-100">
      <th class="px-3 py-2 text-xs uppercase text-text-muted">Etiqueta</th>
      <th class="px-3 py-2 text-xs uppercase text-text-muted">Valor</th>
      <th class="px-3 py-2 text-xs uppercase text-text-muted">Orden</th>
      <th class="px-3 py-2 text-xs uppercase text-text-muted">Peso</th>
      <th class="px-3 py-2"></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderModal(): string {
    if (!modalOpen) return "";
    const m = editingMetodo;
    const tipoOpts = METODO_TIPOS.map((t) => {
      const label = METODO_TIPO_LABELS[t];
      const desc = METODO_TIPO_DESCRIPCIONES[t];
      return `<option value="${t}" ${m?.tipo === t ? "selected" : ""} title="${escapeHtml(desc)}">${escapeHtml(label)}</option>`;
    }).join("");
    const compOpts = COMPARADORES.map((c) => {
      const label = COMPARADOR_LABELS[c];
      const desc = COMPARADOR_DESCRIPCIONES[c];
      return `<option value="${c}" ${m?.config?.comparador === c ? "selected" : ""} title="${escapeHtml(desc)}">${escapeHtml(label)}</option>`;
    }).join("");
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold">${m ? "Editar método" : "Nuevo método"}</h3>
        <form id="metodo-form" class="mt-4 space-y-3">
          <div><label class="${RH_LISTADO_LABEL}">Nombre *</label>
            <input name="nombre" required value="${escapeHtml(m?.nombre ?? "")}" class="mt-1 w-full rounded border px-3 py-2 text-sm ${FIELD_FOCUS}" /></div>
          <div><label class="${RH_LISTADO_LABEL}">Tipo de evaluación *</label>
            <select name="tipo" class="mt-1 w-full ${RH_LISTADO_SELECT} ${SELECT_CHEVRON}">${tipoOpts}</select>
            <p class="mt-1 text-xs text-text-muted">Define cómo se captura el valor del empleado.</p></div>
          <div><label class="${RH_LISTADO_LABEL}">Regla de cumplimiento *</label>
            <select name="comparador" class="mt-1 w-full ${RH_LISTADO_SELECT} ${SELECT_CHEVRON}">${compOpts}</select>
            <p class="mt-1 text-xs text-text-muted">Cómo se compara el valor capturado contra el requisito del perfil.</p></div>
          <div><label class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea name="descripcion" rows="2" class="mt-1 w-full rounded border px-3 py-2 text-sm">${escapeHtml(m?.descripcion ?? "")}</textarea></div>
          ${modalError ? `<p class="text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
          <div class="flex justify-end gap-2">
            <button type="button" data-metodo-cancel class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">${modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div></div>`;
  }

  function paint(): void {
    const rows = items.map((m) => `
      <tr class="border-b border-slate-100/90 ${selectedMetodoId === m.id ? "bg-slate-50" : ""}">
        <td class="px-4 py-3 text-sm font-medium">${escapeHtml(m.nombre)}</td>
        <td class="px-4 py-3 text-sm text-text-muted" title="${escapeHtml(m.tipo)}">${escapeHtml(labelMetodoTipo(m.tipo))}</td>
        <td class="px-4 py-3 text-sm text-text-muted" title="${escapeHtml(m.config?.comparador ?? "")}">${escapeHtml(labelComparador(m.config?.comparador))}</td>
        <td class="px-3 py-3 text-right gap-1 flex justify-end">
          <button type="button" data-metodo-select="${m.id}" class="text-sm text-accent hover:underline">Opciones</button>
          <button type="button" data-metodo-edit="${m.id}" class="text-sm text-slate-600 hover:underline">Editar</button>
          <button type="button" data-metodo-delete="${m.id}" class="text-sm text-red-600 hover:underline">Eliminar</button>
        </td>
      </tr>`).join("");
    sectionEl.innerHTML = `<section class="${RH_LISTADO_SURFACE}">
      <div class="flex items-center justify-between border-b px-4 py-4">
        <div><h2 class="text-base font-semibold">Métodos de calificación</h2><p class="text-sm text-text-muted">Reglas de evaluación y comparación.</p></div>
        <button type="button" data-metodo-create class="${RH_LISTADO_BTN_PRIMARY}">Nuevo método</button>
      </div>
      ${loading ? `<p class="px-4 py-8 text-sm text-text-muted">Cargando…</p>` : error ? `<p class="mx-4 my-6 text-sm text-red-800">${escapeHtml(error)}</p>` : `
        <div class="overflow-x-auto"><table class="min-w-full"><thead><tr class="border-b border-slate-100">
          <th class="px-4 py-3 text-xs uppercase text-text-muted">Nombre</th>
          <th class="px-4 py-3 text-xs uppercase text-text-muted">Tipo de evaluación</th>
          <th class="px-4 py-3 text-xs uppercase text-text-muted">Regla de cumplimiento</th>
          <th class="px-3 py-3 text-right text-xs uppercase text-text-muted">Acciones</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
        <div class="border-t border-slate-100 px-4 py-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">Opciones del método</h3>
            ${selectedMetodoId ? `<button type="button" data-opcion-create class="text-sm text-accent hover:underline">+ Nueva opción</button>` : ""}
          </div>
          ${renderOpciones()}
        </div>`}
      ${renderModal()}</section>`;
  }

  async function loadOpciones(metodoId: number): Promise<void> {
    selectedMetodoId = metodoId;
    opciones = await getOpcionesMetodo(metodoId);
    paint();
  }

  async function load(): Promise<void> {
    loading = true; error = ""; paint();
    try { items = await getMetodosCalificacion(); loading = false; paint(); }
    catch (e) { loading = false; error = (e as CatalogoFetchError).detail ?? "Error"; paint(); }
  }

  sectionEl.addEventListener("click", async (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("[data-metodo-create]")) { editingMetodo = null; modalOpen = true; modalError = ""; paint(); return; }
    const editId = t.closest("[data-metodo-edit]")?.getAttribute("data-metodo-edit");
    if (editId) { editingMetodo = items.find((m) => m.id === Number(editId)) ?? null; modalOpen = true; modalError = ""; paint(); return; }
    const delId = t.closest("[data-metodo-delete]")?.getAttribute("data-metodo-delete");
    if (delId && confirm("¿Eliminar método?")) {
      try { await deleteMetodoCalificacion(Number(delId)); if (selectedMetodoId === Number(delId)) { selectedMetodoId = null; opciones = []; } await load(); }
      catch (e) { alert((e as CatalogoFetchError).detail); }
      return;
    }
    const selId = t.closest("[data-metodo-select]")?.getAttribute("data-metodo-select");
    if (selId) { await loadOpciones(Number(selId)); return; }
    if (t.closest("[data-metodo-cancel]")) { modalOpen = false; paint(); return; }
    const opcDel = t.closest("[data-opcion-delete]")?.getAttribute("data-opcion-delete");
    if (opcDel && selectedMetodoId && confirm("¿Eliminar opción?")) {
      try { await deleteOpcionMetodo(selectedMetodoId, Number(opcDel)); await loadOpciones(selectedMetodoId); }
      catch (e) { alert((e as CatalogoFetchError).detail); }
      return;
    }
    if (t.closest("[data-opcion-create]") && selectedMetodoId) {
      const etiqueta = prompt("Etiqueta de la opción:");
      if (!etiqueta?.trim()) return;
      const valor = prompt("Valor (clave estable):", etiqueta.toLowerCase().replace(/\s+/g, "_"));
      if (!valor?.trim()) return;
      const pesoStr = prompt("Peso (opcional, para listas ordenadas):");
      try {
        await createOpcionMetodo(selectedMetodoId, {
          etiqueta: etiqueta.trim(),
          valor: valor.trim(),
          orden: opciones.length,
          peso: pesoStr ? Number(pesoStr) : null,
        });
        await loadOpciones(selectedMetodoId);
      } catch (e) { alert((e as CatalogoFetchError).detail); }
    }
  }, { signal });

  sectionEl.addEventListener("submit", async (ev) => {
    if (!(ev.target as HTMLElement).closest("#metodo-form")) return;
    ev.preventDefault();
    const fd = new FormData(ev.target as HTMLFormElement);
    const body = {
      nombre: String(fd.get("nombre")).trim(),
      tipo: String(fd.get("tipo")),
      descripcion: String(fd.get("descripcion") ?? "").trim() || undefined,
      config: {
        comparador: String(fd.get("comparador")),
        permite_na: true,
        captura: { campos: ["opcion", "texto", "anios"], anios_habilitado: String(fd.get("tipo")) === "anios_experiencia" },
      },
    };
    modalSaving = true; modalError = ""; paint();
    try {
      if (editingMetodo) await updateMetodoCalificacion(editingMetodo.id, body);
      else await createMetodoCalificacion(body);
      modalOpen = false; modalSaving = false; await load();
    } catch (e) { modalSaving = false; modalError = (e as CatalogoFetchError).detail ?? "Error"; paint(); }
  }, { signal });

  void load();
}
