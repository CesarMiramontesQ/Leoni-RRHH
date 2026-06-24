import {
  createGrupoCompetencia,
  deleteGrupoCompetencia,
  getGruposCompetencia,
  updateGrupoCompetencia,
} from "../../../api/gruposCompetencia.ts";
import type { GrupoCompetencia, GrupoCompetenciaFetchError } from "../../../dashboard/gruposCompetencia/types.ts";
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
  notifyAjustesGruposCompetenciaChanged,
} from "./ajustesSectionUi.ts";
import { bindAjustesModalCleanup, syncAjustesModal } from "./ajustesModalHost.ts";

type ModalMode = "create" | "edit" | "delete" | null;

export function mountGruposCompetenciaSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: GrupoCompetencia[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let deletingItem: GrupoCompetencia | null = null;
  let modalError = "";

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando grupos…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay grupos registrados. Crea el primero.");
    const rows = items
      .map(
        (g) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(g.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-grupo-action="edit" data-id="${g.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-grupo-action="delete" data-id="${g.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
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
        <div id="grupo-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grupo-modal-delete-title">
            <h3 id="grupo-modal-delete-title" class="text-lg font-semibold text-text-primary">Eliminar grupo</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay tipos de competencia que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grupo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-grupo-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo grupo" : "Editar grupo";
    return `
      <div id="grupo-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grupo-modal-form-title">
          <h3 id="grupo-modal-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="grupo-form" class="mt-4 space-y-4">
            <div>
              <label for="grupo-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="grupo-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="${AJUSTES_INPUT}" />
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grupo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML = ajustesSectionCard({
      titleId: "grupos-section-title",
      title: "Grupos de competencia",
      description: "Catálogo de grupos para organizar tipos de competencia.",
      actionButtonHtml: `<button type="button" data-grupo-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo grupo</span></button>`,
      bodyHtml: renderTable(),
    });
    syncAjustesModal("grupos-competencia", Boolean(modalMode), renderModal(), {
      onInteract: handleModalInteract,
      onEscape: closeModal,
    });
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getGruposCompetencia({ page_size: 200 });
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as GrupoCompetenciaFetchError).detail ?? "No se pudieron cargar los grupos.";
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

  function handleModalInteract(ev: Event): void {
    if (ev.type === "submit") {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "grupo-form") return;
      ev.preventDefault();
      void submitForm(form);
      return;
    }

    const t = ev.target as HTMLElement;
    if (t.id === "grupo-modal-overlay" && t === ev.target) {
      closeModal();
      return;
    }
    const modalBtn = t.closest("[data-grupo-modal]") as HTMLElement | null;
    if (modalBtn?.dataset.grupoModal === "cancel") {
      closeModal();
      return;
    }
    if (modalBtn?.dataset.grupoModal === "confirm-delete") {
      void confirmDelete();
    }
  }

  bindAjustesModalCleanup("grupos-competencia", signal);

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-grupo-action]") as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.grupoAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        modalMode = "create";
        editingNombre = "";
        modalError = "";
        paint();
        document.getElementById("grupo-nombre")?.focus();
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

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    editingNombre = String(fd.get("nombre") ?? "");
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
        await createGrupoCompetencia({ nombre });
      } else if (modalMode === "edit" && editingId != null) {
        await updateGrupoCompetencia(editingId, { nombre });
      }
      closeModal();
      notifyAjustesGruposCompetenciaChanged();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GrupoCompetenciaFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteGrupoCompetencia(deletingItem.id);
      closeModal();
      notifyAjustesGruposCompetenciaChanged();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GrupoCompetenciaFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
