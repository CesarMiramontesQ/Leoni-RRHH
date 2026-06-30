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
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_ICON_PLUS,
  AJUSTES_ICON_TRASH,
  AJUSTES_INPUT,
  AJUSTES_MODAL_OVERLAY,
  AJUSTES_MODAL_PANEL,
  AJUSTES_ROW_BTN_DELETE,
  AJUSTES_ROW_BTN_EDIT,
  AJUSTES_TABLE_TD,
  AJUSTES_TABLE_TD_ACTIONS,
  AJUSTES_TABLE_TD_MUTED,
  AJUSTES_TABLE_TH,
  AJUSTES_TEXTAREA,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
  AJUSTES_METODOS_CALIFICACION_CHANGED,
} from "./ajustesSectionUi.ts";

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
    if (loading) return ajustesLoadingState("Cargando cualificaciones…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay cualificaciones registradas. Crea la primera.", `<button type="button" data-tipo-cual-action="create" class="${RH_LISTADO_BTN_PRIMARY}">${AJUSTES_ICON_PLUS}<span>Nueva cualificación</span></button>`);
    const rows = items
      .map(
        (t) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(t.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(t.metodo_nombre || "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(t.descripcion ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-tipo-cual-action="edit" data-id="${t.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-tipo-cual-action="delete" data-id="${t.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return ajustesTableWrap(`
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="${AJUSTES_TABLE_TH}">Nombre</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Método de calificación</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Descripción</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderMetodoSelect(): string {
    return `
      <div class="grid grid-cols-1">
        <select id="tipo-cual-metodo" name="metodo_calificacion_id" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
          <option value="">Seleccionar…</option>
          ${metodoOptsHtml()}
        </select>
        ${SELECT_CHEVRON}
      </div>`;
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div id="tipo-cual-modal" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="tipo-cual-delete-title">
            <h3 id="tipo-cual-delete-title" class="text-lg font-semibold text-text-primary">Eliminar cualificación</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>?</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-cual-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-tipo-cual-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nueva cualificación" : "Editar cualificación";
    return `
      <div id="tipo-cual-modal" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="tipo-cual-form-title">
          <h3 id="tipo-cual-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="tipo-cual-form" class="mt-4 space-y-4">
            <div>
              <label for="tipo-cual-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="tipo-cual-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="tipo-cual-metodo" class="${RH_LISTADO_LABEL}">Método de calificación <span class="text-red-600">*</span></label>
              ${renderMetodoSelect()}
            </div>
            <div>
              <label for="tipo-cual-descripcion" class="${RH_LISTADO_LABEL}">Descripción</label>
              <textarea id="tipo-cual-descripcion" name="descripcion" rows="2" class="${AJUSTES_TEXTAREA}">${escapeHtml(editingDescripcion)}</textarea>
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-cual-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "tipos-cual-section-title",
        title: "Tipos de cualificación",
        description: "Cualificaciones reutilizables en perfiles de puesto.",
        actionButtonHtml: `<button type="button" data-tipo-cual-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nueva cualificación</span></button>`,
        bodyHtml: renderTable(),
      }) + renderModal();
  }

  async function loadMetodos(): Promise<void> {
    metodos = await getMetodosCalificacion();
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

  async function openCreateModal(): Promise<void> {
    modalMode = "create";
    editingNombre = "";
    editingDescripcion = "";
    modalError = "";
    paint();
    try {
      await loadMetodos();
      editingMetodoId = metodos[0]?.id ?? null;
    } catch (e) {
      modalError = (e as CatalogoFetchError).detail ?? "Error al cargar métodos de calificación.";
      editingMetodoId = null;
    }
    paint();
  }

  async function openEditModal(item: TipoCualificacion): Promise<void> {
    modalMode = "edit";
    editingId = item.id;
    editingNombre = item.nombre;
    editingDescripcion = item.descripcion ?? "";
    editingMetodoId = item.metodo_calificacion_id;
    modalError = "";
    paint();
    try {
      await loadMetodos();
    } catch (e) {
      modalError = (e as CatalogoFetchError).detail ?? "Error al cargar métodos de calificación.";
    }
    paint();
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
          void openCreateModal();
        } else if (action === "edit") {
          const item = items.find((i) => i.id === id);
          if (!item) return;
          void openEditModal(item);
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

  document.addEventListener(
    AJUSTES_METODOS_CALIFICACION_CHANGED,
    () => {
      void loadMetodos().then(() => {
        if (modalMode === "create" || modalMode === "edit") paint();
      });
    },
    { signal },
  );

  void load();
}
