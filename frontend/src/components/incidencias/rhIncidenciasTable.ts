import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type {
  RhIncidenciasAdminViewModel,
  RhIncidenciaEstadoCodigo,
  RhIncidenciaPrioridadCodigo,
  RhIncidenciaTipoCodigo,
  RhIncidenciaTablaFila,
} from "../../incidencias/rh/types.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../../utils/rhListadoTablaLayout.ts";
import { escapeHtml as escapeIncHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS as INC_FIELD_FOCUS, badgeOpen, badgeInProgress, badgeCancelled } from "../../ui/uiTokens.ts";

function labelTipo(t: RhIncidenciaTipoCodigo): string {
  switch (t) {
    case "falta_injustificada":
      return "Falta injustificada";
    case "retardo":
      return "Retardo";
    case "indisciplina":
      return "Indisciplina";
    case "dano_equipo":
      return "Daño a equipo";
    default:
      return t;
  }
}

function badgeTipoFromRow(row: RhIncidenciaTablaFila): string {
  const inner = escapeIncHtml(labelTipo(row.tipo));
  if (row.tipo === "falta_injustificada" || row.tipo === "dano_equipo") {
    return `<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">${inner}</span>`;
  }
  if (row.tipo === "retardo") {
    return `<span class="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">${inner}</span>`;
  }
  return `<span class="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900">${inner}</span>`;
}

function labelEstado(e: RhIncidenciaEstadoCodigo): string {
  switch (e) {
    case "abierto":
      return "Abierto";
    case "en_investigacion":
      return "En investigación";
    case "cerrado":
      return INC_COPY.estadoCerrada;
    default:
      return e;
  }
}

function badgeEstadoFromRow(row: RhIncidenciaTablaFila): string {
  switch (row.estado) {
    case "abierto":
      return badgeOpen("Abierto");
    case "en_investigacion":
      return badgeInProgress("En investigación");
    case "cerrado":
      return badgeCancelled("Cerrado");
    default:
      return escapeIncHtml(labelEstado(row.estado));
  }
}

function labelPrioridadUpper(p: RhIncidenciaPrioridadCodigo): string {
  switch (p) {
    case "baja":
      return "BAJA";
    case "media":
      return "MEDIA";
    case "alta":
      return "ALTA";
    case "critica":
      return "CRÍTICA";
    default:
      return p;
  }
}

function badgePrioridadFromRow(row: RhIncidenciaTablaFila): string {
  const p = row.prioridad;
  const text = escapeIncHtml(labelPrioridadUpper(p));
  if (p === "critica") {
    return `<span class="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">${text}</span>`;
  }
  if (p === "alta") {
    return `<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-800">${text}</span>`;
  }
  if (p === "media") {
    return `<span class="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-800">${text}</span>`;
  }
  return `<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">${text}</span>`;
}

