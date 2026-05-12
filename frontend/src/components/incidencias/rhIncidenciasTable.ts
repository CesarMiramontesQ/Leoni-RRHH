import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import {
  escapeHtml as escapeIncHtml,
  fmtTablaCelda,
  paginationRange,
} from "../../ui/uiUtils.ts";
import { formatNombreEmpleadoIncidenciasUi } from "../../utils/nombreEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../../utils/rhListadoTablaLayout.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhIncidenciasPageStyles.ts";

/** Cabecera de tabla (mismo patrón que Solicitudes / `.rh-sol-th` en style.css). */
const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-2 py-3 text-[13px] font-semibold tracking-tight text-[#334155] sm:px-3";

function filtrosActivosTabla(vm: RhIncidenciasAdminViewModel): boolean {
  const a = vm.appliedFilters;
  return a.tipo.trim().length > 0 || a.no_empleado.trim().length > 0 || a.nombre.trim().length > 0;
}

function celdaTextoTruncado(val: string, maxLen = 48): string {
  const raw = fmtTablaCelda(val);
  if (raw === "—") return escapeIncHtml("—");
  const t = raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
  return `<span class="block max-w-[14rem] truncate sm:max-w-[18rem]" title="${escapeIncHtml(raw)}">${escapeIncHtml(t)}</span>`;
}

/** Nombre colaborador en listado incidencias: título y orden natural (APELLIDOS, NOMBRE → Nombre Apellidos). */
function nombreEmpleadoIncidenciaTabla(raw: string): string {
  const f = formatNombreEmpleadoIncidenciasUi(raw).trim();
  return f || raw.trim() || "—";
}

function renderIncidenciasEmptyState(vm: RhIncidenciasAdminViewModel): string {
  const showClear = filtrosActivosTabla(vm);
  return `
    <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
      <div class="rh-sol-empty rh-inc-empty--standalone px-4 py-14 sm:px-6" role="status">
        <div class="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.28)] bg-linear-to-br from-[#eff6ff] to-white text-[#2563eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_14px_rgba(15,23,42,0.06)]" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-7"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        </div>
        <p class="rh-sol-empty__title mt-5 text-center text-sm font-semibold text-[#0f172a]">${escapeIncHtml(INC_COPY.tablaVaciaTitulo)}</p>
        <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          ${showClear ? `<button type="button" data-rh-inc-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear">${escapeIncHtml(INC_COPY.limpiarFiltros)}</button>` : ""}
          <button type="button" id="rh-inc-nueva-empty" class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary">
            <span aria-hidden="true">+</span> ${escapeIncHtml(INC_COPY.nueva)}
          </button>
        </div>
      </div>
    </section>`;
}

const COLS = [
  INC_COPY.colNoEmpleado,
  INC_COPY.colNombre,
  INC_COPY.colTipo,
  INC_COPY.colDetalle,
  INC_COPY.colArea,
  INC_COPY.colSubarea,
  INC_COPY.colAcciones,
] as const;

function renderIncTableHeadRow(): string {
  return COLS.map((lab, i) => {
    const align = i === COLS.length - 1 ? "text-right" : "text-left";
    return `<th scope="col" class="${TABLE_TH} ${align}">${escapeIncHtml(lab)}</th>`;
  }).join("");
}

/** Tabla de incidencias, estados vacío/carga/error y pie con paginación (patrón visual alineado con Actas). */
export function renderRhIncidenciasTable(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    const skCell = `<td class="px-2 py-3 sm:px-3"><div class="h-4 animate-pulse rounded-md bg-slate-200/80"></div></td>`;
    const skRow = `<tr class="rh-sol-loading-row">${skCell.repeat(COLS.length)}</tr>`;
    const head = renderIncTableHeadRow();
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
          <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ${escapeIncHtml(INC_COPY.cargandoTabla)}
        </div>
        <div class="overflow-x-auto px-2 pb-3 sm:px-3">
          <table class="min-w-[1000px] w-full text-left">
            <thead class="rh-sol-thead"><tr>${head}</tr></thead>
            <tbody class="divide-y divide-slate-100/80">${skRow.repeat(4)}</tbody>
          </table>
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="border-b border-red-100 bg-linear-to-r from-red-50 to-white px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
          ${escapeIncHtml(vm.tableErrorMessage ?? INC_COPY.errorTabla)}
        </div>
        <div class="rh-sol-table-error-fallback px-4 py-10 text-center sm:px-5">
          <p class="text-sm font-medium text-[#334155]">No pudimos mostrar el listado.</p>
          <p class="mt-2 text-xs leading-relaxed text-[#64748b]">${escapeIncHtml(INC_COPY.sinDatosTrasError)}</p>
        </div>
      </section>`;
  }

  const tbl = vm.table;
  if (vm.tableStatus === "empty" || !tbl || tbl.total === 0) {
    return renderIncidenciasEmptyState(vm);
  }

  const rows = tbl.items
    .map((row) => {
      const tipoUi = labelTipoIncidenciaUi((row.tipo_texto ?? row.tipo).trim() || String(row.tipo));
      return `
    <tr class="rh-sol-data-row transition-colors">
      <td class="whitespace-nowrap px-2 py-2 align-middle text-sm text-slate-700 sm:px-3">${escapeIncHtml(fmtTablaCelda(row.no_empleado))}</td>
      <td class="max-w-[12rem] px-2 py-2 align-middle text-sm text-slate-800 sm:px-3">${celdaTextoTruncado(nombreEmpleadoIncidenciaTabla(row.empleado_nombre_raw), 36)}</td>
      <td class="max-w-[10rem] px-2 py-2 align-middle text-sm text-slate-800 sm:px-3">${celdaTextoTruncado(tipoUi, 40)}</td>
      <td class="max-w-[14rem] px-2 py-2 align-middle text-sm text-slate-700 sm:px-3">${celdaTextoTruncado(fmtTablaCelda(row.detalle), 80)}</td>
      <td class="max-w-[10rem] px-2 py-2 align-middle text-sm text-slate-700 sm:px-3">${celdaTextoTruncado(fmtTablaCelda(row.area), 32)}</td>
      <td class="max-w-[10rem] px-2 py-2 align-middle text-sm text-slate-700 sm:px-3">${celdaTextoTruncado(fmtTablaCelda(row.subarea), 32)}</td>
      <td class="whitespace-nowrap px-2 py-2 align-middle text-right sm:px-3">
        <button type="button" class="${RH_LISTADO_BTN_GHOST} px-2.5 py-1.5 text-xs font-semibold" data-rh-inc-ver="1" data-rh-inc-id="${row.id}">
          ${escapeIncHtml(INC_COPY.accionVer)}
        </button>
      </td>
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
      return `<button type="button" data-rh-inc-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const footer = `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <p class="text-xs font-medium text-slate-600 sm:text-sm">
          ${escapeIncHtml(INC_COPY.mostrando(from, to, tbl.total))}
          <span class="mt-1 block text-[11px] font-normal text-slate-500 sm:mt-0 sm:inline sm:before:content-['_·_']">Máximo 10 registros por página.</span>
        </p>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-inc-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">${escapeIncHtml(INC_COPY.anterior)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-inc-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">${escapeIncHtml(INC_COPY.siguiente)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;

  const visibleRowCount = tbl.items.length;
  const { sectionLayoutCls, bodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(visibleRowCount),
  );

  const headRow = renderIncTableHeadRow();

  const mobileCards = tbl.items
    .map((row) => {
      const tipoUi = labelTipoIncidenciaUi((row.tipo_texto ?? row.tipo).trim() || String(row.tipo));
      return `
      <article
        class="rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition hover:border-[rgba(100,116,139,0.35)]"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <p class="min-w-0 flex-1 truncate text-sm font-bold text-[#0f172a]">${escapeIncHtml(nombreEmpleadoIncidenciaTabla(row.empleado_nombre_raw))}</p>
        </div>
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#667085]">
          <div><dt>${escapeIncHtml(INC_COPY.colNoEmpleado)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeIncHtml(fmtTablaCelda(row.no_empleado))}</dd></div>
          <div class="col-span-2"><dt>${escapeIncHtml(INC_COPY.colTipo)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${celdaTextoTruncado(tipoUi, 80)}</dd></div>
          <div class="col-span-2"><dt>${escapeIncHtml(INC_COPY.colDetalle)}</dt><dd class="mt-0.5 line-clamp-2 font-semibold text-[#111827]">${escapeIncHtml(fmtTablaCelda(row.detalle))}</dd></div>
          <div><dt>${escapeIncHtml(INC_COPY.colArea)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeIncHtml(fmtTablaCelda(row.area))}</dd></div>
          <div><dt>${escapeIncHtml(INC_COPY.colSubarea)}</dt><dd class="mt-0.5 font-semibold text-[#111827]">${escapeIncHtml(fmtTablaCelda(row.subarea))}</dd></div>
        </dl>
        <div class="mt-3 flex justify-end">
          <button type="button" class="${RH_LISTADO_BTN_GHOST} px-2.5 py-1.5 text-xs font-semibold" data-rh-inc-ver="1" data-rh-inc-id="${row.id}">
            ${escapeIncHtml(INC_COPY.accionVer)}
          </button>
        </div>
      </article>`;
    })
    .join("");

  return `
    <section class="rh-sol-table-section ${sectionLayoutCls} ${RH_LISTADO_SURFACE}" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
      <div class="space-y-2 p-3 md:hidden sm:p-4">
        ${mobileCards}
      </div>
      <div class="${bodyWrapCls} hidden md:block">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[1000px] w-full text-left">
          <thead class="rh-sol-thead">
            <tr>${headRow}</tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80 bg-white">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}
