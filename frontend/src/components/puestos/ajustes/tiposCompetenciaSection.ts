import { getGruposCompetencia } from "../../../api/gruposCompetencia.ts";
import {
  createTipoCompetencia,
  deleteTipoCompetencia,
  getTiposCompetencia,
  updateTipoCompetencia,
} from "../../../api/tiposCompetencia.ts";
import type { GrupoCompetencia } from "../../../dashboard/gruposCompetencia/types.ts";
import type { TipoCompetencia, TipoCompetenciaFetchError } from "../../../dashboard/tiposCompetencia/types.ts";
import {
  categoriaDesdeGrupoNombre,
  grupoCompetenciaBadgeClasses,
} from "../../../ui/competenciaCategoria.ts";
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
  AJUSTES_ICON_TYPE,
  AJUSTES_INPUT,
  AJUSTES_MODAL_OVERLAY,
  AJUSTES_MODAL_PANEL,
  AJUSTES_ROW_BTN_DELETE,
  AJUSTES_ROW_BTN_EDIT,
  AJUSTES_TABLE_TD,
  AJUSTES_TABLE_TD_ACTIONS,
  AJUSTES_TABLE_TH,
  ajustesCountBadge,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
  AJUSTES_GRUPOS_COMPETENCIA_CHANGED,
} from "./ajustesSectionUi.ts";
import { bindAjustesModalCleanup, syncAjustesModal } from "./ajustesModalHost.ts";

type ModalMode = "create" | "edit" | "delete" | null;

