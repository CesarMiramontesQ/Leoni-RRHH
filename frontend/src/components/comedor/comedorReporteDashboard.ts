import type {
  ReporteComedorDatePreset,
  ReporteComedorEmpleadoRow,
  ReporteComedorKpi,
  ReporteComedorSortDirection,
  ReporteComedorSortKey,
  ReporteComedorViewState,
} from "../../comedor/reportes/types.ts";
import { escapeComedorHtml, renderEmpleadoAvatarCell } from "./comedorUiUtils.ts";
import { SELECT_CHEVRON } from "../../ui/uiTokens.ts";

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

function renderHeader(): string {
  return `
    <header class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Reporte comedor</h1>
        <p class="mt-1 text-sm text-text-muted">Tablero analítico para monitoreo de asistencia, consumo y costos de comedor.</p>
      </div>
      <div class="flex items-center gap-2">
        <details class="relative">
          <summary class="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400">
            Exportar
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 0 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd"/></svg>
          </summary>
          <div class="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
            <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Exportar en PDF</button>
            <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Exportar en Excel</button>
            <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Exportar en CSV</button>
          </div>
        </details>
      </div>
    </header>`;
}

function renderFilterSelect(
  id: string,
  label: string,
  value: string,
  options: readonly { id: string; label: string }[],
  dataAttr: string,
): string {
  const optionsHtml = options
    .map(
      (option) =>
        `<option value="${escapeComedorHtml(option.id)}" ${value === option.id ? "selected" : ""}>${escapeComedorHtml(option.label)}</option>`,
    )
    .join("");
  return `
    <div class="min-w-0">
      <label for="${id}" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeComedorHtml(label)}</label>
      <div class="grid grid-cols-1">
        <select id="${id}" data-comedor-reporte-filter="${dataAttr}" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
          ${optionsHtml}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

function activeFilterChips(state: ReporteComedorViewState): readonly { key: "departamento" | "turno" | "fecha"; label: string }[] {
  const chips: { key: "departamento" | "turno" | "fecha"; label: string }[] = [];
  if (state.selectedDepartamentoId !== "todos") {
    const found = state.filtersDataset.departamentos.find((item) => item.id === state.selectedDepartamentoId);
    if (found) chips.push({ key: "departamento", label: `Departamento: ${found.label}` });
  }
  if (state.selectedTurnoId !== "todos") {
    const found = state.filtersDataset.turnos.find((item) => item.id === state.selectedTurnoId);
    if (found) chips.push({ key: "turno", label: `Turno: ${found.label}` });
  }
  const defaultInicio = state.filtersDataset.fechaInicioIso;
  const defaultFin = state.filtersDataset.fechaFinIso;
  if (state.selectedFechaInicioIso !== defaultInicio || state.selectedFechaFinIso !== defaultFin) {
    chips.push({
      key: "fecha",
      label: `Periodo: ${formatFilterDate(state.selectedFechaInicioIso)} - ${formatFilterDate(state.selectedFechaFinIso)}`,
    });
  }
  return chips;
}

function renderDatePresetButton(id: Exclude<ReporteComedorDatePreset, "custom">, label: string, selectedPreset: ReporteComedorDatePreset): string {
  const active = selectedPreset === id;
  return `<button
    type="button"
    data-comedor-reporte-date-preset="${id}"
    class="rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active ?
        "border-leoni-blue bg-leoni-blue/10 text-leoni-blue"
      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
    }"
  >
    ${escapeComedorHtml(label)}
  </button>`;
}

function renderFilters(state: ReporteComedorViewState): string {
  const chips = activeFilterChips(state);
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-slate-900">Filtros del reporte</p>
        <p class="text-xs text-slate-500">
          ${state.lastUpdatedLabel ? `Actualizado: ${escapeComedorHtml(state.lastUpdatedLabel)}` : "Pendiente de actualización"}
        </p>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)_auto]">
        ${renderFilterSelect(
          "reporte-comedor-departamento",
          "Departamento",
          state.draftDepartamentoId,
          state.filtersDataset.departamentos,
          "departamento",
        )}
        ${renderFilterSelect(
          "reporte-comedor-turno",
          "Turno",
          state.draftTurnoId,
          state.filtersDataset.turnos,
          "turno",
        )}
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Rango de fecha</label>
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="date"
              data-comedor-reporte-filter="fecha_inicio"
              value="${escapeComedorHtml(state.draftFechaInicioIso)}"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            />
            <span class="text-xs font-semibold text-slate-500">a</span>
            <input
              type="date"
              data-comedor-reporte-filter="fecha_fin"
              value="${escapeComedorHtml(state.draftFechaFinIso)}"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <div class="flex flex-col justify-end gap-2">
          <button type="button" data-comedor-reporte-clear-filters class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            Limpiar filtros
          </button>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${renderDatePresetButton("last_7", "Últimos 7 días", state.draftDatePreset)}
        ${renderDatePresetButton("last_30", "Últimos 30 días", state.draftDatePreset)}
        ${renderDatePresetButton("this_month", "Este mes", state.draftDatePreset)}
        ${renderDatePresetButton("previous_month", "Mes anterior", state.draftDatePreset)}
      </div>
      ${
        chips.length > 0 ?
          `<div class="mt-3 flex flex-wrap gap-2">
            ${chips
              .map(
                (chip) => `<button type="button" data-comedor-reporte-clear-chip="${chip.key}" class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400">
                ${escapeComedorHtml(chip.label)}
                <span aria-hidden="true" class="text-slate-500">x</span>
              </button>`,
              )
              .join("")}
          </div>`
        : `<p class="mt-3 text-xs text-slate-500">Sin filtros activos adicionales.</p>`
      }
    </section>`;
}

