import type { ViajeLaboralListItem } from "../../api/viajesLaborales.ts";
import { badgeHtmlViajeLaboralEstado, fmtViaticos } from "../../viajesLaborales/rh/constants.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import { filtrosViajesLaboralesActivos } from "../../viajesLaborales/rh/viajesLaboralesFilterHelpers.ts";
import type { ViajesLaboralesAdminViewModel } from "../../viajesLaborales/rh/types.ts";
import { escapeHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { RH_LISTADO_BTN_GHOST, RH_LISTADO_SURFACE } from "./rhViajesLaboralesPageStyles.ts";

const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-2 py-3 text-[12px] font-bold uppercase tracking-wide text-[#334155] sm:px-3";

const ACT_BTN =
  "rh-sol-act-btn inline-flex min-h-8 items-center rounded-md border border-[rgba(148,163,184,0.34)] bg-white px-2 py-1 text-xs font-semibold text-[#334155] transition hover:border-[rgba(37,99,235,0.38)] hover:text-[#2563eb]";

function renderActions(row: ViajeLaboralListItem, vm: ViajesLaboralesAdminViewModel): string {
  const id = row.id;
  const btns: string[] = [];
  const push = (action: string, label: string) => {
    btns.push(
      `<button type="button" class="${ACT_BTN}" data-rh-vl-action="${action}" data-rh-vl-id="${id}">${escapeHtml(label)}</button>`,
    );
  };

  if (row.estado === "borrador") {
    push("editar", VL_COPY.accEditar);
    push("enviar", VL_COPY.accEnviar);
    push("eliminar", VL_COPY.accEliminar);
  } else if (row.estado === "rechazado") {
    push("editar", VL_COPY.accEditar);
    push("enviar", VL_COPY.accReenviar);
    push("ver", VL_COPY.accVer);
  } else if (row.estado === "pendiente") {
    push("ver", VL_COPY.accVer);
    if (vm.canApprove) {
      push("aprobar", VL_COPY.accAprobar);
      push("rechazar", VL_COPY.accRechazar);
    }
    push("cancelar", VL_COPY.accCancelar);
  } else if (row.estado === "aprobado") {
    push("ver", VL_COPY.accVer);
    push("cancelar", VL_COPY.accCancelar);
  } else {
    push("ver", VL_COPY.accVer);
  }

  return `<div class="flex flex-wrap gap-1">${btns.join("")}</div>`;
}

function renderEmptyState(vm: ViajesLaboralesAdminViewModel): string {
  const showClear = filtrosViajesLaboralesActivos(vm.appliedFilters);
  return `
    <section class="${RH_LISTADO_SURFACE} shrink-0 overflow-hidden" aria-label="${escapeHtml(VL_COPY.tablaAria)}">
      <div class="px-4 py-14 text-center sm:px-6">
        <p class="text-sm font-semibold text-[#0f172a]">${escapeHtml(VL_COPY.tablaVaciaTitulo)}</p>
        <p class="mx-auto mt-2 max-w-md text-xs text-[#64748b]">${escapeHtml(VL_COPY.tablaVaciaDescripcion)}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          ${showClear ? `<button type="button" data-rh-vl-clear-filters class="${RH_LISTADO_BTN_GHOST}">${escapeHtml(VL_COPY.limpiarFiltros)}</button>` : ""}
          <button type="button" id="rh-vl-nueva-empty" class="${RH_LISTADO_BTN_GHOST}">${escapeHtml(VL_COPY.nuevo)}</button>
        </div>
      </div>
    </section>`;
}

export function renderRhViajesLaboralesTable(vm: ViajesLaboralesAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `<section class="${RH_LISTADO_SURFACE} px-4 py-8 text-sm text-[#475569] sm:px-5" aria-busy="true">${escapeHtml(VL_COPY.cargandoTabla)}</section>`;
  }
  if (vm.tableStatus === "error") {
    return `<section class="${RH_LISTADO_SURFACE} border-l-4 border-red-400 px-4 py-4 text-sm text-red-800 sm:px-5" role="alert">${escapeHtml(vm.tableErrorMessage ?? VL_COPY.errorTabla)}</section>`;
  }
  const tbl = vm.table;
  if (vm.tableStatus === "empty" || !tbl || tbl.total === 0) {
    return renderEmptyState(vm);
  }

  const rows = tbl.items
    .map((row) => {
      const nombre = formatNombreEmpleadoUi(row.empleado_nombre ?? "");
      const fechas = `${fmtFechaCorta(row.fecha_salida)} – ${fmtFechaCorta(row.fecha_regreso)}`;
      const ruta = `${row.lugar_origen} → ${row.lugar_destino}`;
      return `
      <tr class="rh-sol-data-row">
        <td class="px-2 py-3 text-sm sm:px-3">
          <div class="font-medium text-slate-900">${escapeHtml(nombre)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(formatNoEmpleadoDisplay(row.numero_empleado))}</div>
        </td>
        <td class="whitespace-nowrap px-2 py-3 text-sm text-slate-700 sm:px-3">${escapeHtml(fechas)}</td>
        <td class="max-w-[14rem] truncate px-2 py-3 text-sm text-slate-700 sm:px-3" title="${escapeHtml(ruta)}">${escapeHtml(ruta)}</td>
        <td class="px-2 py-3 text-sm text-slate-700 sm:px-3">${escapeHtml(row.medio_transporte)}</td>
        <td class="whitespace-nowrap px-2 py-3 text-sm text-slate-700 sm:px-3">${escapeHtml(fmtViaticos(row.viaticos_estimados))}</td>
        <td class="px-2 py-3 sm:px-3">${badgeHtmlViajeLaboralEstado(row.estado)}</td>
        <td class="px-2 py-3 sm:px-3">${renderActions(row, vm)}</td>
      </tr>`;
    })
    .join("");

  const { page, page_size: pageSize, total } = tbl;
  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = paginationRange(totalPages, page);
  const pagination = pages
    .map((p) => {
      if (p === "ellipsis") {
        return `<span class="px-1 text-slate-400">…</span>`;
      }
      const active = p === page;
      return `<button type="button" data-rh-vl-page="${p}" class="min-h-8 min-w-8 rounded-md px-2 text-sm font-semibold ${active ? "bg-[#2563eb] text-white" : "text-slate-700 hover:bg-slate-100"}" ${active ? 'aria-current="page"' : ""}>${p}</button>`;
    })
    .join("");

  return `
    <section class="${RH_LISTADO_SURFACE} shrink-0 overflow-hidden" aria-label="${escapeHtml(VL_COPY.tablaAria)}">
      <div class="overflow-x-auto">
        <table class="min-w-[960px] w-full text-left">
          <thead><tr>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colEmpleado)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colFechas)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colRuta)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colTransporte)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colViaticos)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colEstado)}</th>
            <th class="${TABLE_TH}">${escapeHtml(VL_COPY.colAcciones)}</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100/80">${rows}</tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:px-5">
        <p>${escapeHtml(VL_COPY.mostrando(desde, hasta, total))}</p>
        <div class="flex flex-wrap items-center gap-1">${pagination}</div>
      </div>
    </section>`;
}
