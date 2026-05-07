import type {
  ReporteComedorEmpleadoRow,
  ReporteComedorKpi,
  ReporteComedorKpiId,
  ReporteComedorMainTab,
  ReporteComedorSortDirection,
  ReporteComedorSortKey,
  ReporteComedorViewState,
} from "../../comedor/reportes/types.ts";
import { diasEnPeriodoCalendario, serieDiariaTotales } from "../../comedor/reportes/reporteAggregations.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import { escapeComedorHtml, renderEmpleadoAvatarCell } from "./comedorUiUtils.ts";
import { renderComedorRhProximosRegistrosTable } from "./comedorRhProximosRegistrosTable.ts";
import {
  renderReporteFilterToolbarGlobal,
  renderReporteRhRestrictedNotice,
  renderReporteTabAreas,
  renderReporteTabComedor,
  renderReporteTabEmpleados,
} from "./comedorReporteAnalytics.ts";
import { FIELD_FOCUS } from "../../ui/uiTokens.ts";

const REPORTE_DETALLE_SEARCH_ICON = `<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg></span>`;

function iconForKpi(id: ReporteComedorKpi["icono"]): string {
  if (id === "empleados") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (id === "asistencia") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M3 13.5h3l1.5-3 3 6 2.5-5 1.5 2H21" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (id === "consumo") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M15.75 6.75v10.5m-4.5-7.5v7.5m-4.5-4.5v4.5m13.5 2.25H3.75V4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M12 6v12m-3-9a3 3 0 1 1 3 3m0 0a3 3 0 1 0 3 3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function downloadIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4"><path d="M12 3.75v11.25m0 0 3.75-3.75M12 15 8.25 11.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 15.75v1.125A2.625 2.625 0 0 0 7.125 19.5h9.75a2.625 2.625 0 0 0 2.625-2.625V15.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function formatFilterDate(dateIso: string): string {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function parseDiasMes(diasMes: string): { asistidos: number; esperados: number; ratio: number } {
  const [asistidosRaw, esperadosRaw] = diasMes.split("/");
  const asistidos = Number.parseInt((asistidosRaw ?? "").trim(), 10);
  const esperados = Number.parseInt((esperadosRaw ?? "").trim(), 10);
  const safeAsistidos = Number.isFinite(asistidos) ? asistidos : 0;
  const safeEsperados = Number.isFinite(esperados) && esperados > 0 ? esperados : 1;
  return { asistidos: safeAsistidos, esperados: safeEsperados, ratio: safeAsistidos / safeEsperados };
}

function formatHeroDate(dateIso: string): string {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function renderHero(state: ReporteComedorViewState): string {
  const dias = diasEnPeriodoCalendario(state.selectedFechaInicioIso, state.selectedFechaFinIso);
  const ini = formatHeroDate(state.selectedFechaInicioIso);
  const fin = formatHeroDate(state.selectedFechaFinIso);
  const updated =
    state.lastUpdatedLabel ?
      `<span class="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">Actualizado ${escapeComedorHtml(state.lastUpdatedLabel)}</span>`
    : "";
  return `
    <header class="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white bg-[radial-gradient(1200px_circle_at_100%_-10%,rgba(37,99,235,0.07),transparent_45%)] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 sm:p-7">
      <div class="pointer-events-none absolute -right-12 top-0 size-52 rounded-full bg-leoni-blue/6 blur-3xl sm:size-64"></div>
      <div class="relative flex flex-col gap-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1 space-y-2">
            <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-[1.75rem]">Reporte comedor</h1>
            <p class="max-w-3xl text-sm leading-relaxed text-slate-600">Tablero analítico para monitoreo de asistencia, consumo y costos de comedor.</p>
          </div>
          ${updated ? `<div class="shrink-0 sm:pt-1">${updated}</div>` : ""}
        </div>
        <div class="h-px w-full bg-gradient-to-r from-slate-200/0 via-slate-200 to-slate-200/0"></div>
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Periodo seleccionado</p>
            <p class="mt-1.5 break-words text-sm font-semibold text-slate-900">
              <span class="text-slate-800">${escapeComedorHtml(ini)}</span>
              <span class="mx-1.5 font-normal text-slate-400">—</span>
              <span class="text-slate-800">${escapeComedorHtml(fin)}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center">
            <span class="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">
              ${dias} día${dias === 1 ? "" : "s"} en el rango
            </span>
          </div>
        </div>
      </div>
    </header>`;
}

function kpiDashVisual(kpi: ReporteComedorKpi, state: ReporteComedorViewState): {
  iconShell: string;
  trend: string;
  featured: boolean;
} {
  const featured =
    state.kpisModo === "rh_resumen" ? kpi.id === "total_registros_resumen" : kpi.id === "costo_estimado";
  const id: ReporteComedorKpiId = kpi.id;
  if (id === "total_registros_resumen" || id === "total_empleados" || id === "costo_estimado") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--blue", trend: "#1d4ed8", featured };
  }
  if (id === "promedio_diario_resumen" || id === "promedio_asistencia") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--slate", trend: "#475569", featured };
  }
  if (id === "mix_menu_resumen" || id === "empleados_unicos_operativo") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--violet", trend: "#7c3aed", featured };
  }
  if (id === "accedidos_operativo") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald", trend: "#059669", featured };
  }
  if (id === "pendientes_operativo" || id === "dias_mayor_consumo") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--amber", trend: "#d97706", featured };
  }
  if (id === "cancelados_operativo") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--red", trend: "#dc2626", featured };
  }
  if (id === "comedores_activos_operativo") {
    return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--sky", trend: "#0284c7", featured };
  }
  return { iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--sky", trend: "#64748b", featured };
}

