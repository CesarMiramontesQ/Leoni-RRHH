import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  badgeCancelled,
  badgeInProgress,
  badgeRejected,
} from "../../ui/uiTokens.ts";
import type { Eval360Filters, KpiCard, PlantKpisRh, TalentoSaludCard } from "../types.ts";
import { renderEval360Filters } from "../filters.ts";
import {
  computeBrechaHeatmap,
  computeCompetenciasPorDepartamento,
  computePlantKpis,
  computeTalentoSalud,
  filterEmpleadosEval360,
  getBrechaCriticaList,
  getNecesidadesCapacitacion,
  getTopDestacados,
  MOCK_EMPLEADOS_EVAL360,
} from "../rhDashboardData.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { renderEval360KpiGrid, renderSurfaceCard } from "../shared.ts";

const DEMO_SPARK = [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

function plantKpisToKpiCards(kpis: PlantKpisRh): KpiCard[] {
  return [
    {
      label: "Total empleados evaluados",
      value: String(kpis.totalEvaluados),
      icon: "users",
      spark: DEMO_SPARK,
      delta: "+4",
      deltaPositive: true,
      sub: "vs. ciclo anterior",
    },
    {
      label: "Evaluaciones completadas",
      value: String(kpis.completadas),
      icon: "check",
      spark: DEMO_SPARK,
      delta: "+12%",
      deltaPositive: true,
      sub: "vs. ciclo anterior",
    },
    {
      label: "Participación general",
      value: String(kpis.participacionPct),
      suffix: "%",
      icon: "target",
      spark: DEMO_SPARK,
      delta: "+5 pts",
      deltaPositive: true,
      sub: "vs. ciclo anterior",
    },
    {
      label: "Promedio general planta",
      value: kpis.promedioPlanta.toFixed(1),
      suffix: "/5",
      icon: "star",
      spark: DEMO_SPARK,
      delta: "+0.2",
      deltaPositive: true,
      sub: "vs. ciclo anterior",
    },
    {
      label: "Competencias en riesgo",
      value: String(kpis.competenciasRiesgo),
      icon: "warn",
      spark: DEMO_SPARK,
      delta: "-2",
      deltaPositive: true,
      sub: "vs. ciclo anterior",
    },
    {
      label: "Brechas críticas detectadas",
      value: String(kpis.brechasCriticas),
      icon: "alert",
      spark: DEMO_SPARK,
      delta: "+1",
      deltaPositive: false,
      sub: "vs. ciclo anterior",
    },
  ];
}

function renderTalentoSalud(cards: TalentoSaludCard[]): string {
  const tone: Record<TalentoSaludCard["segmento"], string> = {
    sobresaliente: "border-emerald-200 bg-emerald-50",
    estable: "border-blue-200 bg-blue-50",
    desarrollo: "border-amber-200 bg-amber-50",
    riesgo: "border-red-200 bg-red-50",
  };
  return `
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    ${cards
      .map(
        (c) => `
      <article class="rounded-[14px] border p-4 ${tone[c.segmento]}">
        <p class="text-xs font-semibold text-text-primary">${escapeHtml(c.label)}</p>
        <p class="mt-2 text-2xl font-bold tabular-nums tracking-tight text-text-primary">${c.cantidad}</p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <span class="text-sm font-semibold tabular-nums text-text-primary">${c.pct}%</span>
          <span class="text-[10px] font-semibold ${c.deltaPositive ? "text-emerald-700" : "text-red-700"}">${c.deltaPositive ? "↑" : "↓"} ${escapeHtml(c.delta)} vs ciclo ant.</span>
        </div>
      </article>`,
      )
      .join("")}
  </div>`;
}

function brechaHeatmapCell(nivel: string): string {
  const map: Record<string, string> = {
    ninguna: "bg-emerald-100 text-emerald-800",
    baja: "bg-sky-100 text-sky-800",
    media: "bg-amber-100 text-amber-900",
    critica: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    ninguna: "Sin brecha",
    baja: "Brecha baja",
    media: "Brecha media",
    critica: "Brecha crítica",
  };
  return `<div class="flex h-10 items-center justify-center rounded text-[10px] font-semibold ${map[nivel] ?? map.baja}">${labels[nivel] ?? nivel}</div>`;
}

function capacitacionPrioridadBadge(prioridad: string): string {
  if (prioridad === "Alta") return badgeRejected(prioridad);
  if (prioridad === "Media") return badgeInProgress(prioridad);
  return badgeCancelled(prioridad);
}

export interface RhDashboardRenderOpts {
  filters: Eval360Filters;
}

export function renderEval360RhDashboard(opts: RhDashboardRenderOpts): string {
  const filtered = filterEmpleadosEval360(MOCK_EMPLEADOS_EVAL360, opts.filters, "");
  const kpis = computePlantKpis(filtered);
  const salud = computeTalentoSalud(filtered);
  const heatmap = computeBrechaHeatmap(filtered);
  const charts = renderEval360ChartIds();

  const topDestacados = getTopDestacados(filtered);
  const brechaCritica = getBrechaCriticaList(filtered);
  const capacitacion = getNecesidadesCapacitacion(filtered);

  const heatmapHeader = heatmap.competencias.map((c) => `<th class="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(c)}</th>`).join("");
  const heatmapRows = heatmap.departamentos
    .map(
      (dept, di) => `
    <tr>
      <td class="px-3 py-2 text-xs font-medium text-text-primary">${escapeHtml(dept)}</td>
      ${heatmap.matrix[di]?.map((cell) => `<td class="p-1">${brechaHeatmapCell(cell)}</td>`).join("") ?? ""}
    </tr>`,
    )
    .join("");

  return `
    ${renderEval360Filters(opts.filters)}

    <section class="mt-6" aria-labelledby="e360-seccion-planta">
      <h2 id="e360-seccion-planta" class="text-sm font-semibold text-text-primary">Resumen general de planta</h2>
      <p class="mt-0.5 text-xs text-text-muted">${filtered.length} empleados en el universo filtrado</p>
      <div class="mt-4">${renderEval360KpiGrid(plantKpisToKpiCards(kpis))}</div>

      <div class="mt-6">
        <h3 class="text-sm font-semibold text-text-primary">Salud de talento de la planta</h3>
        <div class="mt-3">${renderTalentoSalud(salud)}</div>
      </div>

      <div class="mt-6 grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard("Promedio de competencias por departamento", "Comparativo por área organizacional", charts.barDeptComp)}
        ${renderSurfaceCard(
          "Mapa de brechas por competencia y departamento",
          "Sin brecha · Brecha baja · Brecha media · Brecha crítica",
          `<div class="overflow-x-auto -mx-5 px-5">
            <table class="min-w-full text-left">
              <thead><tr><th class="px-3 py-2"></th>${heatmapHeader}</tr></thead>
              <tbody>${heatmapRows}</tbody>
            </table>
          </div>`,
        )}
      </div>

      <div class="mt-5 grid gap-5 lg:grid-cols-3">
        ${renderSurfaceCard(
          "Top empleados destacados",
          "",
          `<ul class="space-y-3">${topDestacados.map((e) => `<li class="flex items-start justify-between gap-2"><div><p class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre)}</p><p class="text-xs text-text-muted">${escapeHtml(e.puesto)} · ${escapeHtml(e.departamento)}</p></div><div class="text-right"><p class="text-sm font-bold tabular-nums text-accent">${e.calificacion.toFixed(1)}</p><p class="text-[10px] font-semibold text-emerald-700">${escapeHtml(e.nivel)}</p></div></li>`).join("") || `<p class="text-sm text-text-muted">Sin datos</p>`}</ul>`,
        )}
        ${renderSurfaceCard(
          "Empleados con brecha crítica",
          "",
          `<ul class="space-y-3">${brechaCritica.map((b) => `<li><p class="text-sm font-medium text-text-primary">${escapeHtml(b.nombre)}</p><p class="text-xs text-red-700">${escapeHtml(b.competencia)} · ${escapeHtml(b.brecha)}</p><p class="text-[11px] text-text-muted">${escapeHtml(b.accion)}</p></li>`).join("") || `<p class="text-sm text-text-muted">Sin alertas</p>`}</ul>`,
        )}
        ${renderSurfaceCard(
          "Necesidades de capacitación",
          "Agrupado por competencia",
          `<ul class="space-y-3">${capacitacion.map((n) => `<li class="flex items-center justify-between gap-2"><div><p class="text-sm font-medium text-text-primary">${escapeHtml(n.competencia)}</p><p class="text-xs text-text-muted">${n.afectados} empleados</p></div>${capacitacionPrioridadBadge(n.prioridad)}</li>`).join("") || `<p class="text-sm text-text-muted">Sin necesidades detectadas</p>`}</ul>`,
        )}
      </div>
    </section>`;
}

export function renderEval360RhHeader(): string {
  return `
    <header class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium text-text-muted">Level Up · Recursos Humanos</p>
        <h1 class="mt-0.5 text-xl font-bold text-text-primary">Evaluación 360°</h1>
        <p class="mt-1 text-sm text-text-muted">Vista integral de desempeño, competencias y brechas de talento por planta.</p>
      </div>
      <div class="rh-sol-header__toolbar mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
        <button type="button" class="${RH_LISTADO_BTN_GHOST}" data-action="e360-exportar">Exportar resultados</button>
        <button type="button" class="${RH_LISTADO_BTN_SECONDARY}" data-action="e360-generar-reporte">Generar reporte</button>
        <button type="button" class="${RH_LISTADO_BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
      </div>
    </header>`;
}

/** Datos de gráfica competencias/depto para mount charts. */
export function getDashboardChartData(opts: RhDashboardRenderOpts) {
  const filtered = filterEmpleadosEval360(MOCK_EMPLEADOS_EVAL360, opts.filters, "");
  return {
    filtered,
    competenciasDept: computeCompetenciasPorDepartamento(filtered),
  };
}
