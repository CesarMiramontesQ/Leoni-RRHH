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
    if (loading) {
      return `<p class="px-4 py-8 text-center text-sm text-text-muted">Cargando tipos…</p>`;
    }
    if (error) {
      return `<p class="mx-4 my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">${escapeHtml(error)}</p>`;
    }
    if (items.length === 0) {
      return `<p class="px-4 py-8 text-center text-sm text-text-muted">No hay tipos registrados. Crea el primero.</p>`;
    }
    const rows = items
      .map(
        (t) => `
      <tr class="border-b border-slate-100/90">
        <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(t.nombre)}</td>
        <td class="px-4 py-3">${grupoBadge(t)}</td>
        <td class="px-3 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-tipo-action="edit" data-id="${t.id}" class="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-text-primary" title="Editar">${ICON_EDIT}</button>
            <button type="button" data-tipo-action="delete" data-id="${t.id}" class="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Eliminar">${ICON_TRASH}</button>
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
              <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Grupo</th>
              <th scope="col" class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderGrupoSelect(selectedId: number | null): string {
    if (grupos.length === 0) {
      return `<p class="text-sm text-amber-800">No hay grupos disponibles. Crea al menos uno en la sección anterior.</p>`;
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
        <div id="tipo-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <h3 class="text-lg font-semibold text-text-primary">Eliminar tipo</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay competencias que lo usen.</p>
            ${modalError ? `<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-tipo-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo tipo" : "Editar tipo";
    return `
      <div id="tipo-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="tipo-form" class="mt-4 space-y-4">
            <div>
              <label for="tipo-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="tipo-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                value="${escapeHtml(editingNombre)}"
                class="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
            </div>
            <div>
              <label for="tipo-grupo" class="${RH_LISTADO_LABEL}">Grupo <span class="text-red-600">*</span></label>
              ${renderGrupoSelect(editingGrupoId)}
              <p class="mt-1.5 text-xs text-text-muted">El grupo define si las competencias son técnicas o habilidades blandas.</p>
            </div>
            ${modalError ? `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(modalError)}</p>` : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-tipo-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""} ${grupos.length === 0 ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML = `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="tipos-section-title">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="tipos-section-title" class="text-base font-semibold text-text-primary">Tipos de competencia</h2>
            <p class="mt-0.5 text-sm text-text-muted">Catálogo de tipos para clasificar competencias al crearlas.</p>
          </div>
          <button type="button" data-tipo-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0" ${grupos.length === 0 ? "disabled title=\"Crea un grupo primero\"" : ""}>${ICON_PLUS}<span>Nuevo tipo</span></button>
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

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest("[data-tipo-action]") as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest("[data-tipo-modal]") as HTMLElement | null;
        if (modalBtn?.dataset.tipoModal === "cancel") closeModal();
        if (modalBtn?.dataset.tipoModal === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset.tipoAction;
      const id = Number(btn.dataset.id);
      if (action === "create") {
        if (grupos.length === 0) return;
        modalMode = "create";
        editingNombre = "";
        editingGrupoId = grupos[0]?.id ?? null;
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#tipo-nombre")?.focus();
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

  sectionEl.addEventListener(
    "submit",
    (ev) => {
      const form = (ev.target as HTMLElement).closest("#tipo-form");
      if (!form) return;
      ev.preventDefault();
      void submitForm(form as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const grupoCompetenciaId = Number(fd.get("grupo_competencia_id"));
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
