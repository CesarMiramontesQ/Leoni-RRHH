import {
  createMetodoCalificacionCompetencia,
  deleteMetodoCalificacionCompetencia,
  getMetodosCalificacionCompetencia,
  updateMetodoCalificacionCompetencia,
} from "../../../api/metodosCalificacionCompetencia.ts";
import type {
  MetodoCalificacionCompetencia,
  MetodoCalificacionCompetenciaFetchError,
} from "../../../dashboard/metodosCalificacionCompetencia/types.ts";
import {
  invalidateMetodosCalificacionCompetenciaCache,
  setMetodosCalificacionCompetenciaCache,
} from "../../../ui/metodosCalificacionCompetencia.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import { BTN_DANGER, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_BTN_SECONDARY, RH_LISTADO_LABEL } from "../../../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_ICON_PLUS,
  AJUSTES_ICON_SCALE,
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
  ajustesCountBadge,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
} from "./ajustesSectionUi.ts";

type ModalMode = "create" | "edit" | "delete" | null;

export function mountMetodosCalificacionCompetenciaSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  let items: MetodoCalificacionCompetencia[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingNombre = "";
  let editingOrden = 1;
  let deletingItem: MetodoCalificacionCompetencia | null = null;
  let modalError = "";

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando niveles…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) {
      return ajustesEmptyState("No hay niveles configurados. Crea el primero.", `<button type="button" data-mcc-action="create" class="${RH_LISTADO_BTN_PRIMARY}">${AJUSTES_ICON_PLUS}<span>Nuevo nivel</span></button>`);
    }
    const rows = items
      .map(
        (m) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD_MUTED} tabular-nums">${m.valor}</td>
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(m.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED} tabular-nums">${m.orden}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-mcc-action="edit" data-id="${m.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-mcc-action="delete" data-id="${m.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Desactivar">${AJUSTES_ICON_TRASH}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return ajustesTableWrap(`
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="${AJUSTES_TABLE_TH}">Valor</th>
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
        <div id="mcc-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="mcc-modal-delete-title">
            <h3 id="mcc-modal-delete-title" class="text-lg font-semibold text-text-primary">Desactivar nivel</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Desactivar <strong>${escapeHtml(deletingItem.nombre)}</strong> (valor ${deletingItem.valor})? No podrás desactivarlo si hay requisitos de competencia que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-mcc-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-mcc-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Desactivando…" : "Desactivar"}</button>
            </div>
          </div>
        </div>`;
    }
    const editingItem = editingId != null ? items.find((m) => m.id === editingId) : null;
    const title = modalMode === "create" ? "Nuevo nivel de competencia" : "Editar nivel de competencia";
    return `
      <div id="mcc-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="mcc-modal-title">
          <h3 id="mcc-modal-title" class="text-base font-semibold text-text-primary">${title}</h3>
          ${editingItem ? `<p class="mt-1 text-sm text-text-muted">Valor interno <strong>${editingItem.valor}</strong> (no editable).</p>` : `<p class="mt-1 text-sm text-text-muted">Se asignará un valor numérico automáticamente.</p>`}
          <form id="mcc-form" class="mt-4 flex flex-col gap-4">
            <div>
              <label for="mcc-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="mcc-nombre" name="nombre" type="text" required maxlength="100" value="${escapeHtml(editingNombre)}" class="${AJUSTES_INPUT} mt-1.5" />
            </div>
            <div>
              <label for="mcc-orden" class="${RH_LISTADO_LABEL}">Orden de visualización <span class="text-red-600">*</span></label>
              <input id="mcc-orden" name="orden" type="number" required min="1" max="99" value="${editingOrden}" class="${AJUSTES_INPUT} mt-1.5" />
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" data-mcc-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "mcc-section-title",
        title: "Escala de dominio",
        description:
          "Niveles de dominio para competencias (matriz, perfiles y evaluaciones).",
        iconHtml: AJUSTES_ICON_SCALE,
        badgeHtml: loading ? ajustesCountBadge(0, true) : ajustesCountBadge(items.length),
        actionButtonHtml: `<button type="button" data-mcc-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo nivel</span></button>`,
        bodyHtml: renderTable(),
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getMetodosCalificacionCompetencia();
      setMetodosCalificacionCompetenciaCache(items);
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error =
        (e as MetodoCalificacionCompetenciaFetchError).detail ??
        "No se pudieron cargar los niveles de competencia.";
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
      const btn = t.closest("[data-mcc-action]") as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest("[data-mcc-modal]") as HTMLElement | null;
        if (modalBtn?.dataset.mccModal === "cancel" || t.id === "mcc-modal-overlay") {
          closeModal();
        }
        if (modalBtn?.dataset.mccModal === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset.mccAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        modalMode = "create";
        editingNombre = "";
        editingOrden = (items.length > 0 ? Math.max(...items.map((m) => m.orden)) : 0) + 1;
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#mcc-nombre")?.focus();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((m) => m.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        editingNombre = item.nombre;
        editingOrden = item.orden;
        modalError = "";
        paint();
      } else if (action === "delete" && !Number.isNaN(id)) {
        deletingItem = items.find((m) => m.id === id) ?? null;
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
    async (ev) => {
      const form = (ev.target as HTMLElement).closest("#mcc-form");
      if (!form) return;
      ev.preventDefault();
      const fd = new FormData(form as HTMLFormElement);
      const nombre = String(fd.get("nombre") ?? "").trim();
      const orden = Number(fd.get("orden"));
      if (!nombre || !Number.isFinite(orden) || orden < 1) {
        modalError = "Nombre y orden (≥ 1) son obligatorios.";
        paint();
        return;
      }
      modalSaving = true;
      modalError = "";
      paint();
      try {
        if (modalMode === "create") {
          await createMetodoCalificacionCompetencia({ nombre, orden });
        } else if (modalMode === "edit" && editingId != null) {
          await updateMetodoCalificacionCompetencia(editingId, { nombre, orden });
        }
        invalidateMetodosCalificacionCompetenciaCache();
        closeModal();
        await load();
      } catch (e) {
        modalSaving = false;
        modalError =
          (e as MetodoCalificacionCompetenciaFetchError).detail ?? "No se pudo guardar el nivel.";
        paint();
      }
    },
    { signal },
  );

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteMetodoCalificacionCompetencia(deletingItem.id);
      invalidateMetodosCalificacionCompetenciaCache();
      closeModal();
      await load();
    } catch (e) {
      modalSaving = false;
      modalError =
        (e as MetodoCalificacionCompetenciaFetchError).detail ?? "No se pudo desactivar.";
      paint();
    }
  }

  void load();
}