function celdaEmpleado(row: RhIncidenciaTablaFila): string {
  const name = formatNombreEmpleadoUi(row.empleado_nombre_raw) || INC_COPY.sinNombre;
  const ini = inicialesDesdeNombreDisplay(name);
  const foto = row.foto_url?.trim();
  const avatar = foto
    ? `<img src="${escapeIncHtml(foto)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
    : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeIncHtml(ini)}</span>`;
  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900">${escapeIncHtml(name)}</p>
      </div>
    </div>`;
}

/** Tabla de incidencias, estados vacío/carga/error y pie con paginación. */
export function renderRhIncidenciasTable(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-busy="true" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="flex items-center gap-2.5 px-3 py-8 text-sm text-text-muted sm:px-4">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ${escapeIncHtml(INC_COPY.cargandoTabla)}
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="border-b border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800 sm:px-4" role="alert">
          ${escapeIncHtml(vm.tableErrorMessage ?? INC_COPY.errorTabla)}
        </div>
        <div class="px-3 py-8 text-center text-sm text-slate-500 sm:px-4">${escapeIncHtml(INC_COPY.sinDatosTrasError)}</div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyExtra =
    vm.ui.modoFiltros === "rh" && vm.filters.empleado_busqueda.trim()
      ? `<span class="mt-2 block text-xs text-slate-400">${escapeIncHtml(INC_COPY.tablaVaciaSugerenciaEmpleado)}</span>`
      : "";
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0
      ? `<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-slate-500 sm:px-4">${escapeIncHtml(INC_COPY.tablaVacia)}${emptyExtra}</td></tr>`
      : "";

  const rows =
    tbl && tbl.items.length > 0
      ? tbl.items
          .map((row) => {
            const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
            return `
    <tr
      class="cursor-pointer transition-colors hover:bg-slate-100/90 focus-within:bg-slate-50/90"
      tabindex="0"
      role="button"
      data-rh-inc-row="1"
      data-rh-inc-id="${row.id}"
    >
      <td class="px-3 py-2.5 align-middle sm:px-4">${celdaEmpleado(row)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeIncHtml(num)}</td>
      <td class="max-w-40 px-3 py-2.5 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeIncHtml(row.area)}">${escapeIncHtml(row.area)}</span>
      </td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeTipoFromRow(row)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeIncHtml(fmtFechaCorta(row.fecha))}</td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeEstadoFromRow(row)}</td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgePrioridadFromRow(row)}</td>
    </tr>`;
          })
          .join("")
      : emptyRow;

  const th = (t: string) =>
    `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold text-white sm:px-4 sm:text-sm">${escapeIncHtml(t)}</th>`;

  const footer =
    tbl && tbl.total > 0
      ? (() => {
          const totalPages = Math.max(1, Math.ceil(tbl.total / tbl.page_size) || 1);
          const from = (tbl.page - 1) * tbl.page_size + 1;
          const to = Math.min(tbl.page * tbl.page_size, tbl.total);
          const pages = paginationRange(totalPages, tbl.page);
          const pageButtons = pages
            .map((x) => {
              if (x === "ellipsis") {
                return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
              }
              const active = x === tbl.page;
              const cls = active
                ? "min-h-8 min-w-8 rounded-lg bg-leoni-blue px-2 text-xs font-bold text-white shadow-sm transition hover:bg-leoni-blue-light sm:px-2.5 sm:text-sm"
                : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
              return `<button type="button" data-rh-inc-page="${x}" class="${cls}">${x}</button>`;
            })
            .join("");
          const pageSizeOpts = [5, 10, 25, 50]
            .map((n) => `<option value="${n}" ${n === tbl.page_size ? "selected" : ""}>${n}</option>`)
            .join("");
          return `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            ${escapeIncHtml(INC_COPY.mostrando(from, to, tbl.total))}
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="rh-inc-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">${escapeIncHtml(INC_COPY.registrosPorPagina)}</label>
            <select id="rh-inc-page-size" name="rh-inc-page-size" data-rh-inc-page-size class="rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm ${INC_FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-inc-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">${escapeIncHtml(INC_COPY.anterior)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-inc-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">${escapeIncHtml(INC_COPY.siguiente)}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
        })()
      : tbl
        ? `
      <div class="shrink-0 border-t border-slate-100 px-3 py-2.5 text-center text-sm text-slate-500 sm:px-4">
        ${escapeIncHtml(INC_COPY.mostrandoCero)}
      </div>`
        : "";

  const visibleRowCount = tbl?.items.length ?? 0;
  const { sectionLayoutCls, bodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(visibleRowCount),
  );

  return `
    <section class="${sectionLayoutCls} rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
      <div class="${bodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[920px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr class="text-white">
              ${th(INC_COPY.colEmpleado)}
              ${th(INC_COPY.colNumero)}
              ${th(INC_COPY.colArea)}
              ${th(INC_COPY.colTipo)}
              ${th(INC_COPY.colFecha)}
              ${th(INC_COPY.colEstado)}
              ${th(INC_COPY.colPrioridad)}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}