function kpiToneClasses(kpi: ReporteComedorKpi, isPrimary: boolean): { card: string; icon: string; trend: string } {
  if (isPrimary) {
    return {
      card: "border-leoni-blue/20 bg-gradient-to-br from-leoni-blue/10 to-sky-50",
      icon: "bg-leoni-blue text-white",
      trend: "#0f4da8",
    };
  }
  if (kpi.id === "promedio_asistencia") {
    return { card: "border-emerald-200/90 bg-white", icon: "bg-emerald-100 text-emerald-700", trend: "#059669" };
  }
  if (kpi.id === "dias_mayor_consumo") {
    return { card: "border-amber-200/90 bg-white", icon: "bg-amber-100 text-amber-700", trend: "#d97706" };
  }
  return { card: "border-slate-200/90 bg-white", icon: "bg-slate-100 text-slate-700", trend: "#64748b" };
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
  return `<svg viewBox="0 0 ${width} ${height}" class="h-9 w-full"><polyline fill="none" stroke="${colorHex}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${points}" /></svg>`;
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

function normalizeKpiSecondary(kpi: ReporteComedorKpi): string {
  if (kpi.id === "promedio_asistencia") return `${kpi.secundario}. Revisar equipos bajo 90%.`;
  if (kpi.id === "costo_estimado") return "Comparar contra presupuesto y ajustar menú por demanda.";
  if (kpi.id === "total_empleados") return "Segmenta por turno para detectar variaciones de consumo.";
  if (kpi.id === "dias_mayor_consumo") return "Usa estos picos para planear insumos y dotación.";
  return kpi.secundario;
}

function renderKpis(state: ReporteComedorViewState): string {
  if (state.kpisState === "loading") {
    return `<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${Array.from({ length: 4 })
        .map(
          () => `<article class="animate-pulse rounded-xl border border-border bg-white p-4 shadow-sm">
            <div class="h-8 w-8 rounded-lg bg-slate-100"></div>
            <div class="mt-3 h-3 w-36 rounded bg-slate-100"></div>
            <div class="mt-2 h-7 w-24 rounded bg-slate-200"></div>
            <div class="mt-2 h-3 w-40 rounded bg-slate-100"></div>
          </article>`,
        )
        .join("")}
    </section>`;
  }
  if (state.kpisState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p class="font-semibold">No fue posible cargar las métricas del reporte.</p>
        <p class="mt-1">${escapeComedorHtml(state.kpisError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-kpis class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }
  if (state.kpisState === "empty" || !state.kpis || state.kpis.length === 0) {
    return `<section class="rounded-xl border border-border bg-white px-4 py-6 text-sm text-text-muted">No hay métricas disponibles para los filtros seleccionados.</section>`;
  }
  const ordered = state.kpis
    .filter((kpi) => kpi.id !== "dias_mayor_consumo")
    .sort((a, b) => (a.id === "costo_estimado" ? -1 : b.id === "costo_estimado" ? 1 : 0));
  return `<section class="space-y-3">
    <article class="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
      <p class="text-xs font-semibold uppercase tracking-wide text-leoni-blue">Resumen del periodo</p>
      <p class="mt-1 text-sm text-slate-700">Del ${escapeComedorHtml(formatFilterDate(state.selectedFechaInicioIso))} al ${escapeComedorHtml(formatFilterDate(state.selectedFechaFinIso))}.</p>
    </article>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${ordered
        .map((kpi) => {
          const isPrimary = kpi.id === "costo_estimado";
          const tone = kpiToneClasses(kpi, isPrimary);
          const value = kpi.id === "dias_mayor_consumo" ? normalizePeakDays(kpi.valor) : kpi.valor;
          return `<article class="rounded-xl border p-4 shadow-sm ring-1 ring-slate-900/5 ${tone.card} ${isPrimary ? "sm:col-span-2 xl:col-span-2" : ""}">
            <div class="flex items-start justify-between gap-3">
              <div class="inline-flex size-9 items-center justify-center rounded-lg ${tone.icon}">${iconForKpi(kpi.icono)}</div>
              <div class="min-w-28">${renderSparkline(sparklineValuesForKpi(kpi.id), tone.trend)}</div>
            </div>
            <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeComedorHtml(kpi.label)}</p>
            <p class="mt-1 ${isPrimary ? "text-4xl" : "text-2xl"} font-bold tracking-tight text-text-primary">${escapeComedorHtml(value)}</p>
            <p class="mt-2 text-xs ${isPrimary ? "text-slate-700" : "text-text-muted"}">${escapeComedorHtml(normalizeKpiSecondary(kpi))}</p>
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
  return `<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted ${extraClass}">
      <button type="button" data-comedor-reporte-sort="${key}" class="inline-flex items-center gap-1 hover:text-slate-900">
        ${escapeComedorHtml(title)}
        ${sortArrow(active, state.tableSortDirection)}
      </button>
    </th>`;
}

function renderTable(state: ReporteComedorViewState): string {
  if (state.tableState === "loading") {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="animate-pulse p-4">
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="mt-3 h-10 rounded bg-slate-100"></div>
          <div class="mt-3 h-10 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }
  if (state.tableState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
        <p class="font-semibold">No fue posible cargar la tabla de empleados.</p>
        <p class="mt-1">${escapeComedorHtml(state.tableError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-table class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }
  const rows = filteredAndSortedRows(state);
  if (state.tableState === "empty" || rows.length === 0) {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="border-b border-slate-200 px-4 py-3">
          <input
            type="search"
            value="${escapeComedorHtml(state.tableSearch)}"
            data-comedor-reporte-search
            placeholder="Buscar por nombre, número o área"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          />
        </div>
        <p class="px-4 py-14 text-center text-sm text-slate-500">No hay empleados para los filtros o búsqueda actual.</p>
      </section>`;
  }
  return `
    <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p class="text-sm font-semibold text-slate-900">Empleados evaluados</p>
        <input
          type="search"
          value="${escapeComedorHtml(state.tableSearch)}"
          data-comedor-reporte-search
          placeholder="Buscar por nombre, número o área"
          class="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
        />
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[940px] w-full text-left">
          <thead class="border-b border-leoni-blue-light bg-slate-50/70">
            <tr>
              ${sortableHeader("Empleado", "nombre", state)}
              ${sortableHeader("Días (mes)", "dias_mes", state)}
              ${sortableHeader("Menú", "menu", state)}
              ${sortableHeader("Estado", "estado", state, "whitespace-nowrap")}
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">
            ${rows
              .map((row) => {
                return `<tr class="transition hover:bg-slate-50">
                    <td class="px-4 py-3">
                      ${renderEmpleadoAvatarCell(row.nombre, row.noEmpleado, row.avatarUrl)}
                      <p class="mt-1 pl-11 text-xs text-slate-500">${escapeComedorHtml(row.area)}</p>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">${escapeComedorHtml(row.diasMes)}</td>
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
      </section>
    </section>`;
}

function renderHelpFooter(): string {
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
      Insights automáticos: el mayor consumo se concentra en días pico; usa filtros por turno para balancear producción y presupuesto.
    </section>`;
}

export function renderComedorReporteDashboard(state: ReporteComedorViewState): string {
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      ${renderHeader()}
      ${renderFilters(state)}
      ${renderKpis(state)}
      <section class="space-y-4">${renderTable(state)}</section>
      ${renderHelpFooter()}
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
      ${renderHelpFooter()}
    </div>`;
}