function sparklineValuesForKpi(kpiId: ReporteComedorKpi["id"]): readonly number[] {
  if (kpiId === "costo_estimado") return [46, 49, 53, 57, 60, 65, 68];
  if (kpiId === "promedio_asistencia") return [63, 66, 68, 72, 70, 74, 76];
  if (kpiId === "dias_mayor_consumo") return [55, 76, 62, 69, 83, 52, 48];
  return [35, 39, 42, 41, 45, 49, 52];
}

function renderSparkline(values: readonly number[], colorHex: string): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = 120;
  const height = 34;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / Math.max(1, max - min)) * (height - 6) - 3;
      return `${x},${Number.isFinite(y) ? y : height / 2}`;
    })
    .join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" class="h-9 w-full" aria-hidden="true"><polyline fill="none" stroke="${colorHex}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${points}" /></svg>`;
}

function normalizePeakDays(value: string): string {
  const mapping: Record<string, string> = {
    Lun: "Lunes",
    Mar: "Martes",
    Mie: "Miércoles",
    Jue: "Jueves",
    Vie: "Viernes",
    Sab: "Sábado",
    Dom: "Domingo",
  };
  const expanded = value
    .split("/")
    .map((item) => mapping[item.trim()] ?? item.trim())
    .filter(Boolean);
  if (expanded.length === 0) return value;
  return `Picos: ${expanded.join(" y ")}`;
}

function normalizeKpiSecondary(kpi: ReporteComedorKpi, modo: ReporteComedorViewState["kpisModo"]): string {
  if (modo === "rh_resumen") return kpi.secundario;
  if (kpi.id === "promedio_asistencia") return `${kpi.secundario}. Revisar equipos bajo 90%.`;
  if (kpi.id === "costo_estimado") return "Comparar contra presupuesto y ajustar menú por demanda.";
  if (kpi.id === "total_empleados") return "Segmenta por turno para detectar variaciones de consumo.";
  if (kpi.id === "dias_mayor_consumo") return "Usa estos picos para planear insumos y dotación.";
  return kpi.secundario;
}

function sparklineForKpi(state: ReporteComedorViewState, kpi: ReporteComedorKpi, trendColor: string): string {
  if (
    state.kpisModo === "rh_resumen" &&
    kpi.id === "total_registros_resumen" &&
    state.rhResumenDiario &&
    state.rhResumenDiario.length > 0
  ) {
    const serie = serieDiariaTotales(state.rhResumenDiario, state.selectedTipoComidaFilter).slice(-14);
    return renderSparkline(serie, trendColor);
  }
  return renderSparkline(sparklineValuesForKpi(kpi.id), trendColor);
}

