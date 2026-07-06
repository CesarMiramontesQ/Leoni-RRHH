import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  badgeApproved,
  badgeCancelled,
  BTN_DANGER,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  pageHeading,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_ICON_PLUS,
  AJUSTES_ICON_TRASH,
  AJUSTES_INPUT,
  AJUSTES_TEXTAREA,
  AJUSTES_MODAL_OVERLAY,
  AJUSTES_MODAL_PANEL,
  AJUSTES_ROW_BTN_DELETE,
  AJUSTES_ROW_BTN_EDIT,
  AJUSTES_TABLE_TD,
  AJUSTES_TABLE_TD_ACTIONS,
  AJUSTES_TABLE_TD_MUTED,
  AJUSTES_TABLE_TH,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesTableWrap,
} from "../components/puestos/ajustes/ajustesSectionUi.ts";
import {
  getCategorias, createCategoria, updateCategoria, deleteCategoria,
  getTipos, createTipo, updateTipo, deleteTipo,
  getClasificaciones, createClasificacion, updateClasificacion, deleteClasificacion,
  getInstructoresExternos, createInstructorExterno, updateInstructorExterno, deleteInstructorExterno,
  getInstructoresInternos, createInstructorInterno, updateInstructorInterno, deleteInstructorInterno,
  getProveedores, createProveedor, updateProveedor, deleteProveedor,
} from "../api/cursosCatalogo.ts";
import type { CursoCatSimple, InstructorExterno, InstructorInterno, Proveedor } from "../api/cursosCatalogo.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

type TabId = "categorias" | "tipos" | "clasificaciones" | "instructores" | "instructores-int" | "proveedores";
type ModalMode = "create" | "edit" | "delete" | null;

type EmpleadoPick = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  area: string | null;
};

interface State {
  activeTab: TabId;
  items: (CursoCatSimple | InstructorExterno | InstructorInterno | Proveedor)[];
  loading: boolean;
  error: string;
  showInactive: boolean;
  modalMode: ModalMode;
  modalSaving: boolean;
  modalError: string;
  editingItem: (CursoCatSimple | InstructorExterno | InstructorInterno | Proveedor) | null;
  proveedoresCatalog: Proveedor[];
  proveedoresLoading: boolean;
  empleadoSearchQ: string;
  empleadoSearchResults: EmpleadoPick[];
  empleadoSearching: boolean;
  selectedEmpleadoId: number | null;
  selectedEmpleadoLabel: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "categorias", label: "Categorías" },
  { id: "tipos", label: "Tipos" },
  { id: "clasificaciones", label: "Clasificaciones" },
  { id: "instructores", label: "Instructores Ext." },
  { id: "instructores-int", label: "Instructores Int." },
  { id: "proveedores", label: "Proveedores de cursos" },
];

