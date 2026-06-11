/**
 * Página Ajustes de Nóminas (solo RH): administración de empleados
 * autorizados para registrar horas extra.
 */

import {
  badgeApproved,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
} from "../../ui/uiTokens.ts";
import { escapeHtml, paginationRange } from "../../ui/uiUtils.ts";
import type { AjustesNominasModalState, AjustesNominasState } from "./types.ts";

const TABLE_COLUMNS = [
  "Empleado",
  "Área / Puesto",
  "Fecha de autorización",
  "Autorizado por",
  "Estado",
  "Acciones",
] as const;

const CHECKBOX_CLS =
  "size-4 rounded border-slate-300 text-leoni-blue focus:ring-2 focus:ring-leoni-blue/40";

const SEARCH_INPUT_CLS =
  "w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm";

function formatFechaAutorizacion(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderHeader(state: AjustesNominasState): string {
  const disabled = state.status === "loading" || state.revokingId !== null;
  return `
    <header class="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Ajustes de Nóminas</h1>
        <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Administra a los empleados autorizados para registrar horas extra de sus equipos.
        </p>
      </div>
      <button type="button" id="aj-he-abrir-modal" class="${BTN_PRIMARY} shrink-0 disabled:cursor-not-allowed disabled:opacity-50" ${disabled ? "disabled" : ""}>
        Autorizar empleados
      </button>
    </header>`;
}

function renderStatCard(opts: {
  label: string;
  value: number | null;
  hint?: string;
  tone: "default" | "success" | "muted" | "info";
}): string {
  const tones: Record<typeof opts.tone, string> = {
    default: "border-[rgba(148,163,184,0.22)] from-white to-[#f8fbff]",
    success: "border-emerald-200/80 from-emerald-50/40 to-white",
    muted: "border-slate-200/80 from-slate-50/60 to-white",
    info: "border-blue-200/80 from-blue-50/40 to-white",
  };
  const value =
    opts.value === null
      ? `<span class="text-text-muted">…</span>`
      : `${opts.value}`;
  return `
    <div class="rounded-[14px] border bg-linear-to-br p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${tones[opts.tone]}">
      <p class="text-xs font-semibold uppercase tracking-wide text-[#64748b]">${escapeHtml(opts.label)}</p>
      <p class="mt-2 text-2xl font-bold tabular-nums text-[#0f172a]">${value}</p>
      ${opts.hint ? `<p class="mt-1 text-[11px] text-text-muted">${escapeHtml(opts.hint)}</p>` : ""}
    </div>`;
}

function renderStats(state: AjustesNominasState): string {
  const stats = state.stats;
  return `
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Estadísticas de autorización de horas extra">
      ${renderStatCard({
        label: "Total de empleados autorizados",
        value: stats?.total_autorizados ?? null,
        tone: "default",
      })}
      ${renderStatCard({
        label: "Autorizaciones activas",
        value: stats?.autorizaciones_activas ?? null,
        hint: "Empleados con estado laboral activo",
        tone: "success",
      })}
      ${renderStatCard({
        label: "Empleados sin autorización",
        value: stats?.sin_autorizacion ?? null,
        tone: "muted",
      })}
      ${renderStatCard({
        label: "Últimas autorizaciones",
        value: stats?.autorizaciones_recientes ?? null,
        hint: "Otorgadas en los últimos 7 días",
        tone: "info",
      })}
    </section>`;
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

function renderRows(state: AjustesNominasState): string {
  const colspan = TABLE_COLUMNS.length;
  if (state.status === "loading") {
    return `<tr><td colspan="${colspan}" class="px-4 py-10 text-center text-sm text-text-secondary">Cargando empleados autorizados…</td></tr>`;
  }
  if (state.status === "error") {
    return `<tr><td colspan="${colspan}" class="px-4 py-10 text-center text-sm text-red-700">${escapeHtml(state.errorMessage ?? "No se pudo cargar el listado.")}</td></tr>`;
  }
  if (state.items.length === 0) {
    const vacio = state.q.trim()
      ? "Sin empleados autorizados que coincidan con la búsqueda."
      : "Aún no hay empleados autorizados para registrar horas extra.";
    return `<tr><td colspan="${colspan}" class="px-4 py-10 text-center text-sm text-text-secondary">${vacio}</td></tr>`;
  }

  return state.items
    .map((item) => {
      const revoking = state.revokingId === item.id;
      const areaPuesto = [item.area_descripcion, item.puesto_descripcion]
        .filter(Boolean)
        .join(" · ");
      return `
      <tr class="border-b border-slate-100 transition hover:bg-slate-50/70" data-aj-he-row="${item.id}">
        <td class="px-3 py-3">
          <p class="text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</p>
          <p class="mt-0.5 text-xs tabular-nums text-text-muted">${escapeHtml(item.no_empleado)}</p>
        </td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(areaPuesto || "—")}</td>
        <td class="px-3 py-3 text-sm tabular-nums text-text-secondary">${escapeHtml(formatFechaAutorizacion(item.fecha_autorizacion))}</td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(item.autorizado_por ?? "—")}</td>
        <td class="px-3 py-3">${badgeApproved("Activa")}</td>
        <td class="px-3 py-3">
          <button
            type="button"
            data-aj-he-revocar="${item.id}"
            class="${BTN_GHOST} px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            ${state.revokingId !== null ? "disabled" : ""}
          >
            ${revoking ? "Retirando…" : "Retirar autorización"}
          </button>
        </td>
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
        <span class="font-semibold tabular-nums text-text-primary">${state.total}</span> empleados autorizados
      </p>
      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button type="button" data-aj-he-page="${state.page - 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior" ${state.page <= 1 ? "disabled" : ""}>‹</button>
        ${pageButtons}
        <button type="button" data-aj-he-page="${state.page + 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente" ${state.page >= totalPages ? "disabled" : ""}>›</button>
      </nav>
    </div>`;
}

function renderTablaAutorizados(state: AjustesNominasState): string {
  const disabled = state.status === "loading";
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="aj-he-titulo">
      <div class="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div class="min-w-0">
          <h2 id="aj-he-titulo" class="text-base font-semibold text-text-primary">Empleados autorizados</h2>
          <p class="mt-1 text-sm leading-relaxed text-text-secondary">
            Listado de empleados con autorización vigente para capturar solicitudes de horas extra.
          </p>
        </div>
        ${renderMensajes(state)}
        <div class="${FILTER_FIELD_WRAP} sm:max-w-xs">
          <label for="aj-he-busqueda" class="${RH_LISTADO_LABEL}">Buscar en autorizados</label>
          <input
            id="aj-he-busqueda"
            type="search"
            value="${escapeHtml(state.q)}"
            placeholder="Nombre, no. empleado, correo, área o puesto"
            autocomplete="off"
            class="${SEARCH_INPUT_CLS} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
            ${disabled ? "disabled" : ""}
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
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
      ${renderPagination(state)}
    </section>`;
}

function renderModalResultados(modal: AjustesNominasModalState): string {
  if (modal.searching) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Buscando empleados…</p>`;
  }
  if (!modal.searched) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Escribe un nombre, no. de empleado, correo, área o puesto para buscar empleados disponibles.</p>`;
  }
  if (modal.results.length === 0) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Sin empleados disponibles que coincidan con la búsqueda.</p>`;
  }

  const rows = modal.results
    .map((emp) => {
      const checked = modal.seleccionados.has(emp.id);
      const detalle = [emp.no_empleado, emp.puesto_descripcion, emp.area_descripcion, emp.email]
        .filter(Boolean)
        .join(" · ");
      return `
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${checked ? "border-leoni-blue/50 bg-blue-50/60" : "border-slate-200 bg-white hover:border-leoni-blue/30 hover:bg-slate-50"}">
        <input
          type="checkbox"
          data-aj-he-modal-check="${emp.id}"
          class="${CHECKBOX_CLS} mt-0.5"
          ${checked ? "checked" : ""}
          ${modal.submitting ? "disabled" : ""}
        />
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
          <span class="block truncate text-xs text-text-muted">${escapeHtml(detalle)}</span>
        </span>
      </label>`;
    })
    .join("");

  return `<div class="grid gap-2" role="listbox" aria-label="Resultados de búsqueda">${rows}</div>`;
}

function renderModalSeleccionados(modal: AjustesNominasModalState): string {
  if (modal.seleccionados.size === 0) {
    return `<p class="text-xs text-text-muted">Aún no has seleccionado empleados.</p>`;
  }
  const chips = [...modal.seleccionados.values()]
    .map(
      (emp) => `
      <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-900">
        <span class="truncate">${escapeHtml(emp.nombre)}</span>
        <button
          type="button"
          data-aj-he-modal-quitar="${emp.id}"
          class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-200/70"
          aria-label="Quitar a ${escapeHtml(emp.nombre)}"
          ${modal.submitting ? "disabled" : ""}
        >×</button>
      </span>`,
    )
    .join("");
  return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
}

function renderModal(state: AjustesNominasState): string {
  const modal = state.modal;
  if (!modal) return "";
  const count = modal.seleccionados.size;
  const confirmDisabled = count === 0 || modal.submitting;

  return `
    <div id="aj-he-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aj-he-modal-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div class="min-w-0">
            <h2 id="aj-he-modal-titulo" class="text-lg font-semibold text-text-primary">Autorizar empleados</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Busca y selecciona a los empleados que podrán registrar horas extra. Los empleados ya autorizados no aparecen en los resultados.
            </p>
          </div>
          <button type="button" id="aj-he-modal-cerrar" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar" ${modal.submitting ? "disabled" : ""}>
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <label for="aj-he-modal-busqueda" class="${RH_LISTADO_LABEL}">Buscar empleados disponibles</label>
          <input
            id="aj-he-modal-busqueda"
            type="search"
            value="${escapeHtml(modal.q)}"
            placeholder="Nombre, no. empleado, correo, área o puesto"
            autocomplete="off"
            class="${SEARCH_INPUT_CLS} ${FIELD_FOCUS}"
            ${modal.submitting ? "disabled" : ""}
          />
          ${
            modal.errorMessage
              ? `<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">${escapeHtml(modal.errorMessage)}</p>`
              : ""
          }
          <div class="mt-4">
            ${renderModalResultados(modal)}
          </div>
          <div class="mt-5 border-t border-slate-100 pt-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted" aria-live="polite">
              Seleccionados (${count})
            </p>
            ${renderModalSeleccionados(modal)}
          </div>
        </div>
        <footer class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" id="aj-he-modal-cancelar" class="${BTN_SECONDARY}" ${modal.submitting ? "disabled" : ""}>Cancelar</button>
          <button type="button" id="aj-he-modal-confirmar" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50" ${confirmDisabled ? "disabled" : ""}>
            ${modal.submitting ? "Autorizando…" : "Confirmar autorización"}
          </button>
        </footer>
      </div>
    </div>`;
}

export function renderAjustesNominasPage(state: AjustesNominasState): string {
  return `
    <div id="ajustes-nominas-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderHeader(state)}
        ${renderStats(state)}
        ${renderTablaAutorizados(state)}
      </div>
      ${renderModal(state)}
    </div>`;
}