const KPI_CAL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-[18px]" aria-hidden="true"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderKpis(state: ReporteComedorViewState): string {
  const skeletonCount = state.kpisModo === "rh_resumen" ? 8 : 4;
  if (state.kpisState === "loading") {
    return `<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${Array.from({ length: skeletonCount })
        .map(
          () => `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="size-10 rounded-[14px] bg-slate-100"></div>
              <div class="h-9 w-24 rounded bg-slate-100"></div>
            </div>
            <div class="mt-4 h-3 w-28 rounded bg-slate-100"></div>
            <div class="mt-2 h-8 w-20 rounded bg-slate-200"></div>
            <div class="mt-3 h-3 w-full max-w-[11rem] rounded bg-slate-100"></div>
          </article>`,
        )
        .join("")}
    </section>`;
  }
  if (state.kpisState === "error") {
    return `
      <section class="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-4 text-sm text-red-800 shadow-[0_8px_24px_rgba(127,29,29,0.06)]" role="alert">
        <p class="font-semibold">No fue posible cargar las métricas del reporte.</p>
        <p class="mt-1">${escapeComedorHtml(state.kpisError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-kpis class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
          Reintentar
        </button>
      </section>`;
  }
  if (state.kpisState === "empty" || !state.kpis || state.kpis.length === 0) {
    return `<section class="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/90 px-5 py-10 text-center shadow-sm">
      <div class="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6 text-slate-400" aria-hidden="true"><path d="M9 17v-6m3 4v-4m3 5v-9M5 3h14a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V5a2 2 0 0 1 2-2Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <p class="text-sm font-semibold text-slate-900">No hay métricas para este periodo.</p>
      <p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-600">Prueba seleccionando otro rango de fechas o ajusta el comedor.</p>
    </section>`;
  }
  let ordered = state.kpis.filter((kpi) => kpi.id !== "dias_mayor_consumo");
  if (state.kpisModo !== "rh_resumen") {
    ordered = [...ordered].sort((a, b) => (a.id === "costo_estimado" ? -1 : b.id === "costo_estimado" ? 1 : 0));
  }
  const dias = diasEnPeriodoCalendario(state.selectedFechaInicioIso, state.selectedFechaFinIso);
  const fuenteResumen =
    state.kpisModo === "rh_resumen" ?
      state.selectedTipoComidaFilter === "todos"
        ? "Consolidado diario RH (Opción A + Opción B) y KPIs operativos filtrados por periodo y comedor."
        : state.selectedTipoComidaFilter === "casera"
          ? "Consolidado diario RH filtrado por Opción A en periodo y comedor."
          : "Consolidado diario RH filtrado por Opción B en periodo y comedor."
    : "Referencia de la semana actual del comedor (API estadísticas / proyecciones).";
  const contextStrip = `
    <div class="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-sky-50/30 px-4 py-3.5 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
      <div class="flex min-w-0 items-start gap-3">
        <div class="flex shrink-0 rounded-[14px] p-2 rh-dash-kpi-icon rh-dash-kpi-icon--sky" aria-hidden="true">${KPI_CAL_ICON}</div>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contexto del periodo</p>
          <p class="mt-1 text-sm font-semibold leading-snug text-slate-900">
            Del ${escapeComedorHtml(formatFilterDate(state.selectedFechaInicioIso))} al ${escapeComedorHtml(formatFilterDate(state.selectedFechaFinIso))}
          </p>
          <p class="mt-0.5 text-xs text-slate-600">${dias} día${dias === 1 ? "" : "s"} analizados · consolidado operativo</p>
        </div>
      </div>
      <p class="text-xs leading-relaxed text-slate-500 sm:max-w-[min(100%,22rem)] sm:text-right">${escapeComedorHtml(fuenteResumen)}</p>
    </div>`;
  return `<section class="space-y-4 sm:space-y-5">
    ${contextStrip}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${ordered
        .map((kpi) => {
          const vis = kpiDashVisual(kpi, state);
          const value = kpi.id === "dias_mayor_consumo" ? normalizePeakDays(kpi.valor) : kpi.valor;
          const valueSize = vis.featured ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[1.65rem]";
          const featuredBar = vis.featured ? "border-t-[3px] border-t-blue-600" : "";
          return `<article class="group rh-dash-kpi-card relative flex min-h-[158px] flex-col overflow-hidden p-4 sm:p-5 ${featuredBar}">
            <div class="flex items-start justify-between gap-3">
              <div class="flex shrink-0 rounded-[14px] p-2 ${vis.iconShell}" aria-hidden="true">${iconForKpi(kpi.icono)}</div>
              <div class="pointer-events-none w-[min(120px,28vw)] shrink-0 opacity-[0.42] motion-safe:transition-opacity motion-safe:duration-200 group-hover:opacity-[0.58]">${sparklineForKpi(state, kpi, vis.trend)}</div>
            </div>
            <p class="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">${escapeComedorHtml(kpi.label)}</p>
            <p class="mt-1 ${valueSize} font-bold tracking-tight text-text-primary">${escapeComedorHtml(value)}</p>
            <p class="mt-auto pt-2 text-xs leading-snug ${vis.featured ? "text-slate-600" : "text-slate-500"}">${escapeComedorHtml(normalizeKpiSecondary(kpi, state.kpisModo))}</p>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
}

function menuBadge(menu: ReporteComedorEmpleadoRow["menu"]): string {
  if (menu === "dieta") {
    return '<span class="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-900">Dieta</span>';
  }
  return '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">Normal</span>';
}

