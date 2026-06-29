import {
  createMetodoCalificacion,
  createOpcionMetodo,
  deleteMetodoCalificacion,
  deleteOpcionMetodo,
  getMetodosCalificacion,
  getOpcionesMetodo,
  updateMetodoCalificacion,
} from "../../../api/cualificacionesCatalogo.ts";
import type { CatalogoFetchError } from "../../../api/cualificacionesCatalogo.ts";
import {
  COMPARADORES,
  COMPARADOR_DESCRIPCIONES,
  COMPARADOR_LABELS,
  labelComparador,
  labelMetodoTipo,
  METODO_TIPO_DESCRIPCIONES,
  METODO_TIPO_LABELS,
  METODO_TIPOS,
} from "../../../dashboard/cualificaciones/labels.ts";
import type { MetodoCalificacion, OpcionCalificacion } from "../../../dashboard/cualificaciones/types.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_DANGER,
  BTN_GHOST,
  FIELD_FOCUS,
  MODAL_OVERLAY_NESTED,
  RH_LISTADO_BTN_GHOST,
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
  AJUSTES_MODAL_PANEL_LG,
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
  notifyAjustesMetodosCalificacionChanged,
} from "./ajustesSectionUi.ts";

type MetodoModalMode = "create" | "edit" | null;
type OpcionModalMode = "create" | "delete" | null;

const OPCION_SUBMODAL_OVERLAY = MODAL_OVERLAY_NESTED;

