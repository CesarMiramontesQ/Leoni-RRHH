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
import { badgeOpen, badgeInProgress, badgeCancelled } from "../../ui/uiTokens.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_SURFACE,
} from "./rhIncidenciasPageStyles.ts";

function filtrosActivosTabla(vm: RhIncidenciasAdminViewModel): boolean {
  const f = vm.filters;
  const ui = vm.ui;
  const filtroUbicacionOEmpleado = ui.modoFiltros === "rh" ? f.empleado_busqueda.trim() : f.area_id;
  const supervisorCuenta =
    ui.modoFiltros === "estandar" || (ui.modoFiltros === "rh" && ui.mostrarFiltroSupervisor);
  const supActivo = Boolean(supervisorCuenta && f.supervisor_id);
  return Boolean(filtroUbicacionOEmpleado || supActivo || f.tipo || f.estado || f.periodo !== "30d");
}

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
  const text = escapeIncHtml(labelTipo(row.tipo));
  if (row.tipo === "falta_injustificada" || row.tipo === "dano_equipo") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800"><span class="size-1.5 rounded-full bg-red-500" aria-hidden="true"></span>${text}</span>`;
  }
  if (row.tipo === "retardo") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><span class="size-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>${text}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900"><span class="size-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>${text}</span>`;
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
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-700 bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"><span class="size-1.5 shrink-0 rounded-full bg-white/90" aria-hidden="true"></span>${text}</span>`;
  }
  if (p === "alta") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>${text}</span>`;
  }
  if (p === "media") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>${text}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-700"><span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>${text}</span>`;
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
        <p class="truncate text-sm font-semibold text-slate-900">${escapeIncHtml(name)}</p>
        <p class="truncate text-xs text-slate-500">${escapeIncHtml(row.empleado_id)}</p>
      </div>
    </div>`;
}

function renderIncidenciasEmptyState(vm: RhIncidenciasAdminViewModel): string {
  const showClear = filtrosActivosTabla(vm);
  const emptyExtra =
    vm.ui.modoFiltros === "rh" && vm.filters.empleado_busqueda.trim()
      ? `<p class="mt-2 text-xs text-[#667085]">${escapeIncHtml(INC_COPY.tablaVaciaSugerenciaEmpleado)}</p>`
      : "";
  return `
    <section class="${RH_LISTADO_SURFACE} p-8 text-center">
      <div class="mx-auto inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75 4.5 4.5M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /></svg>
      </div>
      <h3 class="mt-4 text-lg font-semibold text-[#111827]">${escapeIncHtml(INC_COPY.tablaVaciaTitulo)}</h3>
      <p class="mt-2 text-sm text-[#667085]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
      ${emptyExtra}
      <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
        ${showClear ? `<button type="button" data-rh-inc-clear-filters class="${RH_LISTADO_BTN_GHOST}">${escapeIncHtml(INC_COPY.limpiarFiltros)}</button>` : ""}
        <button type="button" id="rh-inc-nueva-empty" class="${RH_LISTADO_BTN_PRIMARY}">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z" /></svg>
          ${escapeIncHtml(INC_COPY.nueva)}
        </button>
      </div>
    </section>`;
}

/** Tabla de incidencias, estados vacío/carga/error y pie con paginación (patrón visual alineado con Actas). */
export function renderRhIncidenciasTable(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <section class="animate-pulse ${RH_LISTADO_SURFACE} p-4" aria-busy="true" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="h-5 w-40 rounded bg-slate-200"></div>
        <div class="mt-2 h-4 w-28 rounded bg-slate-100"></div>
        <div class="mt-4 space-y-2">
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
        <div class="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
          ${escapeIncHtml(vm.tableErrorMessage ?? INC_COPY.errorTabla)}
        </div>
        <div class="px-4 py-8 text-center text-sm text-[#667085] sm:px-5">${escapeIncHtml(INC_COPY.sinDatosTrasError)}</div>
      </section>`;
  }

  const tbl = vm.table;
  if (vm.tableStatus === "empty" || !tbl || tbl.total === 0) {
    return renderIncidenciasEmptyState(vm);
  }

  const rows = tbl.items
    .map((row) => {
      const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
      return `
    <tr
      class="cursor-pointer transition-colors hover:bg-slate-50 focus-within:bg-slate-50"
      tabindex="0"
      role="button"
      data-rh-inc-row="1"
      data-rh-inc-id="${row.id}"
    >
      <td class="px-3 py-3.5 align-middle sm:px-4">${celdaEmpleado(row)}</td>
      <td class="whitespace-nowrap px-3 py-3.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeIncHtml(num)}</td>
      <td class="max-w-40 px-3 py-3.5 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeIncHtml(row.area)}">${escapeIncHtml(row.area)}</span>
      </td>
      <td class="px-3 py-3.5 align-middle sm:px-4">${badgeTipoFromRow(row)}</td>
      <td class="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-600 sm:px-4">${escapeIncHtml(fmtFechaCorta(row.fecha))}</td>
      <td class="px-3 py-3.5 align-middle sm:px-4">${badgeEstadoFromRow(row)}</td>
      <td class="px-3 py-3.5 align-middle sm:px-4">${badgePrioridadFromRow(row)}</td>
    </tr>`;
    })
    .join("");

  const th = (
    label: string,
    edge: "first" | "last" | "none" = "none",
  ) =>
    `<th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-[13px] font-semibold text-slate-700 sm:px-4 ${
      edge === "first" ? "rounded-tl-2xl" : edge === "last" ? "rounded-tr-2xl" : ""
    }">${escapeIncHtml(label)}</th>`;

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
  const pageSizeOpts = [5, 10, 25, 50]
    .map((n) => `<option value="${n}" ${n === tbl.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  const visibleRowCount = tbl.items.length;
  const { sectionLayoutCls, bodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(visibleRowCount),
  );

  const mobileCards = tbl.items
    .map((row) => {
      const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
      return `
      <article
        class="rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm transition hover:border-slate-300"
        data-rh-inc-row="1"
        data-rh-inc-id="${row.id}"
        role="button"
        tabindex="0"
      >
        <div class="flex items-start justify-between gap-2">
          ${celdaEmpleado(row)}
          ${badgeEstadoFromRow(row)}
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#667085]">
          <div><dt>${escapeIncHtml(INC_COPY.colNumero)}</dt><dd class="mt-0.5 text-sm font-semibold text-[#111827]">${escapeIncHtml(num)}</dd></div>
          <div><dt>${escapeIncHtml(INC_COPY.colFecha)}</dt><dd class="mt-0.5 text-sm font-semibold text-[#111827]">${escapeIncHtml(fmtFechaCorta(row.fecha))}</dd></div>
          <div><dt>${escapeIncHtml(INC_COPY.colArea)}</dt><dd class="mt-0.5 truncate text-sm text-[#111827]" title="${escapeIncHtml(row.area)}">${escapeIncHtml(row.area)}</dd></div>
          <div><dt>${escapeIncHtml(INC_COPY.colPrioridad)}</dt><dd class="mt-0.5">${badgePrioridadFromRow(row)}</dd></div>
        </dl>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          ${badgeTipoFromRow(row)}
        </div>
      </article>`;
    })
    .join("");

  const footer = `
      <div class="flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            ${escapeIncHtml(INC_COPY.mostrando(from, to, tbl.total))}
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="rh-inc-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">${escapeIncHtml(INC_COPY.registrosPorPagina)}</label>
            <select id="rh-inc-page-size" name="rh-inc-page-size" data-rh-inc-page-size class="rounded-[10px] border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm ${RH_LISTADO_FOCUS_RING}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-start gap-1 sm:justify-end">
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

  return `
    <section class="${sectionLayoutCls} gap-3 overflow-hidden ${RH_LISTADO_SURFACE} p-4" aria-label="${escapeIncHtml(INC_COPY.tablaAria)}">
      <div class="space-y-2 md:hidden">
        ${mobileCards}
      </div>
      <div class="hidden overflow-hidden rounded-t-2xl md:block ${bodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[920px] w-full border-separate border-spacing-0 text-left">
          <thead class="bg-slate-50">
            <tr>
              ${th(INC_COPY.colEmpleado, "first")}
              ${th(INC_COPY.colNumero)}
              ${th(INC_COPY.colArea)}
              ${th(INC_COPY.colTipo)}
              ${th(INC_COPY.colFecha)}
              ${th(INC_COPY.colEstado)}
              ${th(INC_COPY.colPrioridad, "last")}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}
