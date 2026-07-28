import { getCareerPaths } from "../../../api/clasificacionPuesto.ts";
import { notifyAjustesClasificacionChanged } from "./clasificacionSections.ts";
import {
  createGradoPuesto,
  deleteGradoPuesto,
  getGradosPuesto,
  updateGradoPuesto,
} from "../../../api/gradosPuesto.ts";
import type { CareerPath } from "../../../dashboard/clasificacionPuesto/types.ts";
import type { GradoPuesto, GradoPuestoFetchError } from "../../../dashboard/gradosPuesto/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_DANGER,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_ICON_PLUS,
  AJUSTES_ICON_TRASH,
  AJUSTES_ICON_GRADES,
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
} from "./ajustesSectionUi.ts";

type ModalMode = "create" | "edit" | "delete" | null;

export function mountGradosSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: GradoPuesto[] = [];
  let careerPaths: CareerPath[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingCareerPathId: number | null = null;
  let editingCodigo = "";
  let editingNombre = "";
  let deletingItem: GradoPuesto | null = null;
  let modalError = "";
  let filtro = "";

  function careerPathLabel(g: GradoPuesto): string {
    return g.career_path_nombre ?? g.career_path_codigo ?? "—";
  }

  /** Etiqueta de la posición: el global grade, o un aviso si falta la equivalencia. */
  function posicionLabel(g: GradoPuesto): string {
    return g.global_grade_codigo ?? "Sin equivalencia";
  }

  /** Mismo umbral y comportamiento que el buscador de `catalogoSection`. */
  const FILAS_PARA_BUSCADOR = 8;

  function itemsVisibles(): GradoPuesto[] {
    const q = filtro.trim().toLowerCase();
    if (!q) return items;
    return items.filter((g) =>
      [g.codigo, g.nombre, careerPathLabel(g)].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }

  function renderBuscador(): string {
    if (items.length < FILAS_PARA_BUSCADOR) return "";
    return `<div class="border-b border-slate-100 px-4 py-2.5 sm:px-5">
      <label for="grado-filtro" class="sr-only">Buscar career level</label>
      <input id="grado-filtro" type="search" data-grado-filtro value="${escapeHtml(filtro)}"
        autocomplete="off" placeholder="Buscar entre ${items.length}…"
        class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted ${FIELD_FOCUS}" />
    </div>`;
  }

  function renderTable(): string {
    if (loading) return ajustesLoadingState("Cargando career levels…");
    if (error) return ajustesErrorAlert(error);
    if (careerPaths.length === 0) {
      return ajustesEmptyState(
        "Primero crea un career path: cada career level pertenece a uno (P10 es Professional, M3 es Management).",
      );
    }
    if (items.length === 0)
      return ajustesEmptyState(
        "No hay career levels registrados. Crea el primero.",
        `<button type="button" data-grado-action="create" class="${RH_LISTADO_BTN_PRIMARY}">${AJUSTES_ICON_PLUS}<span>Nuevo career level</span></button>`,
      );
    const visibles = itemsVisibles();
    if (visibles.length === 0) {
      return (
        renderBuscador() +
        ajustesEmptyState(`Ningún resultado para “${filtro.trim()}”.`)
      );
    }
    const rows = visibles
      .map(
        (g) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium tabular-nums">${escapeHtml(g.codigo)}</td>
        <td class="${AJUSTES_TABLE_TD} text-text-secondary">${escapeHtml(careerPathLabel(g))}</td>
        <td class="${AJUSTES_TABLE_TD}">${escapeHtml(g.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD} ${g.global_grade_codigo ? "tabular-nums text-text-secondary" : "text-amber-700"}">${escapeHtml(posicionLabel(g))}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-grado-action="edit" data-id="${g.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-grado-action="delete" data-id="${g.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return (
      renderBuscador() +
      ajustesTableWrap(`
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="${AJUSTES_TABLE_TH}">Código</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Career path</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Nombre</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Global grade</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`)
    );
  }

  function renderCareerPathOptions(): string {
    return careerPaths
      .map(
        (cp) =>
          `<option value="${cp.id}" ${cp.id === editingCareerPathId ? "selected" : ""}>${escapeHtml(cp.nombre)} (${escapeHtml(cp.codigo)})</option>`,
      )
      .join("");
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div id="grado-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grado-modal-delete-title">
            <h3 id="grado-modal-delete-title" class="text-lg font-semibold text-text-primary">Eliminar career level</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingItem.codigo)} · ${escapeHtml(deletingItem.nombre)}</strong>? No podrás eliminarlo si hay requisitos o asignaciones que lo usen.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grado-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-grado-modal="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = modalMode === "create" ? "Nuevo career level" : "Editar career level";
    return `
      <div id="grado-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="grado-modal-form-title">
          <h3 id="grado-modal-form-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <form id="grado-form" class="mt-4 space-y-4">
            <div>
              <label for="grado-career-path" class="${RH_LISTADO_LABEL}">Career path <span class="text-red-600">*</span></label>
              <div class="relative">
                <select id="grado-career-path" name="career_path_id" required class="${RH_LISTADO_SELECT}">
                  ${renderCareerPathOptions()}
                </select>
                ${SELECT_CHEVRON}
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="grado-codigo" class="${RH_LISTADO_LABEL}">Código <span class="text-red-600">*</span></label>
                <input id="grado-codigo" name="codigo" type="text" required minlength="1" maxlength="10"
                  value="${escapeHtml(editingCodigo)}"
                  class="${AJUSTES_INPUT}" />
                <p class="mt-1 text-xs text-text-muted">Etiqueta corta del nivel (P10, M3).</p>
              </div>
              <div>
                <label for="grado-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
                <input id="grado-nombre" name="nombre" type="text" required minlength="2" maxlength="100"
                  value="${escapeHtml(editingNombre)}"
                  class="${AJUSTES_INPUT}" />
              </div>
            </div>
            <p class="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-text-muted">
              La posición del nivel la define su <strong class="font-semibold text-text-secondary">global grade</strong>, que se configura en la tarjeta de equivalencias. Hasta entonces el nivel no se puede usar en el rango de un perfil.
            </p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-grado-modal="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    const sinCareerPaths = !loading && careerPaths.length === 0;
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "grados-section-title",
        title: "Career levels",
        description:
          "Niveles de la clasificación Towers Watson. Cada uno pertenece a un career path (P1…Pn, M1…Mn) y cada perfil se asocia a un rango consecutivo.",
        iconHtml: AJUSTES_ICON_GRADES,
        badgeHtml: loading ? ajustesCountBadge(0, true) : ajustesCountBadge(items.length),
        actionButtonHtml: sinCareerPaths
          ? ""
          : `<button type="button" data-grado-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo career level</span></button>`,
        bodyHtml: `<div data-grados-body>${renderTable()}</div>`,
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      const [grados, paths] = await Promise.all([
        getGradosPuesto({ page_size: 200 }),
        getCareerPaths(),
      ]);
      items = grados;
      careerPaths = paths;
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as GradoPuestoFetchError).detail ?? "No se pudieron cargar los career levels.";
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    editingCareerPathId = null;
    editingCodigo = "";
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
        if (careerPaths.length === 0) return;
        modalMode = "create";
        editingCareerPathId = careerPaths[0].id;
        editingCodigo = "";
        editingNombre = "";
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#grado-codigo")?.focus();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((g) => g.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        editingCareerPathId = item.career_path_id;
        editingCodigo = item.codigo;
        editingNombre = item.nombre;
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

  // Al cambiar de career path en el alta, el orden y el codigo sugeridos deben
  // recalcularse: ambos son unicos dentro del path, no globalmente.
  sectionEl.addEventListener(
    "change",
    (ev) => {
      const select = (ev.target as HTMLElement).closest(
        "#grado-career-path",
      ) as HTMLSelectElement | null;
      if (!select) return;
      const nuevoId = Number(select.value);
      if (Number.isNaN(nuevoId)) return;
      editingCareerPathId = nuevoId;
      const form = sectionEl.querySelector<HTMLFormElement>("#grado-form");
      editingNombre = String(new FormData(form!).get("nombre") ?? editingNombre);
      paint();
    },
    { signal },
  );

  sectionEl.addEventListener(
    "input",
    (ev) => {
      const input = (ev.target as HTMLElement).closest(
        "[data-grado-filtro]",
      ) as HTMLInputElement | null;
      if (!input) return;
      filtro = input.value;
      // Repintar todo recrearia el input y el foco saltaria al primer caracter.
      const cuerpo = sectionEl.querySelector<HTMLElement>("[data-grados-body]");
      if (!cuerpo) return;
      cuerpo.innerHTML = renderTable();
      const nuevo = sectionEl.querySelector<HTMLInputElement>("[data-grado-filtro]");
      nuevo?.focus();
      nuevo?.setSelectionRange(nuevo.value.length, nuevo.value.length);
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
    const careerPathId = Number(fd.get("career_path_id"));
    const codigo = String(fd.get("codigo") ?? "").trim();
    const nombre = String(fd.get("nombre") ?? "").trim();
    if (!Number.isFinite(careerPathId) || careerPathId <= 0) {
      modalError = "Selecciona un career path.";
      paint();
      return;
    }
    if (!codigo) {
      modalError = "El código es obligatorio (ej. P10).";
      paint();
      return;
    }
    if (nombre.length < 2) {
      modalError = "El nombre debe tener al menos 2 caracteres.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      const payload = { career_path_id: careerPathId, codigo, nombre };
      if (modalMode === "create") {
        await createGradoPuesto(payload);
      } else if (modalMode === "edit" && editingId != null) {
        await updateGradoPuesto(editingId, payload);
      }
      closeModal();
      await load();
      // La card de equivalencias depende de este catalogo.
      notifyAjustesClasificacionChanged();
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
      notifyAjustesClasificacionChanged();
    } catch (e) {
      modalSaving = false;
      modalError = (e as GradoPuestoFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  void load();
}
