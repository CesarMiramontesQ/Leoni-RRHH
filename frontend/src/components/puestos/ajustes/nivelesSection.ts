import {
  createNivelPuesto,
  deleteNivelPuesto,
  getNivelesPuesto,
  updateNivelPuesto,
} from "../../../api/nivelesPuesto.ts";
import type { NivelPuesto, NivelPuestoFetchError } from "../../../dashboard/nivelesPuesto/types.ts";
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

export function mountNivelesSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: NivelPuesto[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let deletingItem: NivelPuesto | null = null;
  let modalError = "";

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando niveles…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay niveles registrados. Crea el primero.");
    const rows = items
      .map(
        (n) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(n.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-nivel-action="edit" data-id="${n.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-nivel-action="delete" data-id="${n.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
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
        <div id="nivel-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="nivel-modal-delete-title">
            <h3 id="nivel-modal-delete-title" class="text-lg font-semibold text-text-primary">Eliminar nivel</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay perfiles que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-nivel-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-nivel-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo nivel" : "Editar nivel";
    return `
      <div id="nivel-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="nivel-modal-form-title">
          <h3 id="nivel-modal-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="nivel-form" class="mt-4 space-y-4">
            <div>
              <label for="nivel-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="nivel-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="${AJUSTES_INPUT}" />
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-nivel-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "niveles-section-title",
        title: "Niveles en puestos",
        description: "Catálogo de niveles organizacionales para perfiles de puesto.",
        actionButtonHtml: `<button type="button" data-nivel-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo nivel</span></button>`,
        bodyHtml: renderTable(),
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getNivelesPuesto({ page_size: 200 });
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as NivelPuestoFetchError).detail ?? "No se pudieron cargar los niveles.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    editingNombre = "";
    deletingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-nivel-action]") as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest("[data-nivel-modal]") as HTMLElement | null;
        if (modalBtn?.dataset.nivelModal === "cancel") closeModal();
        if (modalBtn?.dataset.nivelModal === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset.nivelAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        modalMode = "create";
        editingNombre = "";
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#nivel-nombre")?.focus();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((n) => n.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        editingNombre = item.nombre;
        modalError = "";
        paint();
      } else if (action === "delete" && !Number.isNaN(id)) {
        deletingItem = items.find((n) => n.id === id) ?? null;
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
      const form = (ev.target as HTMLElement).closest("#nivel-form");
      if (!form) return;
      ev.preventDefault();
      void submitForm(form as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const nombre = String(new FormData(form).get("nombre") ?? "").trim();
    if (nombre.length < 2) {
      modalError = "El nombre debe tener al menos 2 caracteres.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      if (modalMode === "create") {
        await createNivelPuesto({ nombre });
      } else if (modalMode === "edit" && editingId != null) {
        await updateNivelPuesto(editingId, { nombre });
      }
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as NivelPuestoFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteNivelPuesto(deletingItem.id);
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as NivelPuestoFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
