import {
  createGrupoCompetencia,
  deleteGrupoCompetencia,
  getGruposCompetencia,
  updateGrupoCompetencia,
} from "../../../api/gruposCompetencia.ts";
import type { GrupoCompetencia, GrupoCompetenciaFetchError } from "../../../dashboard/gruposCompetencia/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_DANGER,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SURFACE,
} from "../../../ui/uiTokens.ts";

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;

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
    if (loading) {
      return `<p class="px-4 py-8 text-center text-sm text-text-muted">Cargando grupos…</p>`;
    }
    if (error) {
      return `<p class="mx-4 my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">${escapeHtml(error)}</p>`;
    }
    if (items.length === 0) {
      return `<p class="px-4 py-8 text-center text-sm text-text-muted">No hay grupos registrados. Crea el primero.</p>`;
    }
    const rows = items
      .map(
        (g) => `
      <tr class="border-b border-slate-100/90">
        <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(g.nombre)}</td>
        <td class="px-3 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-grupo-action="edit" data-id="${g.id}" class="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-text-primary" title="Editar">${ICON_EDIT}</button>
            <button type="button" data-grupo-action="delete" data-id="${g.id}" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Eliminar">${ICON_TRASH}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre</th>
              <th scope="col" class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div id="grupo-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <h3 class="text-lg font-semibold text-text-primary">Eliminar grupo</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay tipos de competencia que lo usen.</p>
            ${modalError ? `<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grupo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-grupo-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo grupo" : "Editar grupo";
    return `
      <div id="grupo-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="grupo-form" class="mt-4 space-y-4">
            <div>
              <label for="grupo-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="grupo-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
            </div>
            ${modalError ? `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grupo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML = `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="grupos-section-title">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="grupos-section-title" class="text-base font-semibold text-text-primary">Grupos de competencia</h2>
            <p class="mt-0.5 text-sm text-text-muted">Catálogo de grupos para organizar tipos de competencia.</p>
          </div>
          <button type="button" data-grupo-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${ICON_PLUS}<span>Nuevo grupo</span></button>
        </div>
        ${renderTable()}
      </section>
      ${renderModal()}`;
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

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-grupo-action]") as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest("[data-grupo-modal]") as HTMLElement | null;
        if (modalBtn?.dataset.grupoModal === "cancel") closeModal();
        if (modalBtn?.dataset.grupoModal === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset.grupoAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        modalMode = "create";
        editingNombre = "";
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#grupo-nombre")?.focus();
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
      const form = (ev.target as HTMLElement).closest("#grupo-form");
      if (!form) return;
      ev.preventDefault();
      void submitForm(form as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
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
      await load();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GrupoCompetenciaFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