function filteredAndSortedRows(state: ReporteComedorViewState): readonly ReporteComedorEmpleadoRow[] {
  const baseRows = state.table?.empleados ?? [];
  const needle = state.tableSearch.trim().toLowerCase();
  const filtered =
    needle.length === 0 ?
      baseRows
    : baseRows.filter((row) => `${row.nombre} ${row.noEmpleado} ${row.area} ${row.diasMes}`.toLowerCase().includes(needle));
  return [...filtered].sort((a, b) => {
    let comparison = 0;
    if (state.tableSortKey === "nombre") comparison = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    if (state.tableSortKey === "dias_mes") comparison = parseDiasMes(a.diasMes).ratio - parseDiasMes(b.diasMes).ratio;
    if (state.tableSortKey === "menu") comparison = a.menu.localeCompare(b.menu);
    if (state.tableSortKey === "estado") comparison = Number(a.activo) - Number(b.activo);
    return state.tableSortDirection === "asc" ? comparison : comparison * -1;
  });
}

function sortArrow(active: boolean, direction: ReporteComedorSortDirection): string {
  if (!active) return '<span class="text-slate-300">↕</span>';
  return `<span class="text-leoni-blue">${direction === "asc" ? "↑" : "↓"}</span>`;
}

function sortableHeader(title: string, key: ReporteComedorSortKey, state: ReporteComedorViewState, extraClass = ""): string {
  const active = state.tableSortKey === key;
  return `<th scope="col" class="sticky top-0 z-10 bg-[#F8FAFC] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B] shadow-[inset_0_-1px_0_rgba(226,232,240,0.9)] ${extraClass}">
      <button type="button" data-comedor-reporte-sort="${key}" class="inline-flex items-center gap-1 rounded-md hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
        ${escapeComedorHtml(title)}
        ${sortArrow(active, state.tableSortDirection)}
      </button>
    </th>`;
}

