import { escapeHtml } from "./html.ts";
import { paginationRange } from "../../ui/uiUtils.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { VISTA360_PAGE_SIZE } from "../../api/vista360Tablas.ts";

export type Vista360TablaColumn = {
  key: string;
  label: string;
  cellClass?: string;
};

export type Vista360TablaRow = Record<string, string | number | null | undefined>;

export type Vista360TablaPagination = {
  page: number;
  total: number;
  pageSize: number;
};

const TABLE_TH =
  "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:px-4";

function th(label: string): string {
  return `<th scope="col" class="${TABLE_TH}">${escapeHtml(label)}</th>`;
}

export function renderVista360TablaEmpty(message: string, hint?: string): string {
  return `
    <div class="rh-sol-empty rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 px-6 py-14 text-center" role="status">
      <p class="text-sm font-semibold text-text-primary">${escapeHtml(message)}</p>
      ${
        hint
          ? `<p class="mx-auto mt-2 max-w-md text-sm text-text-muted">${escapeHtml(hint)}</p>`
          : ""
      }
    </div>`;
}

export function renderVista360TablaLoading(): string {
  return `
    <div class="animate-pulse overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm" aria-busy="true">
      <div class="space-y-0 divide-y divide-slate-100">
        ${Array.from({ length: VISTA360_PAGE_SIZE })
          .map(
            () => `
          <div class="flex gap-4 px-4 py-4">
            <div class="h-4 flex-1 rounded bg-slate-100"></div>
            <div class="h-4 w-24 rounded bg-slate-100"></div>
            <div class="h-4 w-20 rounded bg-slate-100"></div>
          </div>`,
          )
          .join("")}
      </div>
    </div>`;
}

export function renderVista360TablaError(message: string): string {
  return `
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm" role="alert">
      ${escapeHtml(message)}
    </div>`;
}

function renderPaginationFooter(p: Vista360TablaPagination, tabId: string): string {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize) || 1);
  const from = p.total === 0 ? 0 : (p.page - 1) * p.pageSize + 1;
  const to = Math.min(p.page * p.pageSize, p.total);
  const pages = paginationRange(totalPages, p.page);
  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500">…</span>`;
      }
      const active = x === p.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-leoni-blue px-2 text-xs font-bold text-white shadow-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";
      return `<button type="button" data-v360-tabla-page="${tabId}" data-v360-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  return `
    <footer class="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        Mostrando <span class="font-semibold text-slate-800">${from}–${to}</span> de
        <span class="font-semibold text-slate-800">${p.total}</span>
        <span class="mt-1 block text-[11px] font-normal text-slate-500 sm:mt-0 sm:inline sm:before:content-['_·_']">5 registros por página</span>
      </p>
      <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
        <button type="button" data-v360-tabla-page="${tabId}" data-v360-page="${p.page - 1}" ${
          p.page <= 1 ? "disabled" : ""
        }
          class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          aria-label="Página anterior">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.25-4.25a.75.75 0 0 1 0-1.08l4.25-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
        </button>
        ${pageButtons}
        <button type="button" data-v360-tabla-page="${tabId}" data-v360-page="${p.page + 1}" ${
          p.page >= totalPages ? "disabled" : ""
        }
          class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          aria-label="Página siguiente">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
        </button>
      </div>
    </footer>`;
}

export function renderVista360Tabla(
  tabId: string,
  columns: Vista360TablaColumn[],
  rows: Vista360TablaRow[],
  pagination: Vista360TablaPagination,
): string {
  if (rows.length === 0) {
    return renderVista360TablaEmpty(
      "Sin registros para mostrar",
      "Este empleado aún no tiene entradas en esta sección.",
    );
  }

  const head = columns.map((c) => th(c.label)).join("");
  const body = rows
    .map((row) => {
      const tds = columns
        .map((c) => {
          const raw = row[c.key];
          const text = raw === null || raw === undefined ? "—" : String(raw);
          const cls = c.cellClass ?? "px-3 py-3 text-sm text-slate-700 sm:px-4";
          return `<td class="${cls}">${escapeHtml(text)}</td>`;
        })
        .join("");
      return `<tr class="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80">${tds}</tr>`;
    })
    .join("");

  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" data-v360-tabla-section="${tabId}">
      <div class="overflow-x-auto">
        <table class="min-w-full w-full text-left">
          <thead class="border-b border-slate-100 bg-slate-50/90">
            <tr>${head}</tr>
          </thead>
          <tbody class="bg-white">${body}</tbody>
        </table>
      </div>
      ${renderPaginationFooter(pagination, tabId)}
    </section>`;
}

/** Contenedor vacío que se rellena al cargar datos del tab. */
export function renderVista360TablaMount(tabId: string): string {
  return `<div id="v360-tabla-host-${tabId}" data-v360-tabla-host="${tabId}" class="min-h-[12rem]"></div>`;
}
