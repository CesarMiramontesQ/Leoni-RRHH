import type {
  ReporteComedorEmpleadoRow,
  ReporteComedorKpi,
  ReporteComedorKpiId,
  ReporteComedorViewState,
} from "../../comedor/reportes/types.ts";
import { serieDiariaTotales, serieDiariaTotalesOperativo } from "../../comedor/reportes/reporteAggregations.ts";
import { hasRhOperativeViewerContext } from "../../auth/jwt.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";
import {
  renderReporteFilterToolbarGlobal,
  renderReportePlaneacionPlatillos,
  renderReporteMainHeaderCard,
  renderReporteRhRestrictedNotice,
  renderReporteTabDetalle,
  reporteOperativoRowsScoped,
} from "./comedorReporteAnalytics.ts";

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

function parseDiasMes(diasMes: string): { asistidos: number; esperados: number; ratio: number } {
  const [asistidosRaw, esperadosRaw] = diasMes.split("/");
  const asistidos = Number.parseInt((asistidosRaw ?? "").trim(), 10);
  const esperados = Number.parseInt((esperadosRaw ?? "").trim(), 10);
  const safeAsistidos = Number.isFinite(asistidos) ? asistidos : 0;
  const safeEsperados = Number.isFinite(esperados) && esperados > 0 ? esperados : 1;
  return { asistidos: safeAsistidos, esperados: safeEsperados, ratio: safeAsistidos / safeEsperados };
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
  if (state.kpisModo === "rh_resumen" && kpi.id === "total_registros_resumen") {
    if (
      state.selectedAreaFilter === "todos" &&
      state.rhResumenDiario &&
      state.rhResumenDiario.length > 0
    ) {
      const serie = serieDiariaTotales(state.rhResumenDiario, "todos").slice(-14);
      return renderSparkline(serie, trendColor);
    }
    const scoped = reporteOperativoRowsScoped(state);
    const serieOp = serieDiariaTotalesOperativo(scoped, state.selectedFechaInicioIso, state.selectedFechaFinIso).slice(
      -14,
    );
    if (serieOp.length > 0) return renderSparkline(serieOp, trendColor);
  }
  return renderSparkline(sparklineValuesForKpi(kpi.id), trendColor);
}

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
  return `<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

function renderReporteWorkspaceIntro(): string {
  return `
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold tracking-tight text-slate-900">Registros del periodo</h2>
      <p class="max-w-3xl text-sm leading-relaxed text-slate-600">Accesos con fecha de servicio dentro del rango y filtros aplicados en la parte superior (periodo, comedor y área).</p>
    </div>`;
}

export function renderComedorReporteDashboard(state: ReporteComedorViewState): string {
  const esRh = hasRhOperativeViewerContext();
  const tabContent = `<div class="flex flex-col gap-5">${esRh ? renderReporteTabDetalle(state) : renderReporteRhRestrictedNotice()}</div>`;

  return `
    <div class="flex min-h-0 flex-col gap-5 sm:gap-6">
      ${renderReporteMainHeaderCard(state)}
      ${renderReporteFilterToolbarGlobal(state)}
      ${renderKpis(state)}
      ${esRh ? renderReportePlaneacionPlatillos(state) : ""}
      <section class="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 sm:p-6 lg:p-7">
        <div class="space-y-6">
          ${renderReporteWorkspaceIntro()}
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