function renderTable(state: ReporteComedorViewState): string {
  const searchInputClasses = `min-h-10 w-full rounded-[10px] border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}`;
  if (state.tableState === "loading") {
    return `
      <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="animate-pulse p-4 sm:p-5">
          <div class="h-10 rounded-[10px] bg-slate-100"></div>
          <div class="mt-3 h-10 rounded-[10px] bg-slate-100"></div>
          <div class="mt-3 h-10 rounded-[10px] bg-slate-100"></div>
        </div>
      </section>`;
  }
  if (state.tableState === "error") {
    return `
      <section class="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-4 text-sm text-red-800 shadow-sm" role="alert">
        <p class="font-semibold">No fue posible cargar la tabla de empleados.</p>
        <p class="mt-1">${escapeComedorHtml(state.tableError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-table class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
          Reintentar
        </button>
      </section>`;
  }
  const rows = filteredAndSortedRows(state);
  if (state.tableState === "empty" || rows.length === 0) {
    return `
      <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
        <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
          <label class="relative block w-full sm:max-w-md">
            ${REPORTE_DETALLE_SEARCH_ICON}
            <span class="sr-only">Buscar en detalle de registros</span>
            <input
              type="search"
              value="${escapeComedorHtml(state.tableSearch)}"
              data-comedor-reporte-search
              placeholder="Buscar por nombre, número o área"
              class="${searchInputClasses}"
            />
          </label>
        </div>
        <div class="border border-dashed border-slate-200/90 bg-slate-50/60 px-5 py-14 text-center">
          <div class="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6 text-slate-400" aria-hidden="true"><path d="M9 17v-6m3 4v-4m3 5v-9M5 3h14a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V5a2 2 0 0 1 2-2Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <p class="text-sm font-semibold text-slate-900">No hay registros en este periodo.</p>
          <p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-600">Prueba ajustando el rango de fechas o el comedor seleccionado.</p>
        </div>
      </section>`;
  }
  return `
    <section class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
      <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
        <p class="text-sm font-semibold text-slate-900">Empleados evaluados</p>
        <label class="relative block w-full sm:max-w-md">
          ${REPORTE_DETALLE_SEARCH_ICON}
          <span class="sr-only">Buscar en detalle de registros</span>
          <input
            type="search"
            value="${escapeComedorHtml(state.tableSearch)}"
            data-comedor-reporte-search
            placeholder="Buscar por nombre, número o área"
            class="${searchInputClasses}"
          />
        </label>
      </div>
      <div class="-mx-px overflow-x-auto border-t border-slate-100">
        <table class="min-w-[940px] w-full border-collapse text-left">
          <thead class="[&_th]:whitespace-nowrap">
            <tr>
              ${sortableHeader("Empleado", "nombre", state)}
              ${sortableHeader("Días (mes)", "dias_mes", state, "text-right")}
              ${sortableHeader("Menú", "menu", state)}
              ${sortableHeader("Estado", "estado", state, "whitespace-nowrap")}
              <th scope="col" class="sticky top-0 z-10 bg-[#F8FAFC] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B] shadow-[inset_0_-1px_0_rgba(226,232,240,0.9)]">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows
              .map((row) => {
                return `<tr class="motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-50/90">
                    <td class="px-4 py-3">
                      ${renderEmpleadoAvatarCell(row.nombre, row.noEmpleado, row.avatarUrl)}
                      <p class="mt-1 pl-11 text-xs text-slate-500">${escapeComedorHtml(row.area)}</p>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">${escapeComedorHtml(row.diasMes)}</td>
                    <td class="whitespace-nowrap px-4 py-3">${menuBadge(row.menu)}</td>
                    <td class="whitespace-nowrap px-4 py-3">
                      ${
                        row.activo ?
                          '<span class="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">Activo</span>'
                        : '<span class="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-900">Inactivo</span>'
                      }
                    </td>
                    <td class="whitespace-nowrap px-4 py-3">
                      <button type="button" data-comedor-reporte-open-detail="${escapeComedorHtml(row.id)}" class="inline-flex items-center rounded-md border border-leoni-blue/40 bg-white px-2.5 py-1 text-xs font-semibold text-leoni-blue transition hover:bg-leoni-blue/10">
                        Ver análisis
                      </button>
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderSparklineCard(values: readonly number[]): string {
  return `<div class="mt-3 rounded-lg bg-slate-50 p-2">${renderSparkline(values, "#0f4da8")}</div>`;
}

function currentWeekdayIndex(): number {
  const day = new Date().getDay();
  if (day === 0 || day === 6) return 4;
  return Math.max(0, day - 1);
}

function weeklyAverage(values: readonly number[]): number {
  const weekdays = values.slice(0, 5);
  if (weekdays.length === 0) return 0;
  return Math.round(weekdays.reduce((acc, value) => acc + value, 0) / weekdays.length);
}

function trendComparison(currentValue: number, baselineValue: number): {
  direction: "up" | "down" | "flat";
  delta: number;
  label: string;
  toneClass: string;
} {
  const safeBaseline = baselineValue <= 0 ? 1 : baselineValue;
  const rawDelta = ((currentValue - baselineValue) / safeBaseline) * 100;
  const delta = Math.round(rawDelta);
  if (delta > 1) {
    return {
      direction: "up",
      delta,
      label: `+${delta}% vs promedio general`,
      toneClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    };
  }
  if (delta < -1) {
    return {
      direction: "down",
      delta,
      label: `${delta}% vs promedio general`,
      toneClass: "text-rose-700 bg-rose-50 border-rose-200",
    };
  }
  return {
    direction: "flat",
    delta: 0,
    label: "Sin cambio relevante vs promedio general",
    toneClass: "text-slate-700 bg-slate-100 border-slate-200",
  };
}

function trendArrow(direction: "up" | "down" | "flat"): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function colorByAttendance(value: number): string {
  if (value > 85) return "bg-emerald-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

function renderWeeklyBars(values: readonly number[]): string {
  const labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const highlightedDay = currentWeekdayIndex();
  const baseLinePercent = 80;
  return `<div class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="flex items-center justify-between">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Asistencia promedio semanal</p>
      <p class="text-xs text-slate-500">Meta base ${baseLinePercent}%</p>
    </div>
    <div class="relative mt-10 flex h-28 items-end gap-2">
      <div class="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-300" style="bottom:${baseLinePercent}%"></div>
      ${values
        .map((value, index) => {
          const height = Math.max(8, Math.min(100, Math.round(value)));
          const isWeekend = index >= 5;
          const isToday = index === highlightedDay;
          const columnTone =
            isWeekend ?
              "bg-slate-300"
            : colorByAttendance(value);
          return `<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div class="w-full rounded ${isWeekend ? "bg-slate-100" : "bg-slate-100/80"} ${isToday ? "ring-2 ring-leoni-blue/30 ring-offset-1 ring-offset-white" : ""}">
              <div class="w-full rounded ${columnTone} transition-all" style="height:${height}px" title="${labels[index] ?? "-"}: ${value}%" data-tooltip-content="${labels[index] ?? "-"} ${value}%"></div>
            </div>
            <span class="text-[10px] font-semibold ${isToday ? "text-leoni-blue" : "text-slate-500"}">${labels[index] ?? "-"}</span>
            <span class="text-[10px] ${isToday ? "text-leoni-blue font-semibold" : "text-slate-400"}">${value}%</span>
          </div>`;
        })
        .join("")}
    </div>
    ${renderSparklineCard(values)}
  </div>`;
}

function menuDistribution(percent: number): {
  regular: number;
  vegetariano: number;
  especial: number;
} {
  const especial = Math.max(5, Math.min(80, Math.round(percent)));
  const vegetariano = Math.max(8, Math.min(35, Math.round(especial * 0.45)));
  const regular = Math.max(0, 100 - especial - vegetariano);
  return { regular, vegetariano, especial };
}

function renderMenuPreference(percent: number): string {
  const distribution = menuDistribution(percent);
  const rows: readonly { id: string; label: string; value: number; barClass: string }[] = [
    { id: "regular", label: "Regular", value: distribution.regular, barClass: "bg-slate-500" },
    { id: "vegetariano", label: "Vegetariano", value: distribution.vegetariano, barClass: "bg-emerald-500" },
    { id: "especial", label: "Especial", value: distribution.especial, barClass: "bg-violet-500" },
  ];
  return `<div class="rounded-2xl border border-slate-200 bg-white p-5">
    <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Preferencias por tipo de dieta</p>
    <div class="mt-4 space-y-3">
      ${rows
        .map(
          (row) => `<div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-slate-700">${row.label}</span>
          <span class="font-semibold text-slate-900">${row.value}%</span>
        </div>
        <div class="h-2 rounded-full bg-slate-100">
          <div class="h-2 rounded-full ${row.barClass}" style="width:${row.value}%"></div>
        </div>
      </div>
    `,
        )
        .join("")}
    </div>
  </div>`;
}

function iconForComment(kind: "alerta" | "nutricion" | "nota"): string {
  if (kind === "alerta") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4"><path d="m12 9 .01 4.5M12 17.25h.008v.008H12z" stroke-linecap="round" stroke-linejoin="round"/><path d="m10.29 3.86-7.06 12.23A2.25 2.25 0 0 0 5.18 19.5h13.64a2.25 2.25 0 0 0 1.95-3.41L13.71 3.86a2.25 2.25 0 0 0-3.42 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (kind === "nutricion") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4"><path d="M12 21s-5.25-2.9-5.25-8.438A4.688 4.688 0 0 1 11.438 7.875h1.124a4.688 4.688 0 0 1 4.688 4.687C17.25 18.1 12 21 12 21Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.875V3.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4"><circle cx="12" cy="12" r="9"/><path d="m12 10.5.008 5.25M12 8.25h.008" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderComments(comments: readonly ReporteComedorEmpleadoRow["comentarios"][number][]): string {
  if (comments.length === 0) {
    return `<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Sin comentarios o alergias registradas.</div>`;
  }
  const items = comments
    .map((comment) => {
      const loweredTitle = comment.titulo.toLowerCase();
      const isCritical = comment.tono === "alerta" && loweredTitle.includes("alergia");
      const kind = isCritical ? "alerta" : comment.tono === "nota" && loweredTitle.includes("nutric") ? "nutricion" : comment.tono;
      const toneClass =
        isCritical ?
          "border-rose-200 bg-rose-50 text-rose-800"
        : comment.tono === "alerta" ?
          "border-amber-200 bg-amber-50 text-amber-900"
        : "border-blue-200 bg-blue-50 text-blue-900";
      return `<article class="rounded-xl border px-3 py-3 ${toneClass}">
        <p class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">${iconForComment(kind)} ${escapeComedorHtml(comment.titulo)}</p>
        <p class="mt-1 text-xs">${escapeComedorHtml(comment.detalle)}</p>
      </article>`;
    })
    .join("");
  return `<details class="rounded-2xl border border-slate-200 bg-white p-4" open>
    <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-muted">Alertas y notas operativas</summary>
    <div class="mt-3 space-y-2">${items}</div>
    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
        Ver historial
      </button>
      <button type="button" class="inline-flex items-center justify-center rounded-lg border border-leoni-blue/40 bg-leoni-blue/10 px-3 py-2 text-xs font-semibold text-leoni-blue transition hover:bg-leoni-blue/15">
        Editar dieta
      </button>
    </div>
  </details>`;
}

function metricValue(label: string, value: string): string {
  return `<div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeComedorHtml(label)}</p>
    <p class="mt-1 text-sm font-bold text-slate-900">${escapeComedorHtml(value)}</p>
  </div>`;
}

function formatTurnoLabel(turnoId: string): string {
  if (turnoId === "manana") return "Turno mañana";
  if (turnoId === "tarde") return "Turno tarde";
  if (turnoId === "noche") return "Turno noche";
  return "Turno no definido";
}

function roleLabelFromArea(area: string): string {
  const normalized = area.toLowerCase();
  if (normalized.includes("calidad")) return "Inspector de calidad";
  if (normalized.includes("mantenimiento")) return "Técnico de mantenimiento";
  if (normalized.includes("logística") || normalized.includes("logistica")) return "Operador logístico";
  return "Colaborador operativo";
}

function renderProfileContent(state: ReporteComedorViewState): string {
  if (state.tableState === "loading") {
    return `<div class="animate-pulse space-y-3">
      <div class="h-4 w-44 rounded bg-slate-100"></div>
      <div class="h-24 rounded bg-slate-100"></div>
      <div class="h-20 rounded bg-slate-100"></div>
    </div>`;
  }
  if (state.tableState === "error") {
    return `<p class="text-sm text-slate-500">No se puede mostrar perfil individual hasta recuperar la tabla.</p>`;
  }
  const selected = (state.table?.empleados ?? []).find((item) => item.id === state.selectedEmpleadoId) ?? null;
  if (!selected) {
    return `<p class="text-sm text-slate-500">Selecciona un empleado para ver su perfil individual.</p>`;
  }
  const asistencia = parseDiasMes(selected.diasMes);
  const costoComidaUnitario = selected.menu === "dieta" ? 172 : 150;
  const costoMensual = costoComidaUnitario * asistencia.asistidos;
  const consumoPromedioSemanal = Math.round(
    selected.asistenciaSemanal.reduce((acc, value) => acc + value, 0) / Math.max(1, selected.asistenciaSemanal.length),
  );
  const costoMensualLabel = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(costoMensual);
  const globalWeeklyAvg =
    state.table && state.table.empleados.length > 0 ?
      Math.round(
        state.table.empleados.reduce((acc, row) => acc + weeklyAverage(row.asistenciaSemanal), 0) /
          state.table.empleados.length,
      )
    : consumoPromedioSemanal;
  const trend = trendComparison(consumoPromedioSemanal, globalWeeklyAvg);
  const statusLabel = selected.activo ? "Activo" : "Inactivo";
  const statusClass =
    selected.activo ?
      "border-emerald-300 bg-emerald-100 text-emerald-800"
    : "border-rose-300 bg-rose-100 text-rose-800";
  return `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <h3 class="text-2xl font-semibold text-text-primary">${escapeComedorHtml(selected.nombre)}</h3>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">${escapeComedorHtml(roleLabelFromArea(selected.area))}</span>
            <span class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">${escapeComedorHtml(formatTurnoLabel(selected.turnoId))}</span>
            <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${statusClass}">
              <span class="inline-block size-1.5 rounded-full ${selected.activo ? "bg-emerald-600" : "bg-rose-600"}"></span>
              ${statusLabel}
            </span>
          </div>
        </div>
        <div class="rounded-xl border border-leoni-blue/20 bg-leoni-blue/5 px-3 py-2 text-right">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-leoni-blue">Última asistencia</p>
          <p class="mt-1 text-sm font-bold text-slate-900">${escapeComedorHtml(selected.ultimaAsistencia)}</p>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-leoni-blue/20 bg-linear-to-br from-leoni-blue/10 to-white p-5 shadow-sm ring-1 ring-leoni-blue/10">
      <p class="text-xs font-semibold uppercase tracking-wide text-leoni-blue">KPI principal</p>
      <p class="mt-2 text-sm text-slate-600">Costo por empleado (periodo actual)</p>
      <p class="mt-1 text-4xl font-bold tracking-tight text-slate-900">${escapeComedorHtml(costoMensualLabel)}</p>
    </section>

    <section class="grid grid-cols-1 gap-2 sm:grid-cols-3">
      ${metricValue("Servicios consumidos este mes", `${asistencia.asistidos} servicios`)}
      ${metricValue("Cobertura mensual", `${Math.round(asistencia.ratio * 100)}%`)}
      ${metricValue("Asistencia promedio semanal", `${consumoPromedioSemanal}%`)}
    </section>

    <section class="rounded-2xl border ${trend.toneClass} px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-wide">Tendencia de asistencia</p>
      <p class="mt-1 text-sm font-semibold">${trendArrow(trend.direction)} ${trend.label}</p>
    </section>

    ${renderWeeklyBars(selected.asistenciaSemanal)}
    ${renderMenuPreference(selected.preferenciaDietaPercent)}
    <section class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Alertas y recomendaciones</p>
      ${renderComments(selected.comentarios)}
    </section>
    <button type="button" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-leoni-blue px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light">
      ${downloadIcon()}
      Exportar reporte (PDF)
    </button>`;
}

function renderProfilePanel(state: ReporteComedorViewState): string {
  const content = renderProfileContent(state);
  return `
    <section class="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-leoni-blue">Perfil individual</h2>
      <div class="mt-4 space-y-4">${content}</div>
      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
          Ver historial completo
        </button>
        <button type="button" class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
          Editar perfil
        </button>
      </div>
    </section>`;
}

function reporteWorkspaceCopy(tab: ReporteComedorMainTab): { title: string; subtitle: string } {
  switch (tab) {
    case "comedor":
      return {
        title: "Reporte por comedor",
        subtitle: "Datos del periodo seleccionado filtrados por comedor.",
      };
    case "empleados":
      return {
        title: "Reporte por empleados",
        subtitle: "Datos del periodo seleccionado filtrados por comedor.",
      };
    case "areas":
      return {
        title: "Reporte por áreas",
        subtitle: "Datos del periodo seleccionado filtrados por comedor.",
      };
    case "detalle":
      return {
        title: "Detalle de registros",
        subtitle:
          "Tabla de evaluación (placeholder) y reservas futuras filtradas por estado. La lista operativa muestra fechas desde hoy; cruza con el periodo seleccionado usando la fecha de servicio de cada fila.",
      };
    default:
      return { title: "", subtitle: "" };
  }
}

function renderReporteWorkspaceIntro(state: ReporteComedorViewState): string {
  const { title, subtitle } = reporteWorkspaceCopy(state.reporteMainTab);
  return `
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold tracking-tight text-slate-900">${escapeComedorHtml(title)}</h2>
      <p class="max-w-3xl text-sm leading-relaxed text-slate-600">${escapeComedorHtml(subtitle)}</p>
    </div>`;
}

function renderMainTabSegment(state: ReporteComedorViewState): string {
  const tabs: { id: ReporteComedorMainTab; label: string }[] = [
    { id: "comedor", label: "Por comedor" },
    { id: "empleados", label: "Por empleados" },
    { id: "areas", label: "Por áreas" },
    { id: "detalle", label: "Detalle de registros" },
  ];
  const buttons = tabs
    .map((t) => {
      const active = state.reporteMainTab === t.id;
      return `<button type="button" role="tab" aria-selected="${active}" data-comedor-reporte-main-tab="${t.id}" class="min-h-10 shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap motion-safe:transition motion-safe:duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-4 ${
        active ?
          "bg-leoni-blue text-white shadow-[0_6px_16px_rgba(0,33,71,0.22)]"
        : "border border-slate-200/85 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
      }">${escapeComedorHtml(t.label)}</button>`;
    })
    .join("");
  return `<div class="-mx-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Vistas del reporte comedor">
    <div class="inline-flex min-w-full gap-1 rounded-xl border border-slate-200/85 bg-slate-50/95 p-1 shadow-inner sm:flex-wrap">${buttons}</div>
  </div>`;
}

function renderActiveTabBody(state: ReporteComedorViewState): string {
  const esRh = getRolFromAccessToken() === "rh";
  if (!esRh) return renderReporteRhRestrictedNotice();
  if (state.reporteMainTab === "comedor") return renderReporteTabComedor(state);
  if (state.reporteMainTab === "empleados") return renderReporteTabEmpleados(state);
  if (state.reporteMainTab === "areas") return renderReporteTabAreas(state);
  return "";
}

export function renderComedorReporteDashboard(state: ReporteComedorViewState): string {
  const bloqueRhProximos =
    getRolFromAccessToken() === "rh" && state.reporteMainTab === "detalle"
      ? renderComedorRhProximosRegistrosTable(
          state.rhFuturosState,
          state.rhFuturos,
          state.rhFuturosError,
          {
            statusFilter: state.rhFuturosStatusFilter,
            search: state.rhFuturosSearch,
            tipoComidaFilter: state.selectedTipoComidaFilter,
          },
        )
      : "";

  const workspaceIntro = renderReporteWorkspaceIntro(state);
  const tabContent =
    state.reporteMainTab === "detalle" ?
      `<div class="flex flex-col gap-5">${renderTable(state)}${bloqueRhProximos}</div>`
    : renderActiveTabBody(state);

  return `
    <div class="flex min-h-0 flex-col gap-5 sm:gap-6">
      ${renderHero(state)}
      ${renderReporteFilterToolbarGlobal(state)}
      ${renderKpis(state)}
      <section class="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 sm:p-6 lg:p-7">
        ${renderMainTabSegment(state)}
        <div class="mt-6 space-y-6 border-t border-slate-100 pt-6">
          ${workspaceIntro}
          ${tabContent}
        </div>
      </section>
    </div>`;
}

export function renderComedorReporteDetailDashboard(state: ReporteComedorViewState): string {
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      <header class="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Reportes comedor / Análisis individual</p>
            <h1 class="text-xl font-semibold text-text-primary">Detalle de perfil de colaborador</h1>
          </div>
          <button
            type="button"
            data-comedor-reporte-back
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
              <path d="M15.75 19.5 8.25 12l7.5-7.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Volver a la tabla
          </button>
        </div>
      </header>
      <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <p class="text-sm font-semibold text-slate-900">Vista enfocada para análisis operativo individual</p>
          <p class="text-xs text-slate-500">Sin distractores del listado general</p>
        </div>
        <div class="mt-4">${renderProfilePanel(state)}</div>
      </section>
    </div>`;
}
