import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  buildFaltasRetardosTendenciaFromEstadisticas,
  faltasRetardosTendenciaPorTipoTieneDatos,
} from "../../faltasRetardos/rh/buildFaltasRetardosTendenciaPorTipo.ts";
import type { FaltasRetardosMetricasViewModel } from "../../faltasRetardos/rh/types.ts";
import type { FaltasRetardosEstadisticasData } from "../../faltasRetardos/rh/types.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { empleadoLabelCorto } from "../../utils/empleadoLabelConNumero.ts";
import { RH_LISTADO_SURFACE } from "./rhFaltasRetardosPageStyles.ts";
import {
  mountFaltasRetardosTendenciaPorTipoChart,
  mountFaltasRetardosTipoBarChart,
  mountFaltasRetardosEmpleadosStackedBarChart,
  renderFaltasRetardosEmpleadosBarChart,
  renderFaltasRetardosTipoBarChart,
  renderFaltasRetardosTendenciaPorTipoChart,
  RH_FR_EMPLEADOS_BAR_CHART_ID,
  RH_FR_TENDENCIA_CHART_ID,
  RH_FR_TIPO_BAR_CHART_ID,
  type FaltaRetardoEmpleadoChartRow,
} from "./rhFaltasRetardosCharts.ts";

const CARD = `${RH_LISTADO_SURFACE} flex min-h-0 flex-col rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-4`;

function empleadosChartRows(data: FaltasRetardosEstadisticasData): FaltaRetardoEmpleadoChartRow[] {
  return (data.empleados_con_mas_eventos ?? [])
    .filter((e) => e.total > 0)
    .map((e) => {
      const byTipo: Partial<Record<FaltaRetardoTipo, number>> = {};
      for (const item of e.por_tipo ?? []) {
        if (item.total > 0) byTipo[item.tipo] = item.total;
      }
      return {
        label: empleadoLabelCorto(e.nombre, e.no_empleado),
        total: e.total,
        byTipo,
      };
    })
    .slice(0, 10);
}

function chartShell(title: string, subtitle: string, body: string): string {
  return `
    <article class="${CARD}">
      <header class="mb-4 shrink-0 text-center">
        <h3 class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)]">${escapeHtml(title)}</h3>
        <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">${escapeHtml(subtitle)}</p>
      </header>
      <div class="min-h-0 flex-1">${body}</div>
    </article>`;
}

function chartsSkeleton(): string {
  return `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-hidden="true">
      <div class="${CARD} min-h-[360px] animate-pulse lg:col-span-7"><div class="h-4 w-40 rounded bg-slate-200"></div><div class="mt-4 h-[280px] rounded bg-slate-100"></div></div>
      <div class="${CARD} min-h-[360px] animate-pulse lg:col-span-5"><div class="h-4 w-32 rounded bg-slate-200"></div><div class="mt-4 h-[280px] rounded bg-slate-100"></div></div>
    </div>
    <div class="${CARD} min-h-[300px] animate-pulse"><div class="h-4 w-48 rounded bg-slate-200"></div><div class="mt-4 h-[260px] rounded bg-slate-100"></div></div>`;
}

function renderChartsContent(
  data: FaltasRetardosEstadisticasData,
  tendenciaFiltros: FaltasRetardosMetricasViewModel["tendenciaFiltros"],
): string {
  if (data.total_eventos <= 0) {
    return `<div class="${CARD} items-center py-10 text-center text-sm text-[color:var(--color-text-muted)]">${escapeHtml(FR_COPY.metricasVacia)}</div>`;
  }
  const tendenciaData = buildFaltasRetardosTendenciaFromEstadisticas(data, tendenciaFiltros);
  const tendenciaBody = faltasRetardosTendenciaPorTipoTieneDatos(tendenciaData)
    ? renderFaltasRetardosTendenciaPorTipoChart(tendenciaData!)
    : `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">${escapeHtml(FR_COPY.metricasSinDatos)}</div>`;
  const ranking = empleadosChartRows(data);
  return `
    <div class="flex flex-col gap-4 sm:gap-5">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <div class="lg:col-span-7">
          ${chartShell(
            FR_COPY.metricasTendenciaTitulo,
            FR_COPY.metricasTendenciaSub,
            tendenciaBody,
          )}
        </div>
        <div class="lg:col-span-5">
          ${chartShell(
            FR_COPY.metricasTipoTitulo,
            FR_COPY.metricasTipoSub,
            renderFaltasRetardosTipoBarChart(data.eventos_por_tipo ?? []),
          )}
        </div>
      </div>
      ${chartShell(
        FR_COPY.metricasEmpleadosTitulo,
        FR_COPY.metricasEmpleadosSub,
        renderFaltasRetardosEmpleadosBarChart(ranking.length > 0),
      )}
    </div>`;
}

export function renderRhFaltasRetardosMetricasSection(
  vm: FaltasRetardosMetricasViewModel,
): string {
  if (vm.estadisticasStatus === "loading") {
    return `<div id="rh-fr-metricas-analytics" class="flex flex-col gap-4 sm:gap-5" aria-busy="true">
      ${chartsSkeleton()}
    </div>`;
  }
  if (vm.estadisticasStatus === "error") {
    return `<div id="rh-fr-metricas-analytics" class="shrink-0">
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        ${escapeHtml(vm.estadisticasErrorMessage || FR_COPY.errorEstadisticas)}
      </div>
    </div>`;
  }
  const data = vm.estadisticas;
  if (!data) {
    return `<div id="rh-fr-metricas-analytics" class="text-sm text-[color:var(--color-text-muted)]">${escapeHtml(FR_COPY.metricasSinDatos)}</div>`;
  }
  return `<div id="rh-fr-metricas-analytics" class="flex flex-col gap-4 sm:gap-5">
    ${renderChartsContent(data, vm.tendenciaFiltros)}
  </div>`;
}

const FR_METRICAS_CHART_IDS = [
  RH_FR_TENDENCIA_CHART_ID,
  RH_FR_TIPO_BAR_CHART_ID,
  RH_FR_EMPLEADOS_BAR_CHART_ID,
] as const;

export function mountRhFaltasRetardosMetricasCharts(
  root: ParentNode,
  vm: FaltasRetardosMetricasViewModel,
  destroyChartById: (chartId: string) => void,
  destroyChartsInContainer: (container: ParentNode) => void,
): void {
  for (const id of FR_METRICAS_CHART_IDS) destroyChartById(id);
  const host = root.querySelector("#rh-fr-metricas-analytics");
  if (host) destroyChartsInContainer(host);
  if (vm.estadisticasStatus !== "ready" || !vm.estadisticas) return;
  const data = vm.estadisticas;
  const tendencia = buildFaltasRetardosTendenciaFromEstadisticas(data, vm.tendenciaFiltros);
  if (faltasRetardosTendenciaPorTipoTieneDatos(tendencia)) {
    mountFaltasRetardosTendenciaPorTipoChart(root, tendencia!);
  }
  mountFaltasRetardosTipoBarChart(root, data.eventos_por_tipo ?? []);
  const rows = empleadosChartRows(data);
  if (rows.length > 0) {
    mountFaltasRetardosEmpleadosStackedBarChart(root, rows);
  }
}
