import {
  getMetodosCalificacionCompetencia,
  updateMetodoCalificacionCompetencia,
} from "../../../api/metodosCalificacionCompetencia.ts";
import type {
  MetodoCalificacionCompetencia,
  MetodoCalificacionCompetenciaFetchError,
} from "../../../dashboard/metodosCalificacionCompetencia/types.ts";
import { invalidateMetodosCalificacionCompetenciaCache } from "../../../ui/metodosCalificacionCompetencia.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import { RH_LISTADO_BTN_PRIMARY, RH_LISTADO_LABEL, BTN_SECONDARY } from "../../../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_INPUT,
  AJUSTES_MODAL_OVERLAY,
  AJUSTES_MODAL_PANEL,
  AJUSTES_ROW_BTN_EDIT,
  AJUSTES_TABLE_TD,
  AJUSTES_TABLE_TD_ACTIONS,
  AJUSTES_TABLE_TD_MUTED,
  AJUSTES_TABLE_TH,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
} from "./ajustesSectionUi.ts";

type ModalMode = "edit" | null;

export function mountMetodosCalificacionCompetenciaSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  let items: MetodoCalificacionCompetencia[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingItem: MetodoCalificacionCompetencia | null = null;
  let editingNombre = "";
  let editingOrden = 1;
  let modalError = "";

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando métodos…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) {
      return ajustesEmptyState("No hay métodos de calificación configurados.");
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
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return ajustesTableWrap(`
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="${AJUSTES_TABLE_TH}">Nivel</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Nombre</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Orden</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderModal(): string {
    if (modalMode !== "edit" || !editingItem) return "";
    return `
      <div id="mcc-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="mcc-modal-title">
          <h3 id="mcc-modal-title" class="text-base font-semibold text-text-primary">Editar método de calificación</h3>
          <p class="mt-1 text-sm text-text-muted">Nivel fijo <strong>${editingItem.valor}</strong>. Los cambios se reflejan en la matriz de multihabilidad.</p>
          <form id="mcc-form" class="mt-4 flex flex-col gap-4">
            <div>
              <label for="mcc-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="mcc-nombre" name="nombre" type="text" required maxlength="100" value="${escapeHtml(editingNombre)}" class="${AJUSTES_INPUT} mt-1.5" />
            </div>
            <div>
              <label for="mcc-orden" class="${RH_LISTADO_LABEL}">Orden de visualización <span class="text-red-600">*</span></label>
              <input id="mcc-orden" name="orden" type="number" required min="1" max="4" value="${editingOrden}" class="${AJUSTES_INPUT} mt-1.5" />
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" data-mcc-action="cancel" class="${BTN_SECONDARY}">Cancelar</button>
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
        title: "Métodos de calificación",
        description:
          "Niveles de dominio para competencias (Planeado a Experto). Se usan en la matriz de multihabilidad y evaluaciones.",
        actionButtonHtml: "",
        bodyHtml: renderTable(),
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getMetodosCalificacionCompetencia();
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error =
        (e as MetodoCalificacionCompetenciaFetchError).detail ??
        "No se pudieron cargar los métodos de calificación.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const editBtn = t.closest("[data-mcc-action='edit']") as HTMLElement | null;
      if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const item = items.find((m) => m.id === id);
        if (!item) return;
        editingItem = item;
        editingNombre = item.nombre;
        editingOrden = item.orden;
        modalMode = "edit";
        modalError = "";
        paint();
        return;
      }
      if (t.closest("[data-mcc-action='cancel']") || t.id === "mcc-modal-overlay") {
        closeModal();
      }
    },
    { signal },
  );

  sectionEl.addEventListener(
    "submit",
    async (ev) => {
      const form = (ev.target as HTMLElement).closest("#mcc-form");
      if (!form || !editingItem) return;
      ev.preventDefault();
      modalSaving = true;
      modalError = "";
      paint();
      const fd = new FormData(form as HTMLFormElement);
      const nombre = String(fd.get("nombre") ?? "").trim();
      const orden = Number(fd.get("orden"));
      if (!nombre || !Number.isFinite(orden) || orden < 1 || orden > 4) {
        modalSaving = false;
        modalError = "Nombre y orden (1–4) son obligatorios.";
        paint();
        return;
      }
      try {
        await updateMetodoCalificacionCompetencia(editingItem.id, { nombre, orden });
        invalidateMetodosCalificacionCompetenciaCache();
        closeModal();
        await load();
      } catch (e) {
        modalSaving = false;
        modalError =
          (e as MetodoCalificacionCompetenciaFetchError).detail ?? "No se pudo guardar el método.";
        paint();
      }
    },
    { signal },
  );

  void load();
}
