import {
  createTipoCualificacion,
  deleteTipoCualificacion,
  getMetodosCalificacion,
  getTiposCualificacion,
  updateTipoCualificacion,
} from "../../../api/cualificacionesCatalogo.ts";
import type { CatalogoFetchError } from "../../../api/cualificacionesCatalogo.ts";
import { labelMetodoTipo } from "../../../dashboard/cualificaciones/labels.ts";
import type { MetodoCalificacion, TipoCualificacion } from "../../../dashboard/cualificaciones/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_DANGER,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;

type ModalMode = "create" | "edit" | "delete" | null;

export function mountTiposCualificacionSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: TipoCualificacion[] = [];
  let metodos: MetodoCalificacion[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let editingDescripcion = "";
  let editingMetodoId: number | null = null;
  let deletingItem: TipoCualificacion | null = null;
  let modalError = "";

  function metodoOptsHtml(): string {
    return metodos
      .map(
        (m) =>
          `<option value="${m.id}" ${editingMetodoId === m.id ? "selected" : ""}>${escapeHtml(m.nombre)} — ${escapeHtml(labelMetodoTipo(m.tipo))}</option>`,
      )
      .join("");
  }

  function renderTable(): string {
    if (loading) return `<p class="px-4 py-8 text-center text-sm text-text-muted">Cargando cualificaciones…</p>`;
    if (error) return `<p class="mx-4 my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(error)}</p>`;
    if (items.length === 0) return `<p class="px-4 py-8 text-center text-sm text-text-muted">No hay cualificaciones registradas.</p>`;
    const rows = items
      .map(
        (t) => `
      <tr class="border-b border-slate-100/90">
        <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(t.nombre)}</td>
        <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(t.metodo_nombre || "—")}</td>
        <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(t.descripcion ?? "—")}</td>
        <td class="px-3 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-tipo-cual-action="edit" data-id="${t.id}" class="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Editar">${ICON_EDIT}</button>
            <button type="button" data-tipo-cual-action="delete" data-id="${t.id}" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Eliminar">${ICON_TRASH}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return `<div class="overflow-x-auto"><table class="min-w-full text-left"><thead><tr class="border-b border-slate-100">
      <th class="px-4 py-3 text-xs font-semibold uppercase text-text-muted">Nombre</th>
      <th class="px-4 py-3 text-xs font-semibold uppercase text-text-muted">Método de calificación</th>
      <th class="px-4 py-3 text-xs font-semibold uppercase text-text-muted">Descripción</th>
      <th class="px-3 py-3 text-right text-xs font-semibold uppercase text-text-muted"><span class="sr-only">Acciones</span></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `<div id="tipo-cual-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">Eliminar cualificación</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>?</p>
          ${modalError ? `<p class="mt-3 text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" data-tipo-cual-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-tipo-cual-modal="confirm-delete" class="${BTN_DANGER}">${modalSaving ? "Eliminando…" : "Eliminar"}</button>
          </div>
        </div></div>`;
    }
    return `<div id="tipo-cual-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold">${modalMode === "create" ? "Nueva cualificación" : "Editar cualificación"}</h3>
        <form id="tipo-cual-form" class="mt-4 space-y-4">
          <div><label class="${RH_LISTADO_LABEL}">Nombre *</label>
            <input name="nombre" required minlength="2" value="${escapeHtml(editingNombre)}" class="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" /></div>
          <div><label class="${RH_LISTADO_LABEL}">Método de calificación *</label>
            <select name="metodo_calificacion_id" required class="mt-1 block w-full ${RH_LISTADO_SELECT} ${SELECT_CHEVRON} ${FIELD_FOCUS}">
              <option value="">Seleccionar…</option>${metodoOptsHtml()}
            </select></div>
          <div><label class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea name="descripcion" rows="2" class="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm ${FIELD_FOCUS}">${escapeHtml(editingDescripcion)}</textarea></div>
          ${modalError ? `<p class="text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
          <div class="flex justify-end gap-2">
            <button type="button" data-tipo-cual-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">${modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div></div>`;
  }

  function paint(): void {
    sectionEl.innerHTML = `<section class="${RH_LISTADO_SURFACE}">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div><h2 class="text-base font-semibold">Tipos de cualificación</h2><p class="text-sm text-text-muted">Cualificaciones reutilizables en perfiles de puesto.</p></div>
        <button type="button" data-tipo-cual-action="create" class="${RH_LISTADO_BTN_PRIMARY}">${ICON_PLUS}<span>Nueva cualificación</span></button>
      </div>${renderTable()}${renderModal()}</section>`;
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      [items, metodos] = await Promise.all([getTiposCualificacion(), getMetodosCalificacion()]);
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as CatalogoFetchError).detail ?? "Error al cargar.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    editingNombre = "";
    editingDescripcion = "";
    editingMetodoId = null;
    deletingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-tipo-cual-action]") as HTMLElement | null;
      if (btn) {
        const action = btn.dataset.tipoCualAction;
        const id = Number(btn.dataset.id);
        if (action === "create") {
          modalMode = "create";
          editingNombre = "";
          editingDescripcion = "";
          editingMetodoId = metodos[0]?.id ?? null;
          modalError = "";
          paint();
        } else if (action === "edit") {
          const item = items.find((i) => i.id === id);
          if (!item) return;
          modalMode = "edit";
          editingId = id;
          editingNombre = item.nombre;
          editingDescripcion = item.descripcion ?? "";
          editingMetodoId = item.metodo_calificacion_id;
          modalError = "";
          paint();
        } else if (action === "delete") {
          deletingItem = items.find((i) => i.id === id) ?? null;
          if (!deletingItem) return;
          modalMode = "delete";
          modalError = "";
          paint();
        }
        return;
      }
      const modalBtn = t.closest("[data-tipo-cual-modal]") as HTMLElement | null;
      if (modalBtn?.dataset.tipoCualModal === "cancel") closeModal();
      if (modalBtn?.dataset.tipoCualModal === "confirm-delete") void confirmDelete();
    },
    { signal },
  );

  sectionEl.addEventListener(
    "submit",
    (ev) => {
      if (!(ev.target as HTMLElement).closest("#tipo-cual-form")) return;
      ev.preventDefault();
      void submitForm(ev.target as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const descripcion = String(fd.get("descripcion") ?? "").trim() || undefined;
    const metodoId = Number(fd.get("metodo_calificacion_id"));
    if (!metodoId) {
      modalError = "Selecciona un método de calificación.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      if (modalMode === "create") {
        await createTipoCualificacion({ nombre, descripcion, metodo_calificacion_id: metodoId });
      } else if (modalMode === "edit" && editingId != null) {
        await updateTipoCualificacion(editingId, { nombre, descripcion, metodo_calificacion_id: metodoId });
      }
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteTipoCualificacion(deletingItem.id);
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