export function mountTiposCompetenciaSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: TipoCompetencia[] = [];
  let grupos: GrupoCompetencia[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let editingGrupoId: number | null = null;
  let deletingItem: TipoCompetencia | null = null;
  let modalError = "";

  function grupoBadge(t: TipoCompetencia): string {
    const label = t.grupo_nombre || "—";
    const cls = grupoCompetenciaBadgeClasses(categoriaDesdeGrupoNombre(label));
    return `<span class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(label)}</span>`;
  }

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando tipos…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay tipos registrados. Crea el primero.", `<button type="button" data-tipo-action="create" class="${RH_LISTADO_BTN_PRIMARY}">${AJUSTES_ICON_PLUS}<span>Nuevo tipo</span></button>`);
    const rows = items
      .map(
        (t) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(t.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD}">${grupoBadge(t)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-tipo-action="edit" data-id="${t.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-tipo-action="delete" data-id="${t.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
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
              <th scope="col" class="${AJUSTES_TABLE_TH}">Grupo</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderGrupoSelect(selectedId: number | null): string {
    if (grupos.length === 0) {
      return `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">No hay grupos disponibles. Crea al menos uno en la sección anterior.</p>`;
    }
    const opts = grupos
      .map(
        (g) =>
          `<option value="${g.id}" ${selectedId === g.id ? "selected" : ""}>${escapeHtml(g.nombre)}</option>`,
      )
      .join("");
    return `
      <div class="grid grid-cols-1">
        <select id="tipo-grupo" name="grupo_competencia_id" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">${opts}</select>
        ${SELECT_CHEVRON}
      </div>`;
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div id="tipo-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="tipo-modal-delete-title">
            <h3 id="tipo-modal-delete-title" class="text-lg font-semibold text-text-primary">Eliminar tipo</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay competencias que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-tipo-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo tipo" : "Editar tipo";
    return `
      <div id="tipo-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="tipo-modal-form-title">
          <h3 id="tipo-modal-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="tipo-form" class="mt-4 space-y-4">
            <div>
              <label for="tipo-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="tipo-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="tipo-grupo" class="${RH_LISTADO_LABEL}">Grupo <span class="text-red-600">*</span></label>
              ${renderGrupoSelect(editingGrupoId)}
              <p class="mt-1.5 text-xs text-text-muted">El grupo define si las competencias son técnicas o habilidades blandas.</p>
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""} ${grupos.length === 0 ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    const sinGrupos = grupos.length === 0;
    sectionEl.innerHTML = ajustesSectionCard({
      titleId: "tipos-section-title",
      title: "Tipos de competencia",
      description: "Clasifican las competencias al crearlas dentro de un grupo.",
      iconHtml: AJUSTES_ICON_TYPE,
      badgeHtml: loading ? ajustesCountBadge(0, true) : ajustesCountBadge(items.length),
      actionButtonHtml: `<button type="button" data-tipo-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0" ${sinGrupos ? "title=\"Crea un grupo primero o actualiza la lista\"" : ""}>${AJUSTES_ICON_PLUS}<span>Nuevo tipo</span></button>`,
      bodyHtml: renderTable(),
    });
    syncAjustesModal("tipos-competencia", Boolean(modalMode), renderModal(), {
      onInteract: handleModalInteract,
      onEscape: closeModal,
    });
  }

  async function refreshGrupos(): Promise<void> {
    try {
      grupos = await getGruposCompetencia({ page_size: 200 });
      if (modalMode === "create" && editingGrupoId == null) {
        editingGrupoId = grupos[0]?.id ?? null;
      }
      paint();
    } catch {
      /* mantener lista previa */
    }
  }

  async function openCreateModal(): Promise<void> {
    await refreshGrupos();
    modalMode = "create";
    editingNombre = "";
    editingGrupoId = grupos[0]?.id ?? null;
    modalError =
      grupos.length === 0
        ? "Crea al menos un grupo de competencia en la sección de la izquierda."
        : "";
    paint();
    if (grupos.length > 0) {
      requestAnimationFrame(() => document.getElementById("tipo-nombre")?.focus());
    }
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      const [tipos, gruposList] = await Promise.all([
        getTiposCompetencia({ page_size: 200 }),
        getGruposCompetencia({ page_size: 200 }),
      ]);
      items = tipos;
      grupos = gruposList;
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as TipoCompetenciaFetchError).detail ?? "No se pudieron cargar los tipos.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    editingNombre = "";
    editingGrupoId = grupos[0]?.id ?? null;
    deletingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  function handleModalInteract(ev: Event): void {
    if (ev.type === "submit") {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "tipo-form") return;
      ev.preventDefault();
      void submitForm(form);
      return;
    }

    const t = ev.target as HTMLElement;
    if (t.id === "tipo-modal-overlay" && t === ev.target) {
      closeModal();
      return;
    }
    const modalBtn = t.closest("[data-tipo-modal]") as HTMLElement | null;
    if (modalBtn?.dataset.tipoModal === "cancel") {
      closeModal();
      return;
    }
    if (modalBtn?.dataset.tipoModal === "confirm-delete") {
      void confirmDelete();
    }
  }

  bindAjustesModalCleanup("tipos-competencia", signal);

  document.addEventListener(AJUSTES_GRUPOS_COMPETENCIA_CHANGED, () => void refreshGrupos(), { signal });

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-tipo-action]") as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.tipoAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        void openCreateModal();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((n) => n.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        editingNombre = item.nombre;
        editingGrupoId = item.grupo_competencia_id;
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
    const grupoCompetenciaId = Number(fd.get("grupo_competencia_id"));
    editingNombre = String(fd.get("nombre") ?? "");
    if (Number.isFinite(grupoCompetenciaId) && grupoCompetenciaId > 0) {
      editingGrupoId = grupoCompetenciaId;
    }
    if (nombre.length < 2) {
      modalError = "El nombre debe tener al menos 2 caracteres.";
      paint();
      return;
    }
    if (!Number.isFinite(grupoCompetenciaId) || grupoCompetenciaId <= 0) {
      modalError = "Selecciona un grupo válido.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      const payload = { nombre, grupo_competencia_id: grupoCompetenciaId };
      if (modalMode === "create") {
        await createTipoCompetencia(payload);
      } else if (modalMode === "edit" && editingId != null) {
        await updateTipoCompetencia(editingId, payload);
      }
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as TipoCompetenciaFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteTipoCompetencia(deletingItem.id);
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as TipoCompetenciaFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