export function mountCursosAjustes(container: HTMLElement, signal: AbortSignal): void {
  const state: State = {
    activeTab: "categorias",
    items: [],
    loading: true,
    error: "",
    showInactive: false,
    modalMode: null,
    modalSaving: false,
    modalError: "",
    editingItem: null,
    proveedoresCatalog: [],
    proveedoresLoading: false,
    empleadoSearchQ: "",
    empleadoSearchResults: [],
    empleadoSearching: false,
    selectedEmpleadoId: null,
    selectedEmpleadoLabel: "",
  };

  let empleadoSearchTimer: ReturnType<typeof setTimeout> | null = null;
  let empleadoSearchToken = 0;

  function tabButtonClass(isActive: boolean): string {
    const base = "inline-flex min-h-9 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2";
    if (isActive) return `${base} border-leoni-blue/20 bg-leoni-blue text-white shadow-sm shadow-leoni-blue/20`;
    return `${base} border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-text-primary`;
  }

  function renderTabs(): string {
    const buttons = TABS.map((t) =>
      `<button type="button" role="tab" aria-selected="${t.id === state.activeTab}" data-cat-tab="${t.id}" class="${tabButtonClass(t.id === state.activeTab)}">${escapeHtml(t.label)}</button>`
    ).join("");
    return `<div role="tablist" aria-label="Catálogos" class="overflow-x-auto pb-1">
      <div class="inline-flex min-w-full items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-1.5">${buttons}</div>
    </div>`;
  }

  function badgeActivo(activo: boolean): string {
    return activo ? badgeApproved("Activo") : badgeCancelled("Inactivo");
  }

  function renderTableSimple(): string {
    if (state.loading) return ajustesLoadingState("Cargando…");
    if (state.error) return ajustesErrorAlert(state.error);
    const items = state.items as CursoCatSimple[];
    if (items.length === 0) return ajustesEmptyState("No hay registros. Crea el primero.");
    const rows = items.map((i) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(i.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.descripcion ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD}">${badgeActivo(i.activo)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-cat-action="edit" data-id="${i.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            ${i.activo ? `<button type="button" data-cat-action="delete" data-id="${i.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Desactivar">${AJUSTES_ICON_TRASH}</button>` : ""}
          </div>
        </td>
      </tr>`).join("");
    return ajustesTableWrap(`<table class="min-w-full text-left">
      <thead><tr class="border-b border-slate-100">
        <th class="${AJUSTES_TABLE_TH}">Nombre</th>
        <th class="${AJUSTES_TABLE_TH}">Descripción</th>
        <th class="${AJUSTES_TABLE_TH}">Estado</th>
        <th class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
  }

  function renderTableInstructores(): string {
    if (state.loading) return ajustesLoadingState("Cargando…");
    if (state.error) return ajustesErrorAlert(state.error);
    const items = state.items as InstructorExterno[];
    if (items.length === 0) return ajustesEmptyState("No hay instructores externos. Crea el primero.");
    const rows = items.map((i) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(i.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.especialidad ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.empresa ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.contacto ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD}">${badgeActivo(i.activo)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-cat-action="edit" data-id="${i.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            ${i.activo ? `<button type="button" data-cat-action="delete" data-id="${i.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Desactivar">${AJUSTES_ICON_TRASH}</button>` : ""}
          </div>
        </td>
      </tr>`).join("");
    return ajustesTableWrap(`<table class="min-w-full text-left">
      <thead><tr class="border-b border-slate-100">
        <th class="${AJUSTES_TABLE_TH}">Nombre</th>
        <th class="${AJUSTES_TABLE_TH}">Especialidad</th>
        <th class="${AJUSTES_TABLE_TH}">Empresa</th>
        <th class="${AJUSTES_TABLE_TH}">Contacto</th>
        <th class="${AJUSTES_TABLE_TH}">Estado</th>
        <th class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
  }

  function renderTableInstructoresInternos(): string {
    if (state.loading) return ajustesLoadingState("Cargando…");
    if (state.error) return ajustesErrorAlert(state.error);
    const items = state.items as InstructorInterno[];
    if (items.length === 0) return ajustesEmptyState("No hay instructores internos. Registra el primero.");
    const rows = items.map((i) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(i.nombre_empleado ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED} tabular-nums">${escapeHtml(i.no_empleado ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.especialidad ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD}">${badgeActivo(i.activo)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-cat-action="edit" data-id="${i.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            ${i.activo ? `<button type="button" data-cat-action="delete" data-id="${i.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Desactivar">${AJUSTES_ICON_TRASH}</button>` : ""}
          </div>
        </td>
      </tr>`).join("");
    return ajustesTableWrap(`<table class="min-w-full text-left">
      <thead><tr class="border-b border-slate-100">
        <th class="${AJUSTES_TABLE_TH}">Empleado</th>
        <th class="${AJUSTES_TABLE_TH}">No. empleado</th>
        <th class="${AJUSTES_TABLE_TH}">Especialidad</th>
        <th class="${AJUSTES_TABLE_TH}">Estado</th>
        <th class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
  }

  function renderTableProveedores(): string {
    if (state.loading) return ajustesLoadingState("Cargando…");
    if (state.error) return ajustesErrorAlert(state.error);
    const items = state.items as Proveedor[];
    if (items.length === 0) return ajustesEmptyState("No hay proveedores de cursos. Crea el primero.");
    const rows = items.map((i) => `
      <tr class="border-b border-slate-100/90">
        <td class="${AJUSTES_TABLE_TD} font-medium">${escapeHtml(i.nombre)}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.contacto ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.telefono ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD_MUTED}">${escapeHtml(i.email ?? "—")}</td>
        <td class="${AJUSTES_TABLE_TD}">${badgeActivo(i.activo)}</td>
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" data-cat-action="edit" data-id="${i.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            ${i.activo ? `<button type="button" data-cat-action="delete" data-id="${i.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Desactivar">${AJUSTES_ICON_TRASH}</button>` : ""}
          </div>
        </td>
      </tr>`).join("");
    return ajustesTableWrap(`<table class="min-w-full text-left">
      <thead><tr class="border-b border-slate-100">
        <th class="${AJUSTES_TABLE_TH}">Nombre</th>
        <th class="${AJUSTES_TABLE_TH}">Contacto</th>
        <th class="${AJUSTES_TABLE_TH}">Teléfono</th>
        <th class="${AJUSTES_TABLE_TH}">Email</th>
        <th class="${AJUSTES_TABLE_TH}">Estado</th>
        <th class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
  }

  function renderTableContent(): string {
    if (state.activeTab === "instructores") return renderTableInstructores();
    if (state.activeTab === "instructores-int") return renderTableInstructoresInternos();
    if (state.activeTab === "proveedores") return renderTableProveedores();
    return renderTableSimple();
  }

  function renderModalSimple(): string {
    if (!state.modalMode) return "";
    if (state.modalMode === "delete") {
      const item = state.editingItem as CursoCatSimple;
      return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">Desactivar</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Desactivar <strong>${escapeHtml(item?.nombre ?? "")}</strong>? Los cursos existentes conservarán la referencia pero no aparecerá en selectores.</p>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-cat-modal="confirm-delete" class="${BTN_DANGER}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Desactivando…" : "Desactivar"}</button>
          </div>
        </div>
      </div>`;
    }
    const isEdit = state.modalMode === "edit";
    const item = state.editingItem as CursoCatSimple | null;
    const title = isEdit ? "Editar" : "Nuevo";
    return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
      <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
        <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
        <form id="cat-form" class="mt-4 space-y-4">
          <div>
            <label for="cat-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
            <input id="cat-nombre" name="nombre" type="text" required minlength="2" maxlength="150" value="${escapeHtml(item?.nombre ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          <div>
            <label for="cat-descripcion" class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea id="cat-descripcion" name="descripcion" rows="2" maxlength="500" class="${AJUSTES_TEXTAREA}">${escapeHtml(item?.descripcion ?? "")}</textarea>
          </div>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderProveedorSelect(selectedEmpresa: string | null | undefined): string {
    const proveedores = state.proveedoresCatalog;
    const selected = selectedEmpresa?.trim() ?? "";
    const matched = proveedores.some((p) => p.nombre === selected);
    const disabled = state.proveedoresLoading ? " disabled" : "";
    const loadingOption = state.proveedoresLoading
      ? `<option value="" selected>Cargando proveedores de cursos…</option>`
      : `<option value="">Seleccionar proveedor de cursos…</option>`;
    let options = loadingOption;
    if (!state.proveedoresLoading) {
      for (const p of proveedores) {
        const isSelected = p.nombre === selected ? " selected" : "";
        options += `<option value="${escapeHtml(p.nombre)}"${isSelected}>${escapeHtml(p.nombre)}</option>`;
      }
      if (selected && !matched) {
        options += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (sin catálogo)</option>`;
      }
    }
    const emptyHint = proveedores.length === 0 && !state.proveedoresLoading
      ? `<p class="mt-1 text-xs text-text-muted">No hay proveedores de cursos activos. Regístralos en la pestaña «Proveedores de cursos».</p>`
      : "";
    return `
      <div class="grid grid-cols-1">
        <select id="cat-empresa" name="empresa" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"${disabled}>
          ${options}
        </select>
        ${SELECT_CHEVRON}
      </div>
      ${emptyHint}`;
  }

  function renderModalInstructor(): string {
    if (!state.modalMode) return "";
    if (state.modalMode === "delete") {
      const item = state.editingItem as InstructorExterno;
      return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">Desactivar instructor</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Desactivar <strong>${escapeHtml(item?.nombre ?? "")}</strong>?</p>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-cat-modal="confirm-delete" class="${BTN_DANGER}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Desactivando…" : "Desactivar"}</button>
          </div>
        </div>
      </div>`;
    }
    const isEdit = state.modalMode === "edit";
    const item = state.editingItem as InstructorExterno | null;
    const title = isEdit ? "Editar instructor externo" : "Nuevo instructor externo";
    return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
      <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
        <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
        <form id="cat-form" class="mt-4 space-y-4">
          <div>
            <label for="cat-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
            <input id="cat-nombre" name="nombre" type="text" required minlength="2" maxlength="255" value="${escapeHtml(item?.nombre ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          <div>
            <label for="cat-especialidad" class="${RH_LISTADO_LABEL}">Especialidad</label>
            <input id="cat-especialidad" name="especialidad" type="text" maxlength="255" value="${escapeHtml(item?.especialidad ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          <div>
            <label for="cat-empresa" class="${RH_LISTADO_LABEL}">Proveedor de cursos</label>
            ${renderProveedorSelect(item?.empresa)}
          </div>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderEmpleadoSearchBlock(isEdit: boolean, item: InstructorInterno | null): string {
    if (isEdit && item) {
      const label = [item.nombre_empleado, item.no_empleado ? `#${item.no_empleado}` : ""].filter(Boolean).join(" · ");
      return `
        <div>
          <label class="${RH_LISTADO_LABEL}">Empleado</label>
          <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-text-primary">${escapeHtml(label)}</p>
          <input type="hidden" name="empleado_id" value="${item.empleado_id}" />
        </div>`;
    }
    const hasSelection = state.selectedEmpleadoId != null;
    const showResults = !hasSelection && (state.empleadoSearching || state.empleadoSearchQ.trim().length >= 2);
    const resultsHidden = showResults ? "" : " hidden";
    const resultsHtml = state.empleadoSearching
      ? `<p class="px-2 py-3 text-xs text-slate-500 text-center">Buscando…</p>`
      : state.empleadoSearchResults.length === 0
        ? `<p class="px-2 py-3 text-xs text-slate-500 text-center">Sin resultados</p>`
        : state.empleadoSearchResults.map((emp) => `
            <button type="button" data-cat-action="pick-empleado" data-empleado-id="${emp.empleado_id}"
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-leoni-blue/10">
              <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
              <span class="text-xs text-slate-500 tabular-nums">${escapeHtml(emp.no_empleado)}</span>
              ${emp.area ? `<span class="ml-auto text-xs text-slate-400">${escapeHtml(emp.area)}</span>` : ""}
            </button>`).join("");
    const selectionHtml = hasSelection
      ? `<div class="mt-2 flex items-center justify-between gap-2 rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 px-3 py-2.5">
          <span class="text-sm font-medium text-text-primary">${escapeHtml(state.selectedEmpleadoLabel)}</span>
          <button type="button" data-cat-action="clear-empleado" class="text-xs font-semibold text-leoni-blue hover:underline">Cambiar</button>
        </div>`
      : "";
    return `
      <div>
        <label for="cat-empleado-search" class="${RH_LISTADO_LABEL}">Empleado <span class="text-red-600">*</span></label>
        <input id="cat-empleado-search" type="search" autocomplete="off" value="${escapeHtml(state.empleadoSearchQ)}"
          placeholder="Nombre o número de empleado…" class="${AJUSTES_INPUT}" ${hasSelection ? "disabled" : ""} />
        <div id="cat-empleado-resultados" class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1${resultsHidden}${hasSelection ? " hidden" : ""}">${resultsHtml}</div>
        ${selectionHtml}
        <input type="hidden" name="empleado_id" value="${hasSelection ? state.selectedEmpleadoId : ""}" />
      </div>`;
  }

  function renderModalInstructorInterno(): string {
    if (!state.modalMode) return "";
    if (state.modalMode === "delete") {
      const item = state.editingItem as InstructorInterno;
      const nombre = item?.nombre_empleado ?? "este instructor";
      return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">Desactivar instructor interno</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Desactivar <strong>${escapeHtml(nombre)}</strong>?</p>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-cat-modal="confirm-delete" class="${BTN_DANGER}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Desactivando…" : "Desactivar"}</button>
          </div>
        </div>
      </div>`;
    }
    const isEdit = state.modalMode === "edit";
    const item = state.editingItem as InstructorInterno | null;
    const title = isEdit ? "Editar instructor interno" : "Nuevo instructor interno";
    return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
      <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
        <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
        <form id="cat-form" class="mt-4 space-y-4">
          ${renderEmpleadoSearchBlock(isEdit, item)}
          <div>
            <label for="cat-especialidad" class="${RH_LISTADO_LABEL}">Especialidad</label>
            <input id="cat-especialidad" name="especialidad" type="text" maxlength="255" value="${escapeHtml(item?.especialidad ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderModalProveedor(): string {
    if (!state.modalMode) return "";
    if (state.modalMode === "delete") {
      const item = state.editingItem as Proveedor;
      return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold text-text-primary">Desactivar proveedor de cursos</h3>
          <p class="mt-2 text-sm text-text-secondary">¿Desactivar <strong>${escapeHtml(item?.nombre ?? "")}</strong>?</p>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-cat-modal="confirm-delete" class="${BTN_DANGER}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Desactivando…" : "Desactivar"}</button>
          </div>
        </div>
      </div>`;
    }
    const isEdit = state.modalMode === "edit";
    const item = state.editingItem as Proveedor | null;
    const title = isEdit ? "Editar proveedor de cursos" : "Nuevo proveedor de cursos";
    return `<div id="cat-modal-overlay" class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
      <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true">
        <h3 class="text-lg font-semibold text-text-primary">${title}</h3>
        <form id="cat-form" class="mt-4 space-y-4">
          <div>
            <label for="cat-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600">*</span></label>
            <input id="cat-nombre" name="nombre" type="text" required minlength="2" maxlength="255" value="${escapeHtml(item?.nombre ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          <div>
            <label for="cat-contacto" class="${RH_LISTADO_LABEL}">Contacto</label>
            <input id="cat-contacto" name="contacto" type="text" maxlength="255" value="${escapeHtml(item?.contacto ?? "")}" class="${AJUSTES_INPUT}" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="cat-telefono" class="${RH_LISTADO_LABEL}">Teléfono</label>
              <input id="cat-telefono" name="telefono" type="text" maxlength="50" value="${escapeHtml(item?.telefono ?? "")}" class="${AJUSTES_INPUT}" />
            </div>
            <div>
              <label for="cat-email" class="${RH_LISTADO_LABEL}">Email</label>
              <input id="cat-email" name="email" type="email" maxlength="255" value="${escapeHtml(item?.email ?? "")}" class="${AJUSTES_INPUT}" />
            </div>
          </div>
          <div>
            <label for="cat-direccion" class="${RH_LISTADO_LABEL}">Dirección</label>
            <textarea id="cat-direccion" name="direccion" rows="2" class="${AJUSTES_TEXTAREA}">${escapeHtml(item?.direccion ?? "")}</textarea>
          </div>
          ${state.modalError ? ajustesModalError(state.modalError) : ""}
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-cat-modal="cancel" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${state.modalSaving ? "disabled" : ""}>${state.modalSaving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderModal(): string {
    if (state.activeTab === "instructores") return renderModalInstructor();
    if (state.activeTab === "instructores-int") return renderModalInstructorInterno();
    if (state.activeTab === "proveedores") return renderModalProveedor();
    return renderModalSimple();
  }

  function resetEmpleadoPicker(): void {
    state.empleadoSearchQ = "";
    state.empleadoSearchResults = [];
    state.empleadoSearching = false;
    state.selectedEmpleadoId = null;
    state.selectedEmpleadoLabel = "";
  }

  function tabTitle(): string {
    return TABS.find((t) => t.id === state.activeTab)?.label ?? "";
  }

  function paint(): void {
    const root = container.querySelector("#cursos-ajustes-content");
    if (!root) return;
    const showInactiveCheck = state.showInactive ? "checked" : "";
    root.innerHTML = `
      <div class="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-text-primary">${escapeHtml(tabTitle())}</h2>
            <label class="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
              <input type="checkbox" data-cat-action="toggle-inactive" ${showInactiveCheck} class="rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue/40" />
              Mostrar inactivos
            </label>
          </div>
          <button type="button" data-cat-action="create" class="${RH_LISTADO_BTN_PRIMARY} shrink-0">${AJUSTES_ICON_PLUS}<span>Agregar</span></button>
        </div>
        ${renderTableContent()}
      </div>
      ${renderModal()}`;
  }

  function render(): void {
    mountAppShell(container, {
      activeNav: "cursos-ajustes",
      pageTitle: "Ajustes de cursos",
      mainClass: "py-5 sm:py-6",
      mainHtml: `<div class="${RH_LISTADO_PAGE_OUTER}">
        ${renderLevelUpBackBar()}
        ${pageHeading(
          "Ajustes de cursos",
          "Administra los catálogos: categorías, tipos, clasificaciones, instructores y proveedores.",
        )}
        <div class="flex flex-col gap-5">
          ${renderTabs()}
          <div id="cursos-ajustes-content"></div>
        </div>
      </div>`,
    });
    paint();
  }

  async function load(): Promise<void> {
    state.loading = true;
    state.error = "";
    paint();
    try {
      const soloActivos = !state.showInactive;
      const params = { page: 1, page_size: 200, solo_activos: soloActivos };
      let result: { items: unknown[] };
      switch (state.activeTab) {
        case "categorias": result = await getCategorias(params); break;
        case "tipos": result = await getTipos(params); break;
        case "clasificaciones": result = await getClasificaciones(params); break;
        case "instructores": result = await getInstructoresExternos(params); break;
        case "instructores-int": result = await getInstructoresInternos(params); break;
        case "proveedores": result = await getProveedores(params); break;
      }
      state.items = result.items as State["items"];
      state.loading = false;
      paint();
    } catch (e: unknown) {
      state.loading = false;
      state.error = (e as { detail?: string }).detail ?? "Error al cargar datos.";
      paint();
    }
  }

  function closeModal(): void {
    state.modalMode = null;
    state.modalSaving = false;
    state.modalError = "";
    state.editingItem = null;
    state.proveedoresCatalog = [];
    state.proveedoresLoading = false;
    resetEmpleadoPicker();
    paint();
  }

  function openInstructorInternoModal(mode: "create" | "edit", item: InstructorInterno | null): void {
    state.modalMode = mode;
    state.editingItem = item;
    state.modalError = "";
    resetEmpleadoPicker();
    if (mode === "edit" && item) {
      state.selectedEmpleadoId = item.empleado_id;
      state.selectedEmpleadoLabel = [item.nombre_empleado, item.no_empleado ? `#${item.no_empleado}` : ""].filter(Boolean).join(" · ");
    }
    paint();
    if (mode === "create") {
      container.querySelector<HTMLInputElement>("#cat-empleado-search")?.focus();
    } else {
      container.querySelector<HTMLInputElement>("#cat-especialidad")?.focus();
    }
  }

  async function searchEmpleados(q: string): Promise<void> {
    if (q.length < 2) {
      state.empleadoSearchResults = [];
      state.empleadoSearching = false;
      paint();
      return;
    }
    const token = ++empleadoSearchToken;
    state.empleadoSearching = true;
    paint();
    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 10, q, activo: true });
      if (token !== empleadoSearchToken) return;
      state.empleadoSearchResults = page.items.map((i) => ({
        empleado_id: i.id,
        no_empleado: formatNoEmpleadoDisplay(i.no_empleado) || String(i.no_empleado ?? ""),
        nombre: i.nombre,
        area: i.area?.descripcion ?? null,
      }));
    } catch {
      if (token !== empleadoSearchToken) return;
      state.empleadoSearchResults = [];
    }
    state.empleadoSearching = false;
    paint();
  }

  async function loadProveedoresForModal(): Promise<void> {
    state.proveedoresLoading = true;
    paint();
    try {
      const result = await getProveedores({ page: 1, page_size: 200, solo_activos: true });
      state.proveedoresCatalog = result.items;
    } catch {
      state.proveedoresCatalog = [];
    }
    state.proveedoresLoading = false;
    paint();
    container.querySelector<HTMLInputElement>("#cat-nombre")?.focus();
  }

  function openInstructorModal(mode: "create" | "edit", item: InstructorExterno | null): void {
    state.modalMode = mode;
    state.editingItem = item;
    state.modalError = "";
    void loadProveedoresForModal();
  }

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    if (state.activeTab === "instructores-int") {
      const especialidad = String(fd.get("especialidad") ?? "").trim() || undefined;
      if (state.modalMode === "create") {
        const empleadoId = Number(fd.get("empleado_id"));
        if (!empleadoId || Number.isNaN(empleadoId)) {
          state.modalError = "Selecciona un empleado.";
          paint();
          return;
        }
        state.modalSaving = true;
        state.modalError = "";
        paint();
        try {
          await createInstructorInterno({ empleado_id: empleadoId, especialidad });
          closeModal();
          await load();
        } catch (e: unknown) {
          state.modalSaving = false;
          state.modalError = (e as { detail?: string }).detail ?? "Error al guardar.";
          paint();
        }
        return;
      }
      if (state.modalMode === "edit" && state.editingItem) {
        state.modalSaving = true;
        state.modalError = "";
        paint();
        try {
          await updateInstructorInterno(state.editingItem.id, { especialidad });
          closeModal();
          await load();
        } catch (e: unknown) {
          state.modalSaving = false;
          state.modalError = (e as { detail?: string }).detail ?? "Error al guardar.";
          paint();
        }
        return;
      }
    }

    const nombre = String(fd.get("nombre") ?? "").trim();
    if (nombre.length < 2) {
      state.modalError = "El nombre debe tener al menos 2 caracteres.";
      paint();
      return;
    }
    if (state.activeTab === "instructores" && state.proveedoresLoading) {
      state.modalError = "Espera a que carguen los proveedores.";
      paint();
      return;
    }
    state.modalSaving = true;
    state.modalError = "";
    paint();
    try {
      if (state.activeTab === "categorias" || state.activeTab === "tipos" || state.activeTab === "clasificaciones") {
        const payload = { nombre, descripcion: String(fd.get("descripcion") ?? "").trim() || undefined };
        if (state.modalMode === "create") {
          if (state.activeTab === "categorias") await createCategoria(payload);
          else if (state.activeTab === "tipos") await createTipo(payload);
          else await createClasificacion(payload);
        } else if (state.modalMode === "edit" && state.editingItem) {
          const id = state.editingItem.id;
          if (state.activeTab === "categorias") await updateCategoria(id, payload);
          else if (state.activeTab === "tipos") await updateTipo(id, payload);
          else await updateClasificacion(id, payload);
        }
      } else if (state.activeTab === "instructores") {
        const payload = {
          nombre,
          especialidad: String(fd.get("especialidad") ?? "").trim() || undefined,
          empresa: String(fd.get("empresa") ?? "").trim() || undefined,
        };
        if (state.modalMode === "create") await createInstructorExterno(payload);
        else if (state.modalMode === "edit" && state.editingItem) await updateInstructorExterno(state.editingItem.id, payload);
      } else if (state.activeTab === "proveedores") {
        const payload = {
          nombre,
          contacto: String(fd.get("contacto") ?? "").trim() || undefined,
          telefono: String(fd.get("telefono") ?? "").trim() || undefined,
          email: String(fd.get("email") ?? "").trim() || undefined,
          direccion: String(fd.get("direccion") ?? "").trim() || undefined,
        };
        if (state.modalMode === "create") await createProveedor(payload);
        else if (state.modalMode === "edit" && state.editingItem) await updateProveedor(state.editingItem.id, payload);
      }
      closeModal();
      await load();
    } catch (e: unknown) {
      state.modalSaving = false;
      state.modalError = (e as { detail?: string }).detail ?? "Error al guardar.";
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!state.editingItem) return;
    state.modalSaving = true;
    state.modalError = "";
    paint();
    try {
      const id = state.editingItem.id;
      switch (state.activeTab) {
        case "categorias": await deleteCategoria(id); break;
        case "tipos": await deleteTipo(id); break;
        case "clasificaciones": await deleteClasificacion(id); break;
        case "instructores": await deleteInstructorExterno(id); break;
        case "instructores-int": await deleteInstructorInterno(id); break;
        case "proveedores": await deleteProveedor(id); break;
      }
      closeModal();
      await load();
    } catch (e: unknown) {
      state.modalSaving = false;
      state.modalError = (e as { detail?: string }).detail ?? "No se pudo desactivar.";
      paint();
    }
  }

  // Event delegation
  container.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;

    // Tab clicks
    const tabBtn = t.closest("[data-cat-tab]") as HTMLElement | null;
    if (tabBtn) {
      const newTab = tabBtn.dataset.catTab as TabId;
      if (newTab !== state.activeTab) {
        state.activeTab = newTab;
        state.items = [];
        render();
        void load();
      }
      return;
    }

    // Action buttons
    const actionBtn = t.closest("[data-cat-action]") as HTMLElement | null;
    if (actionBtn) {
      const action = actionBtn.dataset.catAction;
      if (action === "create") {
        if (state.activeTab === "instructores") {
          openInstructorModal("create", null);
        } else if (state.activeTab === "instructores-int") {
          openInstructorInternoModal("create", null);
        } else {
          state.modalMode = "create";
          state.editingItem = null;
          state.modalError = "";
          paint();
        }
        if (state.activeTab !== "instructores-int") {
          container.querySelector<HTMLInputElement>("#cat-nombre")?.focus();
        }
      } else if (action === "edit") {
        const id = Number(actionBtn.dataset.id);
        const item = state.items.find((i) => i.id === id);
        if (!item) return;
        if (state.activeTab === "instructores") {
          openInstructorModal("edit", item as InstructorExterno);
        } else if (state.activeTab === "instructores-int") {
          openInstructorInternoModal("edit", item as InstructorInterno);
        } else {
          state.modalMode = "edit";
          state.editingItem = item;
          state.modalError = "";
          paint();
        }
      } else if (action === "pick-empleado") {
        const empleadoId = Number(actionBtn.dataset.empleadoId);
        if (!empleadoId || Number.isNaN(empleadoId)) return;
        const emp = state.empleadoSearchResults.find((e) => e.empleado_id === empleadoId);
        state.selectedEmpleadoId = empleadoId;
        state.selectedEmpleadoLabel = emp
          ? `${emp.nombre} · ${emp.no_empleado}`
          : `Empleado #${empleadoId}`;
        state.empleadoSearchResults = [];
        state.empleadoSearchQ = "";
        paint();
      } else if (action === "clear-empleado") {
        resetEmpleadoPicker();
        paint();
        container.querySelector<HTMLInputElement>("#cat-empleado-search")?.focus();
      } else if (action === "delete") {
        const id = Number(actionBtn.dataset.id);
        const item = state.items.find((i) => i.id === id);
        if (!item) return;
        state.modalMode = "delete";
        state.editingItem = item;
        state.modalError = "";
        paint();
      } else if (action === "toggle-inactive") {
        state.showInactive = !state.showInactive;
        void load();
      }
      return;
    }

    // Modal buttons
    const modalBtn = t.closest("[data-cat-modal]") as HTMLElement | null;
    if (modalBtn) {
      if (modalBtn.dataset.catModal === "cancel") closeModal();
      if (modalBtn.dataset.catModal === "confirm-delete") void confirmDelete();
      return;
    }
  }, { signal });

  container.addEventListener("input", (ev) => {
    const input = ev.target as HTMLElement;
    if (!input.closest("#cat-empleado-search")) return;
    if (!(input instanceof HTMLInputElement)) return;
    state.empleadoSearchQ = input.value;
    if (empleadoSearchTimer) clearTimeout(empleadoSearchTimer);
    empleadoSearchTimer = setTimeout(() => {
      void searchEmpleados(input.value.trim());
    }, 320);
  }, { signal });

  // Checkbox change (toggle inactive)
  container.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("[data-cat-action='toggle-inactive']")) {
      state.showInactive = (t as HTMLInputElement).checked;
      void load();
    }
  }, { signal });

  // Form submit
  container.addEventListener("submit", (ev) => {
    const form = (ev.target as HTMLElement).closest("#cat-form");
    if (!form) return;
    ev.preventDefault();
    void submitForm(form as HTMLFormElement);
  }, { signal });

  // ESC to close modal
  container.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key === "Escape" && state.modalMode) closeModal();
  }, { signal });

  render();
  void load();
}
