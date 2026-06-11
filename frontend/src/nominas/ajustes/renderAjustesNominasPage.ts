/**
 * Página Ajustes de Nóminas (solo RH): autorización para registro de horas extra.
 */

import {
  badgeApproved,
  badgeCancelled,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";
import { escapeHtml, paginationRange } from "../../ui/uiUtils.ts";
import type { AjustesNominasState } from "./types.ts";

const FILTRO_OPTIONS = [
  { id: "todos", label: "Todos" },
  { id: "autorizados", label: "Autorizados" },
  { id: "no_autorizados", label: "No autorizados" },
] as const;

const TABLE_COLUMNS = ["Empleado", "No. empleado", "Área", "Puesto", "Autorización"] as const;

const CHECKBOX_CLS =
  "size-4 rounded border-slate-300 text-leoni-blue focus:ring-2 focus:ring-leoni-blue/40";

function renderHeader(): string {
  return `
    <header class="min-w-0">
      <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Ajustes de Nóminas</h1>
      <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
        Configuración del módulo de Nóminas administrada por Recursos Humanos.
      </p>
    </header>`;
}

function renderFiltersBar(state: AjustesNominasState): string {
  const disabled = state.status === "loading" || state.updating;
  const filtroOptions = FILTRO_OPTIONS.map(
    ({ id, label }) =>
      `<option value="${id}" ${state.filtro === id ? "selected" : ""}>${escapeHtml(label)}</option>`,
  ).join("");

  return `
    <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3">
      <div class="${FILTER_FIELD_WRAP} sm:max-w-xs">
        <label for="aj-he-busqueda" class="${RH_LISTADO_LABEL}">Buscar empleado</label>
        <input
          id="aj-he-busqueda"
          type="search"
          value="${escapeHtml(state.q)}"
          placeholder="Nombre o no. de empleado"
          autocomplete="off"
          class="w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
          ${disabled ? "disabled" : ""}
        />
      </div>
      <div class="${FILTER_FIELD_WRAP} sm:max-w-[14rem]">
        <label for="aj-he-filtro" class="${RH_LISTADO_LABEL}">Estado de autorización</label>
        <div class="grid grid-cols-1">
          <select
            id="aj-he-filtro"
            class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
            ${disabled ? "disabled" : ""}
          >
            ${filtroOptions}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <p class="ml-auto pb-2 text-xs text-text-secondary">
        <span class="font-semibold tabular-nums text-text-primary">${state.totalAutorizados}</span>
        empleados autorizados actualmente
      </p>
    </div>`;
}

function renderRows(state: AjustesNominasState): string {
  if (state.status === "loading") {
    return `<tr><td colspan="${TABLE_COLUMNS.length + 1}" class="px-4 py-10 text-center text-sm text-text-secondary">Cargando empleados…</td></tr>`;
  }
  if (state.status === "error") {
    return `<tr><td colspan="${TABLE_COLUMNS.length + 1}" class="px-4 py-10 text-center text-sm text-red-700">${escapeHtml(state.errorMessage ?? "No se pudo cargar el listado.")}</td></tr>`;
  }
  if (state.items.length === 0) {
    return `<tr><td colspan="${TABLE_COLUMNS.length + 1}" class="px-4 py-10 text-center text-sm text-text-secondary">Sin empleados que coincidan con la búsqueda.</td></tr>`;
  }

  return state.items
    .map((item) => {
      const checked = state.seleccion.has(item.id);
      return `
      <tr class="border-b border-slate-100 transition hover:bg-slate-50/70 ${checked ? "bg-blue-50/50" : ""}" data-aj-he-row="${item.id}">
        <td class="px-3 py-3">
          <input
            type="checkbox"
            data-aj-he-check="${item.id}"
            class="${CHECKBOX_CLS}"
            aria-label="Seleccionar a ${escapeHtml(item.nombre)}"
            ${checked ? "checked" : ""}
            ${state.updating ? "disabled" : ""}
          />
        </td>
        <td class="px-3 py-3 text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</td>
        <td class="px-3 py-3 text-sm tabular-nums text-text-secondary">${escapeHtml(item.no_empleado)}</td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(item.area_descripcion ?? "—")}</td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(item.puesto_descripcion ?? "—")}</td>
        <td class="px-3 py-3">${item.autorizado ? badgeApproved("Autorizado") : badgeCancelled("No autorizado")}</td>
      </tr>`;
    })
    .join("");
}

function renderPagination(state: AjustesNominasState): string {
  if (state.status !== "ready" || state.items.length === 0) return "";
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const start = (state.page - 1) * state.pageSize + 1;
  const end = start + state.items.length - 1;
  const pages = paginationRange(totalPages, state.page);

  const pageButtons = pages
    .map((entry) => {
      if (entry === "ellipsis") {
        return `<span class="inline-flex size-8 items-center justify-center text-xs text-text-muted">…</span>`;
      }
      const isActive = entry === state.page;
      const cls = isActive
        ? "border-leoni-blue bg-leoni-blue text-white"
        : "cursor-pointer border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue";
      return `<button type="button" data-aj-he-page="${entry}" class="inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${cls}" aria-label="Página ${entry}" ${isActive ? 'aria-current="page"' : ""}>${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p class="text-xs text-text-secondary">
        Mostrando <span class="font-semibold tabular-nums text-text-primary">${start}-${end}</span> de
        <span class="font-semibold tabular-nums text-text-primary">${state.total}</span> empleados
      </p>
      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button type="button" data-aj-he-page="${state.page - 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior" ${state.page <= 1 ? "disabled" : ""}>‹</button>
        ${pageButtons}
        <button type="button" data-aj-he-page="${state.page + 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente" ${state.page >= totalPages ? "disabled" : ""}>›</button>
      </nav>
    </div>`;
}

function renderSelectionActions(state: AjustesNominasState): string {
  const count = state.seleccion.size;
  const disabled = count === 0 || state.updating;
  return `
    <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p class="text-sm text-text-secondary" aria-live="polite">
        <span class="font-semibold tabular-nums text-text-primary">${count}</span>
        ${count === 1 ? "empleado seleccionado" : "empleados seleccionados"}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" id="aj-he-revocar" class="${BTN_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50" ${disabled ? "disabled" : ""}>
          Retirar autorización
        </button>
        <button type="button" id="aj-he-autorizar" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50" ${disabled ? "disabled" : ""}>
          ${state.updating ? "Guardando…" : "Autorizar seleccionados"}
        </button>
      </div>
    </div>`;
}

function renderMensajes(state: AjustesNominasState): string {
  const success = state.successMessage
    ? `<p class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900" role="status">${escapeHtml(state.successMessage)}</p>`
    : "";
  const error =
    state.status === "ready" && state.errorMessage
      ? `<p class="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800" role="alert">${escapeHtml(state.errorMessage)}</p>`
      : "";
  return success + error;
}

function renderAutorizacionSection(state: AjustesNominasState): string {
  const allChecked =
    state.items.length > 0 && state.items.every((item) => state.seleccion.has(item.id));
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="aj-he-titulo">
      <div class="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div class="min-w-0">
          <h2 id="aj-he-titulo" class="text-base font-semibold text-text-primary">Autorización para registro de horas extra</h2>
          <p class="mt-1 text-sm leading-relaxed text-text-secondary">
            Selecciona a los empleados que pueden capturar solicitudes de horas extra para sus equipos.
            Los empleados sin autorización no podrán registrar horas extra.
          </p>
        </div>
        ${renderMensajes(state)}
        ${renderFiltersBar(state)}
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
              <th scope="col" class="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  id="aj-he-check-todos"
                  class="${CHECKBOX_CLS}"
                  aria-label="Seleccionar empleados de la página"
                  ${allChecked ? "checked" : ""}
                  ${state.status !== "ready" || state.items.length === 0 || state.updating ? "disabled" : ""}
                />
              </th>
              ${TABLE_COLUMNS.map(
                (col) =>
                  `<th scope="col" class="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap">${col}</th>`,
              ).join("")}
            </tr>
          </thead>
          <tbody id="aj-he-table-body">
            ${renderRows(state)}
          </tbody>
        </table>
      </div>
      ${renderSelectionActions(state)}
      ${renderPagination(state)}
    </section>`;
}

export function renderAjustesNominasPage(state: AjustesNominasState): string {
  return `
    <div id="ajustes-nominas-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderHeader()}
        ${renderAutorizacionSection(state)}
      </div>
    </div>`;
}
