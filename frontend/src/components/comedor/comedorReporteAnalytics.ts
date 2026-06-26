import { hasRhOperativeViewerContext } from "../../auth/jwt.ts";
import type { ComedorRhProximoRegistroRow } from "../../comedor/rh/types.ts";
import type { ReporteComedorViewState } from "../../comedor/reportes/types.ts";
import {
  aggregateByArea,
  aggregateByComedor,
  aggregateByEmpleado,
  diasEnPeriodoCalendario,
  filterPorAreaSeleccion,
  filterPorComedorSeleccion,
  filterProximosPorRango,
  reporteAreaFilterOptions,
  type ReporteAggArea,
  type ReporteAggComedor,
  type ReporteAggEmpleado,
} from "../../comedor/reportes/reporteAggregations.ts";
import {
  BTN_PRIMARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_SURFACE,
  RH_SURFACE_CARD,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";
import {
  estadoAccesoBadgeRhRegistro,
  formatFechaServicioRhRegistro,
  tipoComidaBadgeRhRegistro,
} from "./comedorRhProximosRegistrosTable.ts";
import { COMEDOR_TABLE_TH, escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

const REPORTE_DETALLE_PAGE_SIZE = 10;

const REPORTE_SEARCH_ICON = `<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg></span>`;

const RANKING_ICON = `<span class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white shadow-sm text-leoni-blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-[18px]"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 3.75c0-.621.504-1.125 1.125-1.125h2.25C20.496 2.625 21 3.129 21 3.75v16.5c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V3.75Z"/></svg></span>`;

function costoNoDisponibleBadge(): string {
  return `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">No disponible</span>`;
}

function formatIsoShort(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function barPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.min(100, (value / max) * 100));
}

function emptyBlock(title: string, body: string): string {
  return `
    <div class="rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-br from-slate-50/95 to-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-900/[0.04]">
      <div class="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-6 text-slate-400" aria-hidden="true">
          <path d="M9 17v-6m3 4v-4m3 5v-9M5 3h14a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V5a2 2 0 0 1 2-2Z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="text-sm font-semibold text-slate-900">${escapeComedorHtml(title)}</p>
      <p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-600">${escapeComedorHtml(body)}</p>
    </div>`;
}

/** Filas operativas del periodo y filtros globales (comedor / área). */
export function reporteOperativoRowsScoped(state: ReporteComedorViewState): readonly ComedorRhProximoRegistroRow[] {
  const base = filterProximosPorRango(
    state.rhAnalyticsRows,
    state.selectedFechaInicioIso,
    state.selectedFechaFinIso,
  );
  const byComedor = filterPorComedorSeleccion(base, comedorLabelFromState(state));
  return filterPorAreaSeleccion(byComedor, state.selectedAreaFilter);
}

/** Mismas filas que la tabla de detalle, ordenadas por fecha e id (sin paginación). */
export function reporteDetalleRowsSorted(state: ReporteComedorViewState): readonly ComedorRhProximoRegistroRow[] {
  const scoped = reporteOperativoRowsScoped(state);
  return [...scoped].sort((a, b) => {
    const fa = (a.fecha_servicio ?? "").toString().slice(0, 10);
    const fb = (b.fecha_servicio ?? "").toString().slice(0, 10);
    const c = fa.localeCompare(fb);
    return c !== 0 ? c : a.id - b.id;
  });
}

function comedorLabelFromState(state: ReporteComedorViewState): string | null {
  if (state.selectedDepartamentoId === "todos") return null;
  const opt = state.filtersDataset.departamentos.find((d) => d.id === state.selectedDepartamentoId);
  return opt?.label.trim() ? opt.label.trim() : null;
}

export function renderReporteRhRestrictedNotice(): string {
  return emptyBlock(
    "Desglose no disponible para tu rol",
    "Las vistas detalladas usan el listado operativo de RH. Como gerente o director puedes revisar los KPIs globales del comedor en esta misma pantalla.",
  );
}

export function renderReporteTabComedor(state: ReporteComedorViewState): string {
  if (state.rhAnalyticsState === "loading") {
    return `<div class="animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="h-6 w-48 rounded bg-slate-100"></div>
      <div class="h-28 rounded-xl bg-slate-100"></div>
    </div>`;
  }
  if (state.rhAnalyticsState === "error") {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">${escapeComedorHtml(state.rhAnalyticsError ?? "Error al cargar datos operativos.")}</div>`;
  }
  const rowsAll = reporteOperativoRowsScoped(state);
  const needle = state.tabSearchComedor.trim().toLowerCase();
  const aggAll = aggregateByComedor(rowsAll);
  const agg = needle ?
    aggAll.filter((g) => g.comedorNombre.toLowerCase().includes(needle))
  : aggAll;
  const maxReg = agg[0]?.registros ?? 0;
  const top5 = agg.slice(0, 5);

  if (agg.length === 0) {
    return emptyBlock(
      "No hay registros de comedor en el periodo seleccionado.",
      "Prueba cambiando el rango de fechas o los filtros.",
    );
  }

  const chart = `
    <div class="${RH_SURFACE_CARD} p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
      <div class="flex flex-wrap items-start gap-3">
        ${RANKING_ICON}
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Ranking por volumen</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">Comedores</p>
          <p class="mt-0.5 text-xs text-slate-600">${escapeComedorHtml(formatIsoShort(state.selectedFechaInicioIso))} — ${escapeComedorHtml(formatIsoShort(state.selectedFechaFinIso))}</p>
        </div>
      </div>
      <div class="mt-5 space-y-3">
        ${top5
          .map((g) => {
            const pct = barPercent(g.registros, maxReg);
            return `<div class="motion-safe:transition-colors motion-safe:duration-150 space-y-2 rounded-lg px-2 py-1.5 hover:bg-slate-50/90">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="min-w-0 truncate font-semibold text-slate-800">${escapeComedorHtml(g.comedorNombre)}</span>
                <span class="shrink-0 tabular-nums font-bold text-slate-900">${g.registros}</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-900/[0.04]">
                <div class="h-2.5 rounded-full bg-gradient-to-r from-[#1e40af] to-sky-400 motion-safe:transition-all motion-safe:duration-200" style="width:${pct}%"></div>
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;

  const tableRows = agg
    .map((g: ReporteAggComedor) => {
      const promedioDia = g.fechasDistintas > 0 ? (g.registros / g.fechasDistintas).toFixed(1) : "0";
      return `<tr class="motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-50/90">
        <td class="px-4 py-3 text-sm font-semibold text-slate-900">${escapeComedorHtml(g.comedorNombre)}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-800">${g.registros}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-emerald-800">${g.confirmados}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-amber-800">${g.pendientes}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-red-800">${g.cancelados}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-800">${g.empleadosUnicos}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">${promedioDia}</td>
        <td class="whitespace-nowrap px-4 py-3">${costoNoDisponibleBadge()}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-5">
      <div class="w-full sm:max-w-md">
        <label class="${RH_LISTADO_LABEL}" for="reporte-buscar-comedor">Buscar comedor</label>
        <div class="relative mt-1.5">
          ${REPORTE_SEARCH_ICON}
          <input
            id="reporte-buscar-comedor"
            type="search"
            value="${escapeComedorHtml(state.tabSearchComedor)}"
            data-comedor-reporte-tab-search-comedor
            placeholder="Buscar comedor"
            class="min-h-10 w-full rounded-[10px] border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
          />
        </div>
      </div>
      ${chart}
      <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="-mx-px overflow-x-auto">
          <table class="min-w-[880px] w-full border-collapse text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC] shadow-[inset_0_-1px_0_rgba(226,232,240,0.9)]">
              <tr>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Comedor</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Registros</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Accedidos</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Pendientes</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Cancelados</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Empleados únicos</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Prom. diario</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Costo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${tableRows}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}

export function renderReporteTabEmpleados(state: ReporteComedorViewState): string {
  if (state.rhAnalyticsState === "loading") {
    return `<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="h-28 rounded-xl bg-slate-100"></div></div>`;
  }
  if (state.rhAnalyticsState === "error") {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">${escapeComedorHtml(state.rhAnalyticsError ?? "Error")}</div>`;
  }
  const rowsAll = reporteOperativoRowsScoped(state);
  const needle = state.tabSearchEmpleado.trim().toLowerCase();
  const aggAll = aggregateByEmpleado(rowsAll);
  const agg = needle ?
    aggAll.filter(
      (g) =>
        g.nombre.toLowerCase().includes(needle) ||
        g.noEmpleado.toLowerCase().includes(needle) ||
        g.area.toLowerCase().includes(needle),
    )
  : aggAll;
  const top5 = agg.slice(0, 5);
  const maxR = top5[0]?.registros ?? 0;

  if (agg.length === 0) {
    return emptyBlock(
      "No hay empleados con registros en el periodo seleccionado.",
      "Amplía el rango de fechas o revisa el filtro de comedor.",
    );
  }

  const miniRank =
    top5.length === 0 ?
      ""
    : `<div class="${RH_SURFACE_CARD} p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="flex flex-wrap items-start gap-3">
          ${RANKING_ICON}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Ranking por volumen</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">Empleados (top 5)</p>
            <p class="mt-0.5 text-xs text-slate-600">${escapeComedorHtml(formatIsoShort(state.selectedFechaInicioIso))} — ${escapeComedorHtml(formatIsoShort(state.selectedFechaFinIso))}</p>
          </div>
        </div>
        <div class="mt-5 space-y-3">
          ${top5
            .map((g: ReporteAggEmpleado) => {
              const pct = barPercent(g.registros, maxR);
              return `<div class="motion-safe:transition-colors motion-safe:duration-150 space-y-2 rounded-lg px-2 py-1.5 hover:bg-slate-50/90">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="min-w-0 truncate font-semibold text-slate-800">${escapeComedorHtml(g.nombre)}</span>
                  <span class="shrink-0 tabular-nums font-bold text-violet-900">${g.registros}</span>
                </div>
                <div class="h-2.5 overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-900/[0.04]">
                  <div class="h-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 motion-safe:transition-all motion-safe:duration-200" style="width:${pct}%"></div>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;

  const tableRows = agg
    .map((g: ReporteAggEmpleado) => {
      const ultimo = g.ultimoServicioIso ? formatIsoShort(g.ultimoServicioIso) : "—";
      return `<tr class="motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-50/90">
        <td class="min-w-[200px] px-4 py-3">
          <p class="text-sm font-semibold text-slate-900">${escapeComedorHtml(g.nombre)}</p>
          <p class="text-xs tabular-nums text-slate-500">${escapeComedorHtml(g.noEmpleado || "—")}</p>
        </td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${escapeComedorHtml(g.area || "—")}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-800">${escapeComedorHtml(g.comedorFrecuente ?? "—")}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums font-semibold text-slate-900">${g.registros}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-emerald-800">${g.confirmados}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-amber-800">${g.pendientes}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-red-800">${g.cancelados}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${escapeComedorHtml(ultimo)}</td>
        <td class="whitespace-nowrap px-4 py-3">${costoNoDisponibleBadge()}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-5">
      <div class="w-full sm:max-w-md">
        <label class="${RH_LISTADO_LABEL}" for="reporte-buscar-empleado">Buscar empleado</label>
        <div class="relative mt-1.5">
          ${REPORTE_SEARCH_ICON}
          <input
            id="reporte-buscar-empleado"
            type="search"
            value="${escapeComedorHtml(state.tabSearchEmpleado)}"
            data-comedor-reporte-tab-search-empleado
            placeholder="Buscar por nombre o número de empleado"
            class="min-h-10 w-full rounded-[10px] border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm ${FIELD_FOCUS}"
          />
        </div>
      </div>
      ${miniRank}
      <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="-mx-px overflow-x-auto">
          <table class="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC] shadow-[inset_0_-1px_0_rgba(226,232,240,0.9)]">
              <tr>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Empleado</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Área</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Comedor frecuente</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Registros</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Accedidos</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Pendientes</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Cancelados</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Último servicio</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Costo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${tableRows}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}

export function renderReporteTabAreas(state: ReporteComedorViewState): string {
  if (state.rhAnalyticsState === "loading") {
    return `<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="h-28 rounded-xl bg-slate-100"></div></div>`;
  }
  if (state.rhAnalyticsState === "error") {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">${escapeComedorHtml(state.rhAnalyticsError ?? "Error")}</div>`;
  }
  const rowsAll = reporteOperativoRowsScoped(state);
  const needle = state.tabSearchArea.trim().toLowerCase();
  const aggAll = aggregateByArea(rowsAll);
  const agg = needle ? aggAll.filter((g) => g.areaNombre.toLowerCase().includes(needle)) : aggAll;
  const maxReg = agg[0]?.registros ?? 0;

  if (agg.length === 0) {
    return emptyBlock(
      "No hay áreas con registros en el periodo seleccionado.",
      "Prueba otro rango de fechas o el filtro de comedor.",
    );
  }

  const bars = agg.slice(0, 8)
    .map((g: ReporteAggArea) => {
      const pct = barPercent(g.registros, maxReg);
      return `<div class="motion-safe:transition-colors motion-safe:duration-150 space-y-2 rounded-lg px-2 py-1.5 hover:bg-slate-50/90">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="min-w-0 truncate font-semibold text-slate-800">${escapeComedorHtml(g.areaNombre)}</span>
          <span class="shrink-0 tabular-nums font-bold text-slate-900">${g.registros}</span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-900/[0.04]">
          <div class="h-2.5 rounded-full bg-gradient-to-r from-slate-600 to-sky-500 motion-safe:transition-all motion-safe:duration-200" style="width:${pct}%"></div>
        </div>
      </div>`;
    })
    .join("");

  const chart = `
    <div class="${RH_SURFACE_CARD} p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
      <div class="flex flex-wrap items-start gap-3">
        ${RANKING_ICON}
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Ranking por volumen</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">Áreas</p>
          <p class="mt-0.5 text-xs text-slate-600">${escapeComedorHtml(formatIsoShort(state.selectedFechaInicioIso))} — ${escapeComedorHtml(formatIsoShort(state.selectedFechaFinIso))}</p>
        </div>
      </div>
      <div class="mt-5 space-y-3">${bars}</div>
    </div>`;

  const tableRows = agg
    .map((g: ReporteAggArea) => {
      const promEmp = g.empleadosUnicos > 0 ? (g.registros / g.empleadosUnicos).toFixed(1) : "0";
      return `<tr class="motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-50/90">
        <td class="px-4 py-3 text-sm font-semibold text-slate-900">${escapeComedorHtml(g.areaNombre)}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-800">${g.registros}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-800">${g.empleadosUnicos}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">${promEmp}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-800">${escapeComedorHtml(g.comedorPrincipal ?? "—")}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-emerald-800">${g.confirmados}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-red-800">${g.cancelados}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-5">
      <div class="w-full sm:max-w-md">
        <label class="${RH_LISTADO_LABEL}" for="reporte-buscar-area">Buscar área</label>
        <div class="relative mt-1.5">
          ${REPORTE_SEARCH_ICON}
          <input
            id="reporte-buscar-area"
            type="search"
            value="${escapeComedorHtml(state.tabSearchArea)}"
            data-comedor-reporte-tab-search-area
            placeholder="Buscar área"
            class="min-h-10 w-full rounded-[10px] border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm ${FIELD_FOCUS}"
          />
        </div>
      </div>
      ${chart}
      <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="-mx-px overflow-x-auto">
          <table class="min-w-[820px] w-full border-collapse text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC] shadow-[inset_0_-1px_0_rgba(226,232,240,0.9)]">
              <tr>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Área</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Registros</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Empleados únicos</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Prom. por empleado</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Comedor principal</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Accedidos</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Cancelados</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${tableRows}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}

function thDetalle(label: string): string {
  return `<th scope="col" class="${COMEDOR_TABLE_TH}">${escapeComedorHtml(label)}</th>`;
}

/** Registros del periodo con filtros aplicados (10 por página). */
export function renderReporteTabDetalle(state: ReporteComedorViewState): string {
  if (state.rhAnalyticsState === "loading") {
    return `<div class="animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="h-10 rounded-lg bg-slate-100"></div>
      <div class="h-40 rounded-xl bg-slate-100"></div>
    </div>`;
  }
  if (state.rhAnalyticsState === "error") {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">${escapeComedorHtml(state.rhAnalyticsError ?? "Error al cargar registros.")}</div>`;
  }

  const sorted = reporteDetalleRowsSorted(state);

  const rangeLabel = `${formatIsoShort(state.selectedFechaInicioIso)} — ${formatIsoShort(state.selectedFechaFinIso)}`;

  if (sorted.length === 0) {
    return `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden px-4 py-12 text-center sm:px-6" role="status">
        <p class="text-sm font-semibold text-slate-900">No hay registros en este periodo con los filtros actuales.</p>
        <p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-600">
          Ajusta el rango de fechas, el comedor o el área. Periodo: ${escapeComedorHtml(rangeLabel)}.
        </p>
      </section>`;
  }

  const totalRegistros = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRegistros / REPORTE_DETALLE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, state.reporteDetallePage), totalPages);
  const startIdx = (currentPage - 1) * REPORTE_DETALLE_PAGE_SIZE;
  const pageSlice = sorted.slice(startIdx, startIdx + REPORTE_DETALLE_PAGE_SIZE);
  const shownFrom = startIdx + 1;
  const shownTo = startIdx + pageSlice.length;

  const rowsInternos = pageSlice
    .map(
      (row) => `
      <tr class="motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-50/90">
        <td class="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-800 sm:px-4">${escapeComedorHtml(formatFechaServicioRhRegistro(row.fecha_servicio))}</td>
        <td class="min-w-0 px-3 py-3 sm:px-4">
          <p class="truncate text-sm font-semibold leading-snug text-slate-900">${escapeComedorHtml(row.empleado_nombre)}</p>
          <p class="truncate text-xs font-medium tabular-nums text-slate-500">${escapeComedorHtml(row.no_empleado)}</p>
        </td>
        <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.area || "—")}</td>
        <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.comedor_nombre || "—")}</td>
        <td class="whitespace-nowrap px-3 py-3 sm:px-4">${tipoComidaBadgeRhRegistro(row.tipo_comida)}</td>
        <td class="whitespace-nowrap px-3 py-3 sm:px-4">${estadoAccesoBadgeRhRegistro(row.estado_acceso)}</td>
      </tr>`,
    )
    .join("");

  const pageButtons = paginationRange(totalPages, currentPage)
    .map((entry) => {
      if (entry === "ellipsis") {
        return '<span class="flex min-h-10 items-center px-2 text-sm text-slate-500">…</span>';
      }
      const active = entry === currentPage;
      return `<button type="button" data-comedor-reporte-detalle-page="${entry}" class="${
        active
          ? "min-h-10 min-w-10 rounded-lg bg-leoni-blue px-3 text-sm font-bold text-white shadow-md transition hover:bg-leoni-blue-light"
          : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
      }">${entry}</button>`;
    })
    .join("");

  const tabla = `<section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Registros del periodo">
        <div class="overflow-x-auto">
          <table class="min-w-[880px] w-full border-collapse text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC]">
              <tr>
                ${thDetalle("Fecha servicio")}
                ${thDetalle("Empleado")}
                ${thDetalle("Área")}
                ${thDetalle("Comedor")}
                ${thDetalle("Tipo")}
                ${thDetalle("Estado")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">${rowsInternos}</tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-4">
          <p class="text-xs text-slate-500 sm:text-sm">
            Mostrando <span class="font-semibold text-slate-700">${shownFrom}</span>–<span class="font-semibold text-slate-700">${shownTo}</span> de <span class="font-semibold text-slate-700">${totalRegistros}</span> · ${REPORTE_DETALLE_PAGE_SIZE} por página
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-comedor-reporte-detalle-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
              Anterior
            </button>
            <div class="flex items-center gap-1">${pageButtons}</div>
            <button type="button" data-comedor-reporte-detalle-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
              Siguiente
            </button>
          </div>
        </footer>
      </section>`;

  return `
    <div class="flex flex-col gap-5">
      ${tabla}
    </div>`;
}

const REPORTE_CLOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-3.5 shrink-0 text-slate-500" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 2"/><circle cx="12" cy="12" r="9"/></svg>`;

const REPORTE_EXPORT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-white" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`;

/** Tarjeta superior: título, cambio de fechas y presets (mismos data-* que antes). */
export function renderReporteMainHeaderCard(state: ReporteComedorViewState): string {
  const diasApplied = diasEnPeriodoCalendario(state.selectedFechaInicioIso, state.selectedFechaFinIso);
  const iniApplied = formatIsoShort(state.selectedFechaInicioIso);
  const finApplied = formatIsoShort(state.selectedFechaFinIso);
  const periodRangeBadge = `<span class="inline-flex max-w-[min(100vw-2rem,26rem)] items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold leading-snug text-slate-600 shadow-sm" title="${escapeComedorHtml(`${iniApplied} — ${finApplied} · ${diasApplied} día${diasApplied === 1 ? "" : "s"}`)}">${REPORTE_CLOCK_ICON}<span class="min-w-0 whitespace-normal text-left sm:whitespace-nowrap">${escapeComedorHtml(iniApplied)} — ${escapeComedorHtml(finApplied)} · ${diasApplied} día${diasApplied === 1 ? "" : "s"}</span></span>`;

  const presetBtn = (id: ReporteComedorViewState["draftDatePreset"], label: string) => {
    const active = state.draftDatePreset === id;
    return `<button type="button" data-comedor-reporte-preset="${id}" aria-pressed="${active ? "true" : "false"}" class="inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold motion-safe:transition motion-safe:duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2 ${
      active ?
        "border-[#0A1628] bg-[#0A1628] text-white shadow-[0_2px_8px_rgba(10,22,40,0.18)]"
      : "border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-blue-400/50 hover:bg-sky-50/80"
    }">${escapeComedorHtml(label)}</button>`;
  };

  const esRh = hasRhOperativeViewerContext();
  const exportDisabled = state.rhAnalyticsState === "loading";
  const exportBtn = esRh
    ? `<button type="button" data-comedor-reporte-export ${exportDisabled ? "disabled" : ""} class="${BTN_PRIMARY} h-9 min-h-9 w-full justify-center px-4 text-sm shadow-sm motion-safe:transition motion-safe:duration-150 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-md sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">${REPORTE_EXPORT_ICON}Exportar Reporte</button>`
    : "";

  return `
    <header class="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white bg-[radial-gradient(900px_circle_at_90%_-20%,rgba(37,99,235,0.07),transparent_50%)] p-5 shadow-[0_10px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 sm:p-6">
      <div class="pointer-events-none absolute -right-10 top-0 size-48 rounded-full bg-leoni-blue/5 blur-3xl"></div>
      <div class="relative flex flex-col gap-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-bold tracking-tight text-[#0A1628] sm:text-2xl">Reporte comedor</h1>
            <p class="mt-0.5 max-w-2xl text-xs leading-snug text-slate-600 sm:text-sm">Tablero analítico para monitoreo de asistencia, consumo y costos de comedor.</p>
          </div>
          <div class="shrink-0 self-start sm:pt-0.5">${periodRangeBadge}</div>
        </div>

        <div class="rounded-xl border border-slate-200/85 bg-slate-50/50 p-3 sm:p-3.5">
          <div class="flex flex-col gap-2.5">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Cambiar periodo</h2>
              </div>
            </div>
            <p class="text-xs text-slate-600">Modifica el rango de fechas o usa los accesos rápidos.</p>

            <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
              <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-lg">
                <div class="min-w-0">
                  <label class="${RH_LISTADO_LABEL}" for="comedor-reporte-start">Desde</label>
                  <input
                    id="comedor-reporte-start"
                    type="date"
                    value="${escapeComedorHtml(state.draftFechaInicioIso)}"
                    data-comedor-reporte-draft-start
                    class="mt-1 w-full min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm ${FIELD_FOCUS}"
                  />
                </div>
                <div class="min-w-0">
                  <label class="${RH_LISTADO_LABEL}" for="comedor-reporte-end">Hasta</label>
                  <input
                    id="comedor-reporte-end"
                    type="date"
                    value="${escapeComedorHtml(state.draftFechaFinIso)}"
                    data-comedor-reporte-draft-end
                    class="mt-1 w-full min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm ${FIELD_FOCUS}"
                  />
                </div>
              </div>
              <div class="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto">
                ${exportBtn}
                <button type="button" data-comedor-reporte-reset-filters class="${RH_LISTADO_BTN_SECONDARY} h-9 min-h-9 w-full justify-center sm:w-auto">Restablecer</button>
              </div>
            </div>

            <div class="border-t border-slate-200/70 pt-3">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span class="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Accesos rápidos</span>
                <div class="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
                  ${presetBtn("today", "Hoy")}
                  ${presetBtn("this_week", "Esta semana")}
                  ${presetBtn("next_week", "Próxima semana")}
                  ${presetBtn("this_month", "Este mes")}
                  ${presetBtn("custom", "Personalizado")}
                </div>
              </div>
            </div>
          </div>
          ${
            state.dateRangeError ?
              `<p class="mt-2 text-xs font-medium text-amber-800" role="alert">${escapeComedorHtml(state.dateRangeError)}</p>`
            : ""
          }
        </div>
      </div>
    </header>`;
}

/** Comedor y área (tarjeta secundaria). */
export function renderReporteFilterToolbarGlobal(state: ReporteComedorViewState): string {
  const deptOptions = state.filtersDataset.departamentos
    .map((d) => {
      const sel = state.selectedDepartamentoId === d.id ? " selected" : "";
      return `<option value="${escapeComedorHtml(d.id)}"${sel}>${escapeComedorHtml(d.label)}</option>`;
    })
    .join("");
  const areaOpts = reporteAreaFilterOptions(state.rhAnalyticsRows);
  const areaOptionsHtml = [
    `<option value="todos"${state.selectedAreaFilter === "todos" ? " selected" : ""}>Todas las áreas</option>`,
    ...areaOpts.map((o) => {
      const sel = state.selectedAreaFilter === o.id ? " selected" : "";
      return `<option value="${escapeComedorHtml(o.id)}"${sel}>${escapeComedorHtml(o.label)}</option>`;
    }),
  ].join("");

  const dept = state.filtersDataset.departamentos.find((d) => d.id === state.selectedDepartamentoId);
  const comedorLabel = dept?.label ?? "Todos los comedores";
  const areaLabel =
    state.selectedAreaFilter === "todos"
      ? "Todas las áreas"
      : (areaOpts.find((o) => o.id === state.selectedAreaFilter)?.label ?? "Área seleccionada");

  return `
    <div class="${RH_SURFACE_CARD} p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 sm:p-6">
      <div class="space-y-1">
        <h2 class="text-base font-semibold tracking-tight text-[#0A1628]">Filtros adicionales</h2>
        <p class="max-w-3xl text-sm leading-relaxed text-slate-600">Refina el reporte dentro del periodo seleccionado.</p>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label class="${RH_LISTADO_LABEL}" for="comedor-reporte-comedor-sel">Comedor</label>
          <div class="relative mt-1.5 grid w-full items-center">
            <select
              id="comedor-reporte-comedor-sel"
              data-comedor-reporte-filter-comedor
              class="col-start-1 row-start-1 w-full min-h-10 appearance-none rounded-[10px] border border-slate-300 bg-white py-2 pr-10 pl-3 text-sm font-semibold text-slate-900 shadow-sm ${FIELD_FOCUS}"
            >
              ${deptOptions}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div>
          <label class="${RH_LISTADO_LABEL}" for="comedor-reporte-area-sel">Área</label>
          <div class="relative mt-1.5 grid w-full items-center">
            <select
              id="comedor-reporte-area-sel"
              data-comedor-reporte-filter-area
              class="col-start-1 row-start-1 w-full min-h-10 appearance-none rounded-[10px] border border-slate-300 bg-white py-2 pr-10 pl-3 text-sm font-semibold text-slate-900 shadow-sm ${FIELD_FOCUS}"
              ${state.rhAnalyticsState === "loading" ? "disabled" : ""}
            >
              ${areaOptionsHtml}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      <p class="mt-4 max-w-xl text-xs leading-snug text-slate-500">
        Mostrando: ${escapeComedorHtml(comedorLabel)} · ${escapeComedorHtml(areaLabel)}. Filtra KPIs operativos y tablas; elige “Todas las áreas” para el consolidado general.
      </p>
    </div>`;
}
