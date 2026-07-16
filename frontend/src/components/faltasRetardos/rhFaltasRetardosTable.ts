import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  badgeClassFaltaRetardoTipo,
  formatFaltaRetardoFechas,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { filtrosFaltasRetardosActivos } from "../../faltasRetardos/rh/faltasRetardosFilterHelpers.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import {
  escapeHtml,
  fmtFechaCorta,
  fmtTablaCelda,
  paginationRange,
} from "../../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../../utils/rhListadoTablaLayout.ts";
import { RH_LISTADO_BTN_GHOST, RH_LISTADO_SURFACE } from "./rhFaltasRetardosPageStyles.ts";

const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-2 py-3 text-[12px] font-bold uppercase tracking-wide text-[#334155] sm:px-3";

const COLS = [
  FR_COPY.colNoEmpleado,
  FR_COPY.colNombre,
  FR_COPY.colTipo,
  FR_COPY.colFechas,
  FR_COPY.colObservaciones,
  FR_COPY.colRegistrado,
  FR_COPY.colUsuario,
] as const;

function celdaTextoTruncado(val: string, maxLen = 48): string {
  const raw = fmtTablaCelda(val);
  if (raw === "—") return escapeHtml("—");
  const t = raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
  return `<span class="block max-w-[14rem] truncate sm:max-w-[18rem]" title="${escapeHtml(raw)}">${escapeHtml(t)}</span>`;
}

function tipoBadge(tipo: string): string {
  const label = labelFaltaRetardoTipo(tipo as never);
  const cls = badgeClassFaltaRetardoTipo(tipo as never);
  return `<span class="rh-inc-type-pill ${cls}" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

function renderTableHeadRow(): string {
  return COLS.map((lab) => `<th scope="col" class="${TABLE_TH} text-left">${escapeHtml(lab)}</th>`).join("");
}

function renderEmptyState(vm: FaltasRetardosAdminViewModel): string {
  const showClear = filtrosFaltasRetardosActivos(vm.appliedFilters);
  return `
    <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="${escapeHtml(FR_COPY.tablaAria)}">
      <div class="rh-sol-empty rh-inc-empty--standalone px-4 py-14 sm:px-6" role="status">
        <div class="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.28)] bg-linear-to-br from-[#eff6ff] to-white text-[#2563eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_14px_rgba(15,23,42,0.06)]" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-7"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        </div>
        <p class="rh-sol-empty__title mt-5 text-center text-sm font-semibold text-[#0f172a]">${escapeHtml(FR_COPY.tablaVaciaTitulo)}</p>
        <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">${escapeHtml(FR_COPY.tablaVaciaDescripcion)}</p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          ${showClear ? `<button type="button" data-rh-fr-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear">${escapeHtml(FR_COPY.limpiarFiltros)}</button>` : ""}
          <button type="button" id="rh-fr-nueva-empty" class="${RH_LISTADO_BTN_GHOST}">${escapeHtml(FR_COPY.nuevo)}</button>
        </div>
      </div>
    </section>`;
}

export function renderRhFaltasRetardosTable(vm: FaltasRetardosAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    const skCell = `<td class="px-2 py-3 sm:px-3"><div class="h-4 animate-pulse rounded-md bg-slate-200/80"></div></td>`;
    const skRow = `<tr class="rh-sol-loading-row">${skCell.repeat(COLS.length)}</tr>`;
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="${escapeHtml(FR_COPY.tablaAria)}">
        <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
          <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ${escapeHtml(FR_COPY.cargandoTabla)}
        </div>
        <div class="overflow-x-auto px-2 pb-3 sm:px-3">
          <table class="min-w-[900px] w-full text-left">
            <thead class="rh-sol-thead"><tr>${renderTableHeadRow()}</tr></thead>
            <tbody class="divide-y divide-slate-100/80">${skRow.repeat(4)}</tbody>
          </table>
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="${escapeHtml(FR_COPY.tablaAria)}">
        <div class="border-b border-red-100 bg-linear-to-r from-red-50 to-white px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? FR_COPY.errorTabla)}
        </div>
        <div class="rh-sol-table-error-fallback px-4 py-10 text-center sm:px-5">
          <p class="text-sm font-medium text-[#334155]">No pudimos mostrar el listado.</p>
          <p class="mt-2 text-xs leading-relaxed text-[#64748b]">${escapeHtml(FR_COPY.sinDatosTrasError)}</p>
        </div>
      </section>`;
  }

  const tbl = vm.table;
  if (vm.tableStatus === "empty" || !tbl || tbl.total === 0) {
    return renderEmptyState(vm);
  }

  const rows = tbl.items
    .map((row) => {
      const nombre = formatNombreEmpleadoUi(row.empleado_nombre ?? "");
      const fechas = formatFaltaRetardoFechas(
        fmtFechaCorta(row.fecha_evento),
        row.fecha_fin ? fmtFechaCorta(row.fecha_fin) : null,
      );
      const registrador = row.registrado_por_nombre
        ? formatNombreEmpleadoUi(row.registrado_por_nombre)
        : "—";
      return `
    <tr
      class="rh-sol-data-row cursor-pointer transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue/40"
      data-rh-fr-detalle-id="${row.id}"
      tabindex="0"
      role="button"
      aria-label="${escapeHtml(FR_COPY.detalleAriaAbrir)}"
    >
      <td class="whitespace-nowrap px-2 py-3 align-middle text-sm text-slate-700 sm:px-3"><span class="rh-inc-noempleado-pill">${escapeHtml(formatNoEmpleadoDisplay(row.numero_empleado))}</span></td>
      <td class="max-w-[12rem] px-2 py-3 align-middle text-sm font-semibold text-slate-900 sm:px-3">${celdaTextoTruncado(nombre, 36)}</td>
      <td class="max-w-[10rem] px-2 py-3 align-middle text-sm sm:px-3">${tipoBadge(row.tipo)}</td>
      <td class="whitespace-nowrap px-2 py-3 align-middle text-sm text-slate-700 sm:px-3">${escapeHtml(fechas)}</td>
      <td class="max-w-[14rem] px-2 py-3 align-middle text-sm text-slate-700 sm:px-3">${celdaTextoTruncado(row.observaciones ?? "", 80)}</td>
      <td class="whitespace-nowrap px-2 py-3 align-middle text-sm text-slate-600 sm:px-3">${escapeHtml(fmtFechaCorta(row.created_at))}</td>
      <td class="max-w-[10rem] px-2 py-3 align-middle text-sm text-slate-700 sm:px-3">${celdaTextoTruncado(registrador, 32)}</td>
    </tr>`;
    })
    .join("");

  const totalPages = Math.max(1, Math.ceil(tbl.total / tbl.page_size) || 1);
  const from = tbl.total === 0 ? 0 : (tbl.page - 1) * tbl.page_size + 1;
  const to = Math.min(tbl.page * tbl.page_size, tbl.total);
  const pages = paginationRange(totalPages, tbl.page);
  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
      }
      const active = x === tbl.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-rh-fr-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const footer = `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <p class="text-xs font-medium text-slate-600 sm:text-sm">
          ${escapeHtml(FR_COPY.mostrando(from, to, tbl.total))}
          <span class="mt-1 block text-[11px] font-normal text-slate-500 sm:mt-0 sm:inline sm:before:content-['_·_']">${escapeHtml(FR_COPY.paginaMaxHint)}</span>
        </p>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-fr-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">${escapeHtml(FR_COPY.anterior)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-fr-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">${escapeHtml(FR_COPY.siguiente)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;

  const { sectionLayoutCls, bodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(tbl.items.length),
  );

  const mobileCards = tbl.items
    .map((row) => {
      const nombre = formatNombreEmpleadoUi(row.empleado_nombre ?? "");
      const fechas = formatFaltaRetardoFechas(
        fmtFechaCorta(row.fecha_evento),
        row.fecha_fin ? fmtFechaCorta(row.fecha_fin) : null,
      );
      return `
      <article
        class="rh-inc-mobile-card cursor-pointer rounded-2xl border border-[rgba(148,163,184,0.22)] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-colors hover:border-[rgba(37,99,235,0.35)] hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
        data-rh-fr-detalle-id="${row.id}"
        tabindex="0"
        role="button"
        aria-label="${escapeHtml(FR_COPY.detalleAriaAbrir)}"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <p class="min-w-0 flex-1 truncate text-sm font-bold text-[#0f172a]">${escapeHtml(nombre)}</p>
          ${tipoBadge(row.tipo)}
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#667085]">
          <div><dt>${escapeHtml(FR_COPY.colNoEmpleado)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeHtml(formatNoEmpleadoDisplay(row.numero_empleado))}</dd></div>
          <div><dt>${escapeHtml(FR_COPY.colFechas)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeHtml(fechas)}</dd></div>
          <div class="col-span-2"><dt>${escapeHtml(FR_COPY.colObservaciones)}</dt><dd class="mt-0.5 line-clamp-2 font-semibold text-[#111827]">${escapeHtml(fmtTablaCelda(row.observaciones ?? ""))}</dd></div>
          <div><dt>${escapeHtml(FR_COPY.colRegistrado)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeHtml(fmtFechaCorta(row.created_at))}</dd></div>
          <div><dt>${escapeHtml(FR_COPY.colUsuario)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeHtml(fmtTablaCelda(row.registrado_por_nombre ?? ""))}</dd></div>
        </dl>
      </article>`;
    })
    .join("");

  return `
    <section class="rh-sol-table-section ${sectionLayoutCls} ${RH_LISTADO_SURFACE}" aria-label="${escapeHtml(FR_COPY.tablaAria)}">
      <div class="space-y-2 p-3 md:hidden sm:p-4">${mobileCards}</div>
      <div class="${bodyWrapCls} hidden md:block">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[900px] w-full text-left">
          <thead class="rh-sol-thead"><tr>${renderTableHeadRow()}</tr></thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80 bg-white">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}
