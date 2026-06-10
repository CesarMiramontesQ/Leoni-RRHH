import {
  createGradoPuesto,
  deleteGradoPuesto,
  getGradosPuesto,
  updateGradoPuesto,
} from "../../../api/gradosPuesto.ts";
import type { GradoPuesto, GradoPuestoFetchError } from "../../../dashboard/gradosPuesto/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import { BTN_DANGER, BTN_SECONDARY, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_LABEL } from "../../../ui/uiTokens.ts";
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
  AJUSTES_TABLE_TH,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
} from "./ajustesSectionUi.ts";

type ModalMode = "create" | "edit" | "delete" | null;

export function mountGradosSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: GradoPuesto[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let editingOrden = 1;
  let deletingItem: GradoPuesto | null = null;
  let modalError = "";

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando grados…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay grados registrados. Crea el primero.");
    const rows = items
      .map(
        (g) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(g.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD} tabular-nums text-text-secondary">${g.orden}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-grado-action="edit" data-id="${g.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-grado-action="delete" data-id="${g.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
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
              <th scope="col" class="${AJUSTES_TABLE_TH}">Orden</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div id="grado-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grado-modal-delete-title">
            <h3 id="grado-modal-delete-title" class="text-lg font-semibold text-text-primary">Eliminar grado</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay requisitos o asignaciones que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grado-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-grado-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo grado" : "Editar grado";
    return `
      <div id="grado-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grado-modal-form-title">
          <h3 id="grado-modal-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="grado-form" class="mt-4 space-y-4">
            <div>
              <label for="grado-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="grado-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="grado-orden" class="${RH_LISTADO_LABEL}">Orden <span class="text-red-600">*</span></label>
              <input id="grado-orden" name="orden" type="number" required min="1" max="99"
                value="${editingOrden}"
                class="${AJUSTES_INPUT}" />
              <p class="mt-1 text-xs text-text-muted">Jerarquía de progresión (1 = nivel inicial).</p>
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grado-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "grados-section-title",
        title: "Grados",
        description: "Progresión dentro del puesto (Grado 1, 2, 3…). Distinto del nivel organizacional.",
        actionButtonHtml: `<button type="button" data-grado-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo grado</span></button>`,
        bodyHtml: renderTable(),
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getGradosPuesto({ page_size: 200 });
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as GradoPuestoFetchError).detail ?? "No se pudieron cargar los grados.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    editingNombre = "";
    editingOrden = 1;
    deletingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-grado-action]") as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest("[data-grado-modal]") as HTMLElement | null;
        if (modalBtn?.dataset.gradoModal === "cancel") closeModal();
        if (modalBtn?.dataset.gradoModal === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset.gradoAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        modalMode = "create";
        editingNombre = "";
        editingOrden = (items.length > 0 ? Math.max(...items.map((g) => g.orden)) : 0) + 1;
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#grado-nombre")?.focus();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((g) => g.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        editingNombre = item.nombre;
        editingOrden = item.orden;
        modalError = "";
        paint();
      } else if (action === "delete" && !Number.isNaN(id)) {
        deletingItem = items.find((g) => g.id === id) ?? null;
        if (!deletingItem) return;
        modalMode = "delete";
        modalError = "";
        paint();
      }
    },
    { signal },
  );

  sectionEl.addEventListener(
    "submit",
    (ev) => {
      const form = (ev.target as HTMLElement).closest("#grado-form");
      if (!form) return;
      ev.preventDefault();
      void submitForm(form as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const orden = Number(fd.get("orden"));
    if (nombre.length < 2) {
      modalError = "El nombre debe tener al menos 2 caracteres.";
      paint();
      return;
    }
    if (!Number.isFinite(orden) || orden < 1) {
      modalError = "El orden debe ser un número mayor o igual a 1.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      if (modalMode === "create") {
        await createGradoPuesto({ nombre, orden });
      } else if (modalMode === "edit" && editingId != null) {
        await updateGradoPuesto(editingId, { nombre, orden });
      }
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GradoPuestoFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteGradoPuesto(deletingItem.id);
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GradoPuestoFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