export function mountMetodosCalificacionSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let items: MetodoCalificacion[] = [];
  let opciones: OpcionCalificacion[] = [];
  let loading = true;
  let error = "";
  let selectedMetodoId: number | null = null;
  let opcionesListModalOpen = false;
  let opcionesLoading = false;
  let opcionesError = "";
  let metodoModalMode: MetodoModalMode = null;
  let opcionModalMode: OpcionModalMode = null;
  let modalSaving = false;
  let modalError = "";
  let editingMetodo: MetodoCalificacion | null = null;
  let deletingMetodo: MetodoCalificacion | null = null;
  let deletingOpcion: OpcionCalificacion | null = null;
  let opcionEtiqueta = "";
  let opcionValor = "";
  let opcionPeso = "";

  function selectedMetodo(): MetodoCalificacion | null {
    if (selectedMetodoId == null) return null;
    return items.find((m) => m.id === selectedMetodoId) ?? null;
  }

  function renderMetodoTable(): string {
    if (loading) return ajustesLoadingState("Cargando métodos…");
    if (error) return ajustesErrorAlert(error);
    if (items.length === 0) return ajustesEmptyState("No hay métodos registrados. Crea el primero.", `<button type="button" data-metodo-create class="${RH_LISTADO_BTN_PRIMARY}">${AJUSTES_ICON_PLUS}<span>Nuevo método</span></button>`);
    const rows = items
      .map(
        (m) => `
      <tr class="border-b border-slate-100/90 transition-colors hover:bg-slate-50/50">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(m.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}" title="${escapeHtml(m.tipo)}">${escapeHtml(labelMetodoTipo(m.tipo))}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}" title="${escapeHtml(m.config?.comparador ?? "")}">${escapeHtml(labelComparador(m.config?.comparador))}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-metodo-select="${m.id}" class="${RH_LISTADO_BTN_GHOST} min-h-8 px-2.5 py-1 text-xs" title="Ver opciones">Opciones</button>
            <button type="button" data-metodo-edit="${m.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" data-metodo-delete="${m.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
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
              <th scope="col" class="${AJUSTES_TABLE_TH}">Tipo de evaluación</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Regla de cumplimiento</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderOpcionesTableBody(): string {
    if (opcionesLoading) {
      return `<p class="py-8 text-center text-sm text-text-muted">Cargando opciones…</p>`;
    }
    if (opcionesError) {
      return `<p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">${escapeHtml(opcionesError)}</p>`;
    }
    if (opciones.length === 0) {
      return `<p class="py-8 text-center text-sm text-text-muted">Sin opciones. Agrégalas si el método lo requiere.</p>`;
    }
    const rows = opciones
      .map(
        (o) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD}">${escapeHtml(o.etiqueta)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED} font-mono text-xs">${escapeHtml(o.valor)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED} tabular-nums">${o.orden}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED} tabular-nums">${o.peso ?? "—"}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <button type="button" data-opcion-delete="${o.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
        </td>
      </tr>`,
      )
      .join("");
    return ajustesTableWrap(`
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100">
              <th scope="col" class="${AJUSTES_TABLE_TH}">Etiqueta</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Valor</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Orden</th>
              <th scope="col" class="${AJUSTES_TABLE_TH}">Peso</th>
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
  }

  function renderOpcionesListModal(): string {
    if (!opcionesListModalOpen || selectedMetodoId == null) return "";
    const metodo = selectedMetodo();
    if (!metodo) return "";

    return `
      <div id="opciones-list-modal-backdrop" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div
          class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opciones-list-modal-title"
        >
          <header class="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h2 id="opciones-list-modal-title" class="text-lg font-semibold text-text-primary">
                  Opciones de «${escapeHtml(metodo.nombre)}»
                </h2>
                <dl class="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-medium text-text-muted">Tipo de evaluación</dt>
                    <dd class="text-text-primary">${escapeHtml(labelMetodoTipo(metodo.tipo))}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-text-muted">Regla de cumplimiento</dt>
                    <dd class="text-text-primary">${escapeHtml(labelComparador(metodo.config?.comparador))}</dd>
                  </div>
                </dl>
                <p class="mt-2 text-xs text-text-muted">Valores disponibles para métodos basados en lista u opciones.</p>
              </div>
              <button type="button" data-opciones-modal-close class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar">
                <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            ${renderOpcionesTableBody()}
          </div>
          <footer class="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button type="button" data-opciones-modal-close class="${RH_LISTADO_BTN_SECONDARY}">Cerrar</button>
            <button type="button" data-opcion-create class="${RH_LISTADO_BTN_PRIMARY} shrink-0" ${opcionesLoading ? "disabled" : ""}>
              ${AJUSTES_ICON_PLUS}<span>Nueva opción</span>
            </button>
          </footer>
        </div>
      </div>`;
  }

  function renderMetodoModal(): string {
    if (!metodoModalMode) return "";
    const m = editingMetodo;
    const tipoOpts = METODO_TIPOS.map((t) => {
      const label = METODO_TIPO_LABELS[t];
      const desc = METODO_TIPO_DESCRIPCIONES[t];
      return `<option value="${t}" ${m?.tipo === t ? "selected" : ""} title="${escapeHtml(desc)}">${escapeHtml(label)}</option>`;
    }).join("");
    const compOpts = COMPARADORES.map((c) => {
      const label = COMPARADOR_LABELS[c];
      const desc = COMPARADOR_DESCRIPCIONES[c];
      return `<option value="${c}" ${m?.config?.comparador === c ? "selected" : ""} title="${escapeHtml(desc)}">${escapeHtml(label)}</option>`;
    }).join("");
    return `
      <div id="metodo-modal" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL_LG}" role="dialog" aria-modal="true" aria-labelledby="metodo-modal-title">
          <h3 id="metodo-modal-title" class="text-lg font-semibold text-text-primary">${m ? "Editar método" : "Nuevo método"}</h3>
          <form id="metodo-form" class="mt-4 space-y-4">
            <div>
              <label for="metodo-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
              <input id="metodo-nombre" name="nombre" type="text" required value="${escapeHtml(m?.nombre ?? "")}" class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="metodo-tipo" class="${RH_LISTADO_LABEL}">Tipo de evaluación <span class="text-red-600">*</span></label>
              <div class="grid grid-cols-1">
                <select id="metodo-tipo" name="tipo" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">${tipoOpts}</select>
                ${SELECT_CHEVRON}
              </div>
              <p class="mt-1.5 text-xs text-text-muted">Define cómo se captura el valor del empleado.</p>
            </div>
            <div>
              <label for="metodo-comparador" class="${RH_LISTADO_LABEL}">Regla de cumplimiento <span class="text-red-600">*</span></label>
              <div class="grid grid-cols-1">
                <select id="metodo-comparador" name="comparador" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">${compOpts}</select>
                ${SELECT_CHEVRON}
              </div>
              <p class="mt-1.5 text-xs text-text-muted">Cómo se compara el valor capturado contra el requisito del perfil.</p>
            </div>
            <div>
              <label for="metodo-descripcion" class="${RH_LISTADO_LABEL}">Descripción</label>
              <textarea id="metodo-descripcion" name="descripcion" rows="2" class="${AJUSTES_TEXTAREA}">${escapeHtml(m?.descripcion ?? "")}</textarea>
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-metodo-cancel class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function renderDeleteMetodoModal(): string {
    if (!deletingMetodo) return "";
    return `
      <div id="metodo-delete-modal" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="metodo-delete-title">
          <h3 id="metodo-delete-title" class="text-lg font-semibold text-text-primary">Eliminar método</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(deletingMetodo.nombre)}</strong>? Las cualificaciones que lo usen dejarán de funcionar correctamente.</p>
          ${modalError ? ajustesModalError(modalError) : ""}
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-metodo-delete-cancel class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-metodo-delete-confirm class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
          </div>
        </div>
      </div>`;
  }

  function renderOpcionModal(): string {
    if (!opcionModalMode || !selectedMetodoId) return "";
    if (opcionModalMode === "delete" && deletingOpcion) {
      return `
        <div id="opcion-modal" class="${OPCION_SUBMODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="opcion-delete-title">
            <h3 id="opcion-delete-title" class="text-lg font-semibold text-text-primary">Eliminar opción</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar la opción <strong>${escapeHtml(deletingOpcion.etiqueta)}</strong>?</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-opcion-modal-cancel class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" data-opcion-modal-confirm-delete class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    return `
      <div id="opcion-modal" class="${OPCION_SUBMODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="opcion-create-title">
          <h3 id="opcion-create-title" class="text-lg font-semibold text-text-primary">Nueva opción</h3>
          <form id="opcion-form" class="mt-4 space-y-4">
            <div>
              <label for="opcion-etiqueta" class="${RH_LISTADO_LABEL}">Etiqueta <span class="text-red-600">*</span></label>
              <input id="opcion-etiqueta" name="etiqueta" type="text" required value="${escapeHtml(opcionEtiqueta)}" class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="opcion-valor" class="${RH_LISTADO_LABEL}">Valor (clave estable) <span class="text-red-600">*</span></label>
              <input id="opcion-valor" name="valor" type="text" required value="${escapeHtml(opcionValor)}" class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="opcion-peso" class="${RH_LISTADO_LABEL}">Peso (opcional)</label>
              <input id="opcion-peso" name="peso" type="number" step="any" value="${escapeHtml(opcionPeso)}" class="${AJUSTES_INPUT}" placeholder="Para listas ordenadas" />
            </div>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-opcion-modal-cancel class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: "metodos-section-title",
        title: "Métodos de evaluación",
        description: "Reglas de evaluación y comparación para cualificaciones del perfil.",
        actionButtonHtml: `<button type="button" data-metodo-create class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Nuevo método</span></button>`,
        bodyHtml: renderMetodoTable(),
      }) +
      renderOpcionesListModal() +
      renderMetodoModal() +
      renderDeleteMetodoModal() +
      renderOpcionModal();
  }

  function closeMetodoModal(): void {
    metodoModalMode = null;
    editingMetodo = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  function closeDeleteMetodoModal(): void {
    deletingMetodo = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  function closeOpcionesListModal(): void {
    opcionesListModalOpen = false;
    selectedMetodoId = null;
    opciones = [];
    opcionesLoading = false;
    opcionesError = "";
    opcionModalMode = null;
    deletingOpcion = null;
    opcionEtiqueta = "";
    opcionValor = "";
    opcionPeso = "";
    modalError = "";
    modalSaving = false;
    paint();
  }

  function closeOpcionModal(): void {
    opcionModalMode = null;
    deletingOpcion = null;
    opcionEtiqueta = "";
    opcionValor = "";
    opcionPeso = "";
    modalError = "";
    modalSaving = false;
    paint();
  }

  async function openOpcionesModal(metodoId: number): Promise<void> {
    selectedMetodoId = metodoId;
    opcionesListModalOpen = true;
    opcionesLoading = true;
    opcionesError = "";
    opciones = [];
    paint();
    try {
      opciones = await getOpcionesMetodo(metodoId);
      opcionesLoading = false;
    } catch (e) {
      opcionesLoading = false;
      opcionesError = (e as CatalogoFetchError).detail ?? "No se pudieron cargar las opciones.";
    }
    paint();
  }

  async function loadOpciones(metodoId: number): Promise<void> {
    opcionesLoading = true;
    opcionesError = "";
    paint();
    try {
      opciones = await getOpcionesMetodo(metodoId);
      opcionesLoading = false;
    } catch (e) {
      opcionesLoading = false;
      opcionesError = (e as CatalogoFetchError).detail ?? "No se pudieron cargar las opciones.";
    }
    paint();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await getMetodosCalificacion();
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = (e as CatalogoFetchError).detail ?? "Error al cargar métodos.";
      paint();
    }
  }

  sectionEl.addEventListener(
    "click",
    async (ev) => {
      const t = ev.target as HTMLElement;

      const opcionesBackdrop = t.closest("#opciones-list-modal-backdrop");
      if (opcionesBackdrop && t === opcionesBackdrop) {
        closeOpcionesListModal();
        return;
      }

      if (t.closest("[data-opciones-modal-close]")) {
        closeOpcionesListModal();
        return;
      }

      if (t.closest("[data-metodo-create]")) {
        editingMetodo = null;
        metodoModalMode = "create";
        modalError = "";
        paint();
        return;
      }
      const editId = t.closest("[data-metodo-edit]")?.getAttribute("data-metodo-edit");
      if (editId) {
        editingMetodo = items.find((m) => m.id === Number(editId)) ?? null;
        metodoModalMode = "edit";
        modalError = "";
        paint();
        return;
      }
      const delId = t.closest("[data-metodo-delete]")?.getAttribute("data-metodo-delete");
      if (delId) {
        deletingMetodo = items.find((m) => m.id === Number(delId)) ?? null;
        modalError = "";
        paint();
        return;
      }
      if (t.closest("[data-metodo-delete-cancel]")) {
        closeDeleteMetodoModal();
        return;
      }
      if (t.closest("[data-metodo-delete-confirm]")) {
        await confirmDeleteMetodo();
        return;
      }
      const selId = t.closest("[data-metodo-select]")?.getAttribute("data-metodo-select");
      if (selId) {
        await openOpcionesModal(Number(selId));
        return;
      }
      if (t.closest("[data-metodo-cancel]")) {
        closeMetodoModal();
        return;
      }
      if (t.closest("[data-opcion-create]") && selectedMetodoId) {
        opcionModalMode = "create";
        opcionEtiqueta = "";
        opcionValor = "";
        opcionPeso = "";
        modalError = "";
        paint();
        sectionEl.querySelector<HTMLInputElement>("#opcion-etiqueta")?.focus();
        return;
      }
      const opcDel = t.closest("[data-opcion-delete]")?.getAttribute("data-opcion-delete");
      if (opcDel && selectedMetodoId) {
        deletingOpcion = opciones.find((o) => o.id === Number(opcDel)) ?? null;
        if (!deletingOpcion) return;
        opcionModalMode = "delete";
        modalError = "";
        paint();
        return;
      }
      if (t.closest("[data-opcion-modal-cancel]")) {
        closeOpcionModal();
      }
      if (t.closest("[data-opcion-modal-confirm-delete]")) {
        await confirmDeleteOpcion();
      }
    },
    { signal },
  );

  sectionEl.addEventListener(
    "submit",
    async (ev) => {
      const form = ev.target as HTMLElement;
      if (form.closest("#metodo-form")) {
        ev.preventDefault();
        await submitMetodoForm(ev.target as HTMLFormElement);
        return;
      }
      if (form.closest("#opcion-form")) {
        ev.preventDefault();
        await submitOpcionForm(ev.target as HTMLFormElement);
      }
    },
    { signal },
  );

  async function submitMetodoForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const body = {
      nombre: String(fd.get("nombre")).trim(),
      tipo: String(fd.get("tipo")),
      descripcion: String(fd.get("descripcion") ?? "").trim() || undefined,
      config: {
        comparador: String(fd.get("comparador")),
        permite_na: true,
        captura: {
          campos: ["opcion", "texto", "anios"],
          anios_habilitado: String(fd.get("tipo")) === "anios_experiencia",
        },
      },
    };
    modalSaving = true;
    modalError = "";
    paint();
    try {
      if (editingMetodo) await updateMetodoCalificacion(editingMetodo.id, body);
      else await createMetodoCalificacion(body);
      closeMetodoModal();
      await load();
      notifyAjustesMetodosCalificacionChanged();
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDeleteMetodo(): Promise<void> {
    if (!deletingMetodo) return;
    const deletedId = deletingMetodo.id;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteMetodoCalificacion(deletedId);
      if (selectedMetodoId === deletedId) {
        closeOpcionesListModal();
      }
      closeDeleteMetodoModal();
      await load();
      notifyAjustesMetodosCalificacionChanged();
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "No se pudo eliminar.";
      paint();
    }
  }

  async function submitOpcionForm(form: HTMLFormElement): Promise<void> {
    if (!selectedMetodoId) return;
    const fd = new FormData(form);
    const etiqueta = String(fd.get("etiqueta") ?? "").trim();
    const valor = String(fd.get("valor") ?? "").trim();
    const pesoRaw = String(fd.get("peso") ?? "").trim();
    if (!etiqueta || !valor) {
      modalError = "Etiqueta y valor son obligatorios.";
      paint();
      return;
    }
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await createOpcionMetodo(selectedMetodoId, {
        etiqueta,
        valor,
        orden: opciones.length,
        peso: pesoRaw ? Number(pesoRaw) : null,
      });
      closeOpcionModal();
      await loadOpciones(selectedMetodoId);
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "Error al guardar la opción.";
      paint();
    }
  }

  async function confirmDeleteOpcion(): Promise<void> {
    if (!selectedMetodoId || !deletingOpcion) return;
    const opcionId = deletingOpcion.id;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await deleteOpcionMetodo(selectedMetodoId, opcionId);
      opciones = opciones.filter((o) => o.id !== opcionId);
      closeOpcionModal();
      await loadOpciones(selectedMetodoId);
    } catch (e) {
      modalSaving = false;
      modalError = (e as CatalogoFetchError).detail ?? "No se pudo eliminar la opción.";
      paint();
    }
  }

  void load();
}
